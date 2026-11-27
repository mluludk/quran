package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FrequencyHandler struct {
	Pool *pgxpool.Pool
}

func (h *FrequencyHandler) GetWordFrequency(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "word id")
	if err != nil {
		return err
	}
	limit, offset := parsePagination(c)

	var arabicText, normText, transID string
	err = h.Pool.QueryRow(c.Context(), `
		SELECT w.arabic_text, COALESCE(w.normalized_search_text,''),
		       COALESCE((SELECT translation FROM word_translations WHERE word_id = w.id AND language_code = 'id' LIMIT 1), '')
		FROM quran_words w WHERE w.id = $1
	`, id).Scan(&arabicText, &normText, &transID)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "word not found")
	}
	if err != nil {
		return err
	}

	var rootID *int64
	var rootText string
	var rootCount int
	_ = h.Pool.QueryRow(c.Context(), `
		SELECT r.id, r.arabic_text,
		       (SELECT count(DISTINCT wm2.word_id) FROM word_morphology wm2 WHERE wm2.root_id = r.id)
		FROM word_morphology wm
		JOIN roots r ON r.id = wm.root_id
		WHERE wm.word_id = $1 AND wm.root_id IS NOT NULL
		ORDER BY wm.segment_number
		LIMIT 1
	`, id).Scan(&rootID, &rootText, &rootCount)

	var wordCount, surahCount, makkiyahCount, madaniyahCount int
	err = h.Pool.QueryRow(c.Context(), `
		SELECT count(*),
		       count(DISTINCT a.surah_id),
		       count(*) FILTER (WHERE s.revelation_type = 'makkah'),
		       count(*) FILTER (WHERE s.revelation_type = 'madinah')
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		WHERE w.normalized_search_text = $1
	`, normText).Scan(&wordCount, &surahCount, &makkiyahCount, &madaniyahCount)
	if err != nil {
		return err
	}

	// Surface form variations
	vRows, err := h.Pool.Query(c.Context(), `
		SELECT arabic_text, count(*) AS cnt
		FROM quran_words
		WHERE normalized_search_text = $1
		GROUP BY arabic_text
		ORDER BY cnt DESC, arabic_text
		LIMIT 30
	`, normText)
	if err != nil {
		return err
	}
	var variations []fiber.Map
	for vRows.Next() {
		var txt string
		var cnt int
		if err := vRows.Scan(&txt, &cnt); err != nil {
			vRows.Close()
			return err
		}
		variations = append(variations, fiber.Map{"arabic_text": txt, "count": cnt})
	}
	vRows.Close()

	// Top surahs
	sRows, err := h.Pool.Query(c.Context(), `
		SELECT s.id, s.name_arabic, COALESCE(s.name_transliteration,''), COALESCE(s.revelation_type,''), count(*) AS cnt
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		WHERE w.normalized_search_text = $1
		GROUP BY s.id, s.name_arabic, s.name_transliteration, s.revelation_type
		ORDER BY cnt DESC, s.id
		LIMIT 10
	`, normText)
	if err != nil {
		return err
	}
	var topSurahs []fiber.Map
	for sRows.Next() {
		var sid int16
		var sAr, sTr, rev string
		var cnt int
		if err := sRows.Scan(&sid, &sAr, &sTr, &rev, &cnt); err != nil {
			sRows.Close()
			return err
		}
		topSurahs = append(topSurahs, fiber.Map{
			"surah_id":        sid,
			"name_arabic":     sAr,
			"transliteration": sTr,
			"revelation_type": rev,
			"count":           cnt,
		})
	}
	sRows.Close()

	// Occurrences with full ayah context
	oRows, err := h.Pool.Query(c.Context(), `
		SELECT w.id, w.arabic_text, a.surah_id, s.name_arabic, a.ayah_number, w.word_number,
		       COALESCE(wt.translation,''),
		       (SELECT string_agg(aw.arabic_text, ' ' ORDER BY aw.word_number) FROM quran_words aw WHERE aw.ayah_id = a.id) AS ayah_text,
		       (SELECT mp.page_number FROM mushaf_line_items li JOIN mushaf_lines ml ON ml.id = li.line_id JOIN mushaf_pages mp ON mp.id = ml.page_id WHERE li.word_id = w.id LIMIT 1) AS page_number
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.normalized_search_text = $1
		ORDER BY w.id
		LIMIT $2 OFFSET $3
	`, normText, limit, offset)
	if err != nil {
		return err
	}
	defer oRows.Close()

	var occurrences []fiber.Map
	for oRows.Next() {
		var wid int64
		var sid, anum, wnum int16
		var pageNum *int16
		var wAr, sAr, tr, ayahTxt string
		if err := oRows.Scan(&wid, &wAr, &sid, &sAr, &anum, &wnum, &tr, &ayahTxt, &pageNum); err != nil {
			return err
		}
		occurrences = append(occurrences, fiber.Map{
			"word_id":        wid,
			"arabic_text":    wAr,
			"surah_id":       sid,
			"surah_name":     sAr,
			"ayah_number":    anum,
			"word_number":    wnum,
			"translation_id": tr,
			"ayah_text":      ayahTxt,
			"page_number":    pageNum,
		})
	}

	return c.JSON(fiber.Map{
		"word_id":         id,
		"arabic_text":     arabicText,
		"normalized_word": normText,
		"translation_id":  transID,
		"word_count":      wordCount,
		"surah_count":     surahCount,
		"makkiyah_count":  makkiyahCount,
		"madaniyah_count": madaniyahCount,
		"root": fiber.Map{
			"id":          rootID,
			"arabic_text": rootText,
			"count":       rootCount,
		},
		"variations":  variations,
		"top_surahs":  topSurahs,
		"occurrences": occurrences,
		"pagination": fiber.Map{
			"total":  wordCount,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *FrequencyHandler) GetTopFrequency(c *fiber.Ctx) error {
	setImmutableCache(c)
	kind := c.Query("kind", "words")
	limit, _ := parsePagination(c)

	if kind == "roots" {
		rows, err := h.Pool.Query(c.Context(), `
			SELECT r.id, r.arabic_text, count(DISTINCT wm.word_id) AS cnt, MIN(wm.word_id) AS sample_word_id
			FROM roots r
			JOIN word_morphology wm ON wm.root_id = r.id
			GROUP BY r.id, r.arabic_text
			ORDER BY cnt DESC, r.id
			LIMIT $1
		`, limit)
		if err != nil {
			return err
		}
		defer rows.Close()

		var out []fiber.Map
		for rows.Next() {
			var rid, sampleWID int64
			var rTxt string
			var cnt int
			if err := rows.Scan(&rid, &rTxt, &cnt, &sampleWID); err != nil {
				return err
			}
			out = append(out, fiber.Map{
				"root_id":        rid,
				"arabic_text":    rTxt,
				"count":          cnt,
				"sample_word_id": sampleWID,
			})
		}
		return c.JSON(fiber.Map{"kind": "roots", "data": out})
	}

	rows, err := h.Pool.Query(c.Context(), `
		WITH top_w AS (
			SELECT normalized_search_text, count(*) AS cnt, MIN(id) AS sample_word_id
			FROM quran_words
			WHERE normalized_search_text <> ''
			GROUP BY normalized_search_text
			ORDER BY cnt DESC
			LIMIT $1
		)
		SELECT tw.sample_word_id, sw.arabic_text, tw.normalized_search_text, tw.cnt,
		       COALESCE(wt.translation,''),
		       COALESCE((SELECT r.arabic_text FROM word_morphology wm JOIN roots r ON r.id = wm.root_id WHERE wm.word_id = sw.id AND wm.root_id IS NOT NULL ORDER BY wm.segment_number LIMIT 1), '')
		FROM top_w tw
		JOIN quran_words sw ON sw.id = tw.sample_word_id
		LEFT JOIN word_translations wt ON wt.word_id = sw.id AND wt.language_code = 'id'
		ORDER BY tw.cnt DESC
	`, limit)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var wid int64
		var ar, norm, tr, rootTxt string
		var cnt int
		if err := rows.Scan(&wid, &ar, &norm, &cnt, &tr, &rootTxt); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"word_id":         wid,
			"arabic_text":     ar,
			"normalized_word": norm,
			"count":           cnt,
			"translation_id":  tr,
			"root":            rootTxt,
		})
	}
	return c.JSON(fiber.Map{"kind": "words", "data": out})
}
