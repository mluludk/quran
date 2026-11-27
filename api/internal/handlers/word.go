package handlers

import (
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WordHandler struct {
	Pool *pgxpool.Pool
}

func (h *WordHandler) GetWord(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "word id")
	if err != nil {
		return err
	}

	var wid, aid int64
	var wnum, surahID, ayahNum int16
	var ar, surahName string
	var pageNum *int16
	err = h.Pool.QueryRow(c.Context(), `
		SELECT w.id, w.word_number, w.arabic_text, a.id, a.surah_id, s.name_arabic, a.ayah_number,
		       (SELECT mp.page_number
		        FROM mushaf_line_items li
		        JOIN mushaf_lines ml ON ml.id = li.line_id
		        JOIN mushaf_pages mp ON mp.id = ml.page_id
		        WHERE li.word_id = w.id LIMIT 1) AS page_number
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		WHERE w.id = $1
	`, id).Scan(&wid, &wnum, &ar, &aid, &surahID, &surahName, &ayahNum, &pageNum)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "word not found")
	}
	if err != nil {
		return err
	}

	var transID string
	_ = h.Pool.QueryRow(c.Context(), `
		SELECT COALESCE(translation,'') FROM word_translations WHERE word_id = $1 AND language_code = 'id' LIMIT 1
	`, id).Scan(&transID)

	morphSegs, err := h.fetchMorphology(c, id)
	if err != nil {
		return err
	}
	irabNodes, err := h.fetchWordIrab(c, id)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"word_id":        wid,
		"word_number":    wnum,
		"arabic_text":    ar,
		"ayah_id":        aid,
		"surah_id":       surahID,
		"surah_name":     surahName,
		"ayah_number":    ayahNum,
		"page_number":    pageNum,
		"translation_id": transID,
		"morphology":     morphSegs,
		"irab":           irabNodes,
	})
}

func (h *WordHandler) GetWordTranslation(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "word id")
	if err != nil {
		return err
	}
	lang := c.Query("lang", "id")

	rows, err := h.Pool.Query(c.Context(), `
		SELECT wt.language_code, wt.translation, s.name, s.version
		FROM word_translations wt
		JOIN annotation_sources s ON s.id = wt.source_id
		WHERE wt.word_id = $1 AND wt.language_code = $2
	`, id, lang)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var l, tr, sName, sVer string
		if err := rows.Scan(&l, &tr, &sName, &sVer); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"language_code": l,
			"translation":   tr,
			"source":        fiber.Map{"name": sName, "version": sVer},
		})
	}
	if len(out) == 0 {
		return fiber.NewError(fiber.StatusNotFound, "translation not found")
	}
	return c.JSON(fiber.Map{"word_id": id, "translations": out})
}

func (h *WordHandler) fetchMorphology(c *fiber.Ctx, wordID int) ([]fiber.Map, error) {
	rows, err := h.Pool.Query(c.Context(), `
		SELECT wm.segment_number, COALESCE(wm.segment_arabic,''), COALESCE(wm.pos,''),
		       wm.root_id, COALESCE(r.arabic_text,''), wm.lemma_id, COALESCE(l.arabic_text,''),
		       COALESCE(wm.morphology_data, '{}'::jsonb), s.name
		FROM word_morphology wm
		LEFT JOIN roots r ON r.id = wm.root_id
		LEFT JOIN lemmas l ON l.id = wm.lemma_id
		JOIN annotation_sources s ON s.id = wm.source_id
		WHERE wm.word_id = $1
		ORDER BY wm.segment_number
	`, wordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var segs []fiber.Map
	for rows.Next() {
		var segNum int16
		var segAr, pos, rootAr, lemAr, srcName string
		var rootID, lemID *int64
		var rawData []byte
		if err := rows.Scan(&segNum, &segAr, &pos, &rootID, &rootAr, &lemID, &lemAr, &rawData, &srcName); err != nil {
			return nil, err
		}
		var mData map[string]any
		_ = json.Unmarshal(rawData, &mData)
		segs = append(segs, fiber.Map{
			"segment_number": segNum,
			"segment_arabic": segAr,
			"pos":            pos,
			"root_id":        rootID,
			"root":           rootAr,
			"lemma_id":       lemID,
			"lemma":          lemAr,
			"data":           mData,
			"source":         srcName,
		})
	}
	return segs, nil
}

func (h *WordHandler) GetWordMorphology(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "word id")
	if err != nil {
		return err
	}
	segs, err := h.fetchMorphology(c, id)
	if err != nil {
		return err
	}
	if len(segs) == 0 {
		return fiber.NewError(fiber.StatusNotFound, "morphology not found")
	}
	return c.JSON(fiber.Map{"word_id": id, "segments": segs})
}

func (h *WordHandler) fetchWordIrab(c *fiber.Ctx, wordID int) ([]fiber.Map, error) {
	rows, err := h.Pool.Query(c.Context(), `
		SELECT n.id, n.segment_number, n.role_arabic, COALESCE(n.role_latin,''),
		       COALESCE(n.irab_status,''), COALESCE(n.irab_sign,''), COALESCE(n.amil,''),
		       COALESCE(n.explanation,''), ia.opinion_label, s.name
		FROM irab_word_nodes n
		JOIN irab_analyses ia ON ia.id = n.analysis_id
		JOIN irab_sources s ON s.id = ia.source_id
		WHERE n.word_id = $1
		ORDER BY ia.id, n.segment_number
	`, wordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []fiber.Map
	for rows.Next() {
		var nid int64
		var segNum int16
		var roleAr, roleLat, status, sign, amil, expl, opinion, srcName string
		if err := rows.Scan(&nid, &segNum, &roleAr, &roleLat, &status, &sign, &amil, &expl, &opinion, &srcName); err != nil {
			return nil, err
		}
		nodes = append(nodes, fiber.Map{
			"node_id":        nid,
			"segment_number": segNum,
			"role_arabic":    roleAr,
			"role_latin":     roleLat,
			"irab_status":    status,
			"irab_sign":      sign,
			"amil":           amil,
			"explanation":    expl,
			"opinion":        opinion,
			"source":         srcName,
		})
	}
	return nodes, nil
}

func (h *WordHandler) GetWordIrab(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "word id")
	if err != nil {
		return err
	}
	nodes, err := h.fetchWordIrab(c, id)
	if err != nil {
		return err
	}
	if len(nodes) == 0 {
		return fiber.NewError(fiber.StatusNotFound, "i'rab not found for word")
	}
	return c.JSON(fiber.Map{"word_id": id, "nodes": nodes})
}

func (h *WordHandler) GetRoot(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "root id")
	if err != nil {
		return err
	}
	var rootAr string
	var occCount int
	err = h.Pool.QueryRow(c.Context(), `
		SELECT r.arabic_text, count(DISTINCT wm.word_id)
		FROM roots r
		LEFT JOIN word_morphology wm ON wm.root_id = r.id
		WHERE r.id = $1
		GROUP BY r.id, r.arabic_text
	`, id).Scan(&rootAr, &occCount)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "root not found")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"id":               id,
		"arabic_text":      rootAr,
		"occurrence_count": occCount,
	})
}

func (h *WordHandler) GetRootOccurrences(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "root id")
	if err != nil {
		return err
	}
	limit, offset := parsePagination(c)

	var total int
	if err := h.Pool.QueryRow(c.Context(), `SELECT count(DISTINCT word_id) FROM word_morphology WHERE root_id = $1`, id).Scan(&total); err != nil {
		return err
	}

	rows, err := h.Pool.Query(c.Context(), `
		SELECT DISTINCT w.id, w.arabic_text, a.surah_id, s.name_arabic, a.ayah_number, w.word_number,
		       COALESCE(wt.translation,''),
		       (SELECT mp.page_number
		        FROM mushaf_line_items li
		        JOIN mushaf_lines ml ON ml.id = li.line_id
		        JOIN mushaf_pages mp ON mp.id = ml.page_id
		        WHERE li.word_id = w.id LIMIT 1) AS page_number
		FROM word_morphology wm
		JOIN quran_words w ON w.id = wm.word_id
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE wm.root_id = $1
		ORDER BY w.id
		LIMIT $2 OFFSET $3
	`, id, limit, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []fiber.Map
	for rows.Next() {
		var wid int64
		var surahID, ayahNum, wnum int16
		var pageNum *int16
		var ar, sName, tr string
		if err := rows.Scan(&wid, &ar, &surahID, &sName, &ayahNum, &wnum, &tr, &pageNum); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"word_id":        wid,
			"arabic_text":    ar,
			"surah_id":       surahID,
			"surah_name":     sName,
			"ayah_number":    ayahNum,
			"word_number":    wnum,
			"page_number":    pageNum,
			"translation_id": tr,
		})
	}
	return c.JSON(fiber.Map{
		"data": items,
		"pagination": fiber.Map{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *WordHandler) SearchArabic(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return fiber.NewError(fiber.StatusBadRequest, "query parameter q is required")
	}
	limit, offset := parsePagination(c)
	pattern := "%" + q + "%"

	var total int
	if err := h.Pool.QueryRow(c.Context(), `
		SELECT count(*) FROM quran_words
		WHERE normalized_search_text LIKE $1 OR arabic_text LIKE $1
	`, pattern).Scan(&total); err != nil {
		return err
	}

	rows, err := h.Pool.Query(c.Context(), `
		SELECT w.id, w.arabic_text, a.surah_id, s.name_arabic, a.ayah_number, w.word_number,
		       COALESCE(wt.translation,''),
		       (SELECT mp.page_number
		        FROM mushaf_line_items li
		        JOIN mushaf_lines ml ON ml.id = li.line_id
		        JOIN mushaf_pages mp ON mp.id = ml.page_id
		        WHERE li.word_id = w.id LIMIT 1) AS page_number
		FROM quran_words w
		JOIN ayahs a ON a.id = w.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.normalized_search_text LIKE $1 OR w.arabic_text LIKE $1
		ORDER BY w.id
		LIMIT $2 OFFSET $3
	`, pattern, limit, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []fiber.Map
	for rows.Next() {
		var wid int64
		var surahID, ayahNum, wnum int16
		var pageNum *int16
		var ar, sName, tr string
		if err := rows.Scan(&wid, &ar, &surahID, &sName, &ayahNum, &wnum, &tr, &pageNum); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"word_id":        wid,
			"arabic_text":    ar,
			"surah_id":       surahID,
			"surah_name":     sName,
			"ayah_number":    ayahNum,
			"word_number":    wnum,
			"page_number":    pageNum,
			"translation_id": tr,
		})
	}
	return c.JSON(fiber.Map{
		"data": items,
		"pagination": fiber.Map{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *WordHandler) SearchRoots(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return fiber.NewError(fiber.StatusBadRequest, "query parameter q is required")
	}
	limit, offset := parsePagination(c)
	pattern := "%" + q + "%"

	rows, err := h.Pool.Query(c.Context(), `
		SELECT r.id, r.arabic_text, count(DISTINCT wm.word_id) AS occ_count
		FROM roots r
		LEFT JOIN word_morphology wm ON wm.root_id = r.id
		WHERE r.arabic_text LIKE $1
		GROUP BY r.id, r.arabic_text
		ORDER BY occ_count DESC, r.id
		LIMIT $2 OFFSET $3
	`, pattern, limit, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []fiber.Map
	for rows.Next() {
		var id int64
		var ar string
		var cnt int
		if err := rows.Scan(&id, &ar, &cnt); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":               id,
			"arabic_text":      ar,
			"occurrence_count": cnt,
		})
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h *WordHandler) SearchLemmas(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return fiber.NewError(fiber.StatusBadRequest, "query parameter q is required")
	}
	limit, offset := parsePagination(c)
	pattern := "%" + q + "%"

	rows, err := h.Pool.Query(c.Context(), `
		SELECT l.id, l.arabic_text, count(DISTINCT wm.word_id) AS occ_count
		FROM lemmas l
		LEFT JOIN word_morphology wm ON wm.lemma_id = l.id
		WHERE l.arabic_text LIKE $1
		GROUP BY l.id, l.arabic_text
		ORDER BY occ_count DESC, l.id
		LIMIT $2 OFFSET $3
	`, pattern, limit, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []fiber.Map
	for rows.Next() {
		var id int64
		var ar string
		var cnt int
		if err := rows.Scan(&id, &ar, &cnt); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"id":               id,
			"arabic_text":      ar,
			"occurrence_count": cnt,
		})
	}
	return c.JSON(fiber.Map{"data": items})
}
