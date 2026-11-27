package handlers

import (
	"math/rand"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LearnHandler struct {
	Pool *pgxpool.Pool
}

const defaultLearnUserID = "00000000-0000-0000-0000-000000000001"

func (h *LearnHandler) GetSummary(c *fiber.Ctx) error {
	var totalUnique, mastered, learning, totalCorrect, totalWrong int
	err := h.Pool.QueryRow(c.Context(), `
		SELECT
		  (SELECT count(DISTINCT normalized_search_text) FROM quran_words WHERE normalized_search_text <> ''),
		  (SELECT count(*) FROM learning_word_progress WHERE user_id = $1 AND mastery_level >= 2),
		  (SELECT count(*) FROM learning_word_progress WHERE user_id = $1 AND mastery_level = 1),
		  COALESCE((SELECT sum(correct_count) FROM learning_word_progress WHERE user_id = $1), 0),
		  COALESCE((SELECT sum(wrong_count) FROM learning_word_progress WHERE user_id = $1), 0)
	`, defaultLearnUserID).Scan(&totalUnique, &mastered, &learning, &totalCorrect, &totalWrong)
	if err != nil {
		return err
	}

	rows, err := h.Pool.Query(c.Context(), `
		SELECT a.juz_number,
		       count(DISTINCT w.normalized_search_text) AS unique_words,
		       count(DISTINCT CASE WHEN lp.mastery_level >= 2 THEN w.normalized_search_text END) AS mastered_words
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		LEFT JOIN learning_word_progress lp
		  ON lp.normalized_word = w.normalized_search_text AND lp.user_id = $1
		WHERE a.juz_number IS NOT NULL AND w.normalized_search_text <> ''
		GROUP BY a.juz_number
		ORDER BY a.juz_number
	`, defaultLearnUserID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var juzStats []fiber.Map
	for rows.Next() {
		var juz int16
		var uniq, mast int
		if err := rows.Scan(&juz, &uniq, &mast); err != nil {
			return err
		}
		juzStats = append(juzStats, fiber.Map{
			"juz_number":     juz,
			"unique_words":   uniq,
			"mastered_words": mast,
		})
	}

	return c.JSON(fiber.Map{
		"total_unique_words": totalUnique,
		"mastered_words":     mastered,
		"learning_words":     learning,
		"total_correct":      totalCorrect,
		"total_wrong":        totalWrong,
		"juz_progress":       juzStats,
	})
}

func (h *LearnHandler) GetDeck(c *fiber.Ctx) error {
	mode := c.Query("mode", "frequency")
	juz := c.QueryInt("juz", 30)
	page := c.QueryInt("page", 1)
	onlyNew := c.Query("only_new", "false") == "true"
	limit, offset := parsePagination(c)

	var query string
	var args []any

	switch mode {
	case "juz":
		if onlyNew {
			query = `
				WITH first_occ AS (
					SELECT normalized_search_text, MIN(id) AS first_id
					FROM quran_words
					WHERE normalized_search_text <> ''
					GROUP BY normalized_search_text
				),
				juz_words AS (
					SELECT w.normalized_search_text, MIN(w.id) AS sample_word_id, count(*) AS freq
					FROM quran_words w
					JOIN ayahs a ON a.id = w.ayah_id
					JOIN first_occ fo ON fo.normalized_search_text = w.normalized_search_text AND fo.first_id = w.id
					WHERE a.juz_number = $1
					GROUP BY w.normalized_search_text
				)
				SELECT sw.id, jw.normalized_search_text, sw.arabic_text, wt.translation,
				       COALESCE((SELECT r.arabic_text FROM word_morphology wm JOIN roots r ON r.id = wm.root_id WHERE wm.word_id = sw.id AND wm.root_id IS NOT NULL ORDER BY wm.segment_number LIMIT 1), '') AS root_text,
				       a.surah_id, s.name_arabic, a.ayah_number,
				       (SELECT mp.page_number FROM mushaf_line_items li JOIN mushaf_lines ml ON ml.id = li.line_id JOIN mushaf_pages mp ON mp.id = ml.page_id WHERE li.word_id = sw.id LIMIT 1) AS page_number,
				       jw.freq, COALESCE(lp.mastery_level, 0) AS mastery_level
				FROM juz_words jw
				JOIN quran_words sw ON sw.id = jw.sample_word_id
				JOIN ayahs a ON a.id = sw.ayah_id
				JOIN surahs s ON s.id = a.surah_id
				JOIN word_translations wt ON wt.word_id = sw.id AND wt.language_code = 'id'
				LEFT JOIN learning_word_progress lp ON lp.normalized_word = jw.normalized_search_text AND lp.user_id = $2
				WHERE wt.translation <> ''
				ORDER BY COALESCE(lp.mastery_level, 0) ASC, jw.freq DESC, sw.id ASC
				LIMIT $3 OFFSET $4
			`
		} else {
			query = `
				WITH juz_words AS (
					SELECT w.normalized_search_text, MIN(w.id) AS sample_word_id, count(*) AS freq
					FROM quran_words w
					JOIN ayahs a ON a.id = w.ayah_id
					WHERE a.juz_number = $1 AND w.normalized_search_text <> ''
					GROUP BY w.normalized_search_text
				)
				SELECT sw.id, jw.normalized_search_text, sw.arabic_text, wt.translation,
				       COALESCE((SELECT r.arabic_text FROM word_morphology wm JOIN roots r ON r.id = wm.root_id WHERE wm.word_id = sw.id AND wm.root_id IS NOT NULL ORDER BY wm.segment_number LIMIT 1), '') AS root_text,
				       a.surah_id, s.name_arabic, a.ayah_number,
				       (SELECT mp.page_number FROM mushaf_line_items li JOIN mushaf_lines ml ON ml.id = li.line_id JOIN mushaf_pages mp ON mp.id = ml.page_id WHERE li.word_id = sw.id LIMIT 1) AS page_number,
				       jw.freq, COALESCE(lp.mastery_level, 0) AS mastery_level
				FROM juz_words jw
				JOIN quran_words sw ON sw.id = jw.sample_word_id
				JOIN ayahs a ON a.id = sw.ayah_id
				JOIN surahs s ON s.id = a.surah_id
				JOIN word_translations wt ON wt.word_id = sw.id AND wt.language_code = 'id'
				LEFT JOIN learning_word_progress lp ON lp.normalized_word = jw.normalized_search_text AND lp.user_id = $2
				WHERE wt.translation <> ''
				ORDER BY COALESCE(lp.mastery_level, 0) ASC, jw.freq DESC, sw.id ASC
				LIMIT $3 OFFSET $4
			`
		}
		args = []any{juz, defaultLearnUserID, limit, offset}

	case "page":
		query = `
			WITH page_words AS (
				SELECT w.normalized_search_text, MIN(w.id) AS sample_word_id, count(*) AS freq
				FROM mushaf_pages mp
				JOIN mushaf_lines ml ON ml.page_id = mp.id
				JOIN mushaf_line_items li ON li.line_id = ml.id
				JOIN quran_words w ON w.id = li.word_id
				WHERE mp.page_number = $1 AND w.normalized_search_text <> ''
				GROUP BY w.normalized_search_text
			)
			SELECT sw.id, pw.normalized_search_text, sw.arabic_text, wt.translation,
			       COALESCE((SELECT r.arabic_text FROM word_morphology wm JOIN roots r ON r.id = wm.root_id WHERE wm.word_id = sw.id AND wm.root_id IS NOT NULL ORDER BY wm.segment_number LIMIT 1), '') AS root_text,
			       a.surah_id, s.name_arabic, a.ayah_number,
			       $1::smallint AS page_number,
			       pw.freq, COALESCE(lp.mastery_level, 0) AS mastery_level
			FROM page_words pw
			JOIN quran_words sw ON sw.id = pw.sample_word_id
			JOIN ayahs a ON a.id = sw.ayah_id
			JOIN surahs s ON s.id = a.surah_id
			JOIN word_translations wt ON wt.word_id = sw.id AND wt.language_code = 'id'
			LEFT JOIN learning_word_progress lp ON lp.normalized_word = pw.normalized_search_text AND lp.user_id = $2
			WHERE wt.translation <> ''
			ORDER BY sw.id ASC
			LIMIT $3 OFFSET $4
		`
		args = []any{page, defaultLearnUserID, limit, offset}

	default: // frequency (80/20)
		query = `
			WITH freq_words AS (
				SELECT normalized_search_text, MIN(id) AS sample_word_id, count(*) AS freq
				FROM quran_words
				WHERE normalized_search_text <> ''
				GROUP BY normalized_search_text
			)
			SELECT sw.id, fw.normalized_search_text, sw.arabic_text, wt.translation,
			       COALESCE((SELECT r.arabic_text FROM word_morphology wm JOIN roots r ON r.id = wm.root_id WHERE wm.word_id = sw.id AND wm.root_id IS NOT NULL ORDER BY wm.segment_number LIMIT 1), '') AS root_text,
			       a.surah_id, s.name_arabic, a.ayah_number,
			       (SELECT mp.page_number FROM mushaf_line_items li JOIN mushaf_lines ml ON ml.id = li.line_id JOIN mushaf_pages mp ON mp.id = ml.page_id WHERE li.word_id = sw.id LIMIT 1) AS page_number,
			       fw.freq, COALESCE(lp.mastery_level, 0) AS mastery_level
			FROM freq_words fw
			JOIN quran_words sw ON sw.id = fw.sample_word_id
			JOIN ayahs a ON a.id = sw.ayah_id
			JOIN surahs s ON s.id = a.surah_id
			JOIN word_translations wt ON wt.word_id = sw.id AND wt.language_code = 'id'
			LEFT JOIN learning_word_progress lp ON lp.normalized_word = fw.normalized_search_text AND lp.user_id = $1
			WHERE wt.translation <> ''
			ORDER BY COALESCE(lp.mastery_level, 0) ASC, fw.freq DESC
			LIMIT $2 OFFSET $3
		`
		args = []any{defaultLearnUserID, limit, offset}
	}

	rows, err := h.Pool.Query(c.Context(), query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	// Pool of distractor translations from DB
	dRows, err := h.Pool.Query(c.Context(), `
		SELECT DISTINCT translation
		FROM word_translations
		WHERE language_code = 'id' AND translation <> ''
		LIMIT 250
	`)
	if err != nil {
		return err
	}
	var poolTrans []string
	for dRows.Next() {
		var t string
		if err := dRows.Scan(&t); err == nil {
			poolTrans = append(poolTrans, t)
		}
	}
	dRows.Close()

	var cards []fiber.Map
	for rows.Next() {
		var wid int64
		var surahID, ayahNum, mastery int16
		var pageNum *int16
		var freq int
		var normWord, ar, tr, rootTxt, sName string
		if err := rows.Scan(&wid, &normWord, &ar, &tr, &rootTxt, &surahID, &sName, &ayahNum, &pageNum, &freq, &mastery); err != nil {
			return err
		}

		choices := buildChoices(tr, poolTrans)
		cards = append(cards, fiber.Map{
			"word_id":         wid,
			"normalized_word": normWord,
			"arabic_text":     ar,
			"translation_id":  tr,
			"root":            rootTxt,
			"surah_id":        surahID,
			"surah_name":      sName,
			"ayah_number":     ayahNum,
			"page_number":     pageNum,
			"frequency":       freq,
			"mastery_level":   mastery,
			"choices":         choices,
		})
	}

	return c.JSON(fiber.Map{
		"mode":  mode,
		"cards": cards,
	})
}

func buildChoices(correct string, pool []string) []string {
	choices := []string{correct}
	seen := map[string]bool{correct: true}
	if len(pool) > 0 {
		for tries := 0; tries < 40 && len(choices) < 4; tries++ {
			cand := pool[rand.Intn(len(pool))]
			if !seen[cand] {
				seen[cand] = true
				choices = append(choices, cand)
			}
		}
	}
	rand.Shuffle(len(choices), func(i, j int) {
		choices[i], choices[j] = choices[j], choices[i]
	})
	return choices
}

func (h *LearnHandler) SubmitAnswer(c *fiber.Ctx) error {
	var body struct {
		NormalizedWord string `json:"normalized_word"`
		IsCorrect      bool   `json:"is_correct"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.NormalizedWord) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "normalized_word is required")
	}

	var mastery int16
	var correctCnt, wrongCnt int
	err := h.Pool.QueryRow(c.Context(), `
		INSERT INTO learning_word_progress (user_id, normalized_word, mastery_level, correct_count, wrong_count, last_practiced_at)
		VALUES (
			$1, $2,
			CASE WHEN $3 THEN 1 ELSE 0 END,
			CASE WHEN $3 THEN 1 ELSE 0 END,
			CASE WHEN $3 THEN 0 ELSE 1 END,
			now()
		)
		ON CONFLICT (user_id, normalized_word) DO UPDATE
		SET correct_count = learning_word_progress.correct_count + CASE WHEN $3 THEN 1 ELSE 0 END,
		    wrong_count = learning_word_progress.wrong_count + CASE WHEN $3 THEN 0 ELSE 1 END,
		    mastery_level = CASE
		      WHEN $3 THEN LEAST(2, learning_word_progress.mastery_level + 1)
		      ELSE 1
		    END,
		    last_practiced_at = now(),
		    updated_at = now()
		RETURNING mastery_level, correct_count, wrong_count
	`, defaultLearnUserID, strings.TrimSpace(body.NormalizedWord), body.IsCorrect).Scan(&mastery, &correctCnt, &wrongCnt)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"normalized_word": body.NormalizedWord,
		"mastery_level":   mastery,
		"correct_count":   correctCnt,
		"wrong_count":     wrongCnt,
	})
}
