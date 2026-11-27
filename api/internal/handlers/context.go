package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContextHandler struct {
	Pool *pgxpool.Pool
}

func (h *ContextHandler) GetWordContext(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "word id")
	if err != nil {
		return err
	}
	pairRootID := c.QueryInt("pair_root_id", 0)
	meaning := strings.TrimSpace(c.Query("meaning"))
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
	_ = h.Pool.QueryRow(c.Context(), `
		SELECT r.id, r.arabic_text
		FROM word_morphology wm
		JOIN roots r ON r.id = wm.root_id
		WHERE wm.word_id = $1 AND wm.root_id IS NOT NULL
		ORDER BY wm.segment_number
		LIMIT 1
	`, id).Scan(&rootID, &rootText)

	// 1. Contextual translation nuances
	mRows, err := h.Pool.Query(c.Context(), `
		SELECT wt.translation, count(*) AS cnt
		FROM quran_words w
		JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.normalized_search_text = $1 AND wt.translation <> ''
		GROUP BY wt.translation
		ORDER BY cnt DESC, wt.translation
		LIMIT 20
	`, normText)
	if err != nil {
		return err
	}
	var meaningGroups []fiber.Map
	for mRows.Next() {
		var tr string
		var cnt int
		if err := mRows.Scan(&tr, &cnt); err != nil {
			mRows.Close()
			return err
		}
		meaningGroups = append(meaningGroups, fiber.Map{"translation": tr, "count": cnt})
	}
	mRows.Close()

	// 2. Co-occurring roots in the same ayah (collocations)
	cRows, err := h.Pool.Query(c.Context(), `
		WITH target_ayahs AS (
			SELECT DISTINCT ayah_id FROM quran_words WHERE normalized_search_text = $1
		)
		SELECT r.id, r.arabic_text, count(DISTINCT w2.ayah_id) AS ayah_cnt,
		       MIN(w2.arabic_text) AS sample_ar,
		       COALESCE(MIN(wt2.translation), '') AS sample_tr
		FROM target_ayahs ta
		JOIN quran_words w2 ON w2.ayah_id = ta.ayah_id
		JOIN word_morphology wm2 ON wm2.word_id = w2.id AND wm2.root_id IS NOT NULL
		JOIN roots r ON r.id = wm2.root_id
		LEFT JOIN word_translations wt2 ON wt2.word_id = w2.id AND wt2.language_code = 'id'
		WHERE ($2::bigint IS NULL OR r.id <> $2)
		GROUP BY r.id, r.arabic_text
		ORDER BY ayah_cnt DESC, r.id
		LIMIT 18
	`, normText, rootID)
	if err != nil {
		return err
	}
	var collocations []fiber.Map
	for cRows.Next() {
		var rid int64
		var rTxt, sAr, sTr string
		var cnt int
		if err := cRows.Scan(&rid, &rTxt, &cnt, &sAr, &sTr); err != nil {
			cRows.Close()
			return err
		}
		collocations = append(collocations, fiber.Map{
			"root_id":            rid,
			"root_text":          rTxt,
			"ayah_count":         cnt,
			"sample_arabic":      sAr,
			"sample_translation": sTr,
		})
	}
	cRows.Close()

	// 3. Filtered contextual ayahs
	var total int
	err = h.Pool.QueryRow(c.Context(), `
		SELECT count(DISTINCT a.id)
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.normalized_search_text = $1
		  AND ($2 = '' OR wt.translation = $2)
		  AND ($3 = 0 OR EXISTS (
		    SELECT 1 FROM quran_words w2
		    JOIN word_morphology wm2 ON wm2.word_id = w2.id
		    WHERE w2.ayah_id = a.id AND wm2.root_id = $3
		  ))
	`, normText, meaning, pairRootID).Scan(&total)
	if err != nil {
		return err
	}

	aRows, err := h.Pool.Query(c.Context(), `
		SELECT DISTINCT a.id, a.surah_id, s.name_arabic, a.ayah_number,
		       w.id, w.arabic_text, COALESCE(wt.translation,''),
		       (SELECT string_agg(aw.arabic_text, ' ' ORDER BY aw.word_number) FROM quran_words aw WHERE aw.ayah_id = a.id) AS ayah_text,
		       (SELECT mp.page_number FROM mushaf_line_items li JOIN mushaf_lines ml ON ml.id = li.line_id JOIN mushaf_pages mp ON mp.id = ml.page_id WHERE li.word_id = w.id LIMIT 1) AS page_number
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.normalized_search_text = $1
		  AND ($2 = '' OR wt.translation = $2)
		  AND ($3 = 0 OR EXISTS (
		    SELECT 1 FROM quran_words w2
		    JOIN word_morphology wm2 ON wm2.word_id = w2.id
		    WHERE w2.ayah_id = a.id AND wm2.root_id = $3
		  ))
		ORDER BY a.id, w.id
		LIMIT $4 OFFSET $5
	`, normText, meaning, pairRootID, limit, offset)
	if err != nil {
		return err
	}
	defer aRows.Close()

	var ayahs []fiber.Map
	for aRows.Next() {
		var aid, wid int64
		var sid, anum int16
		var pageNum *int16
		var sName, wAr, tr, ayahTxt string
		if err := aRows.Scan(&aid, &sid, &sName, &anum, &wid, &wAr, &tr, &ayahTxt, &pageNum); err != nil {
			return err
		}
		ayahs = append(ayahs, fiber.Map{
			"ayah_id":        aid,
			"surah_id":       sid,
			"surah_name":     sName,
			"ayah_number":    anum,
			"word_id":        wid,
			"word_arabic":    wAr,
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
		"root":            fiber.Map{"id": rootID, "arabic_text": rootText},
		"meaning_groups":  meaningGroups,
		"collocations":    collocations,
		"ayahs":           ayahs,
		"pagination":      fiber.Map{"total": total, "limit": limit, "offset": offset},
	})
}
