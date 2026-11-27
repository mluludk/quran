package handlers

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type QuranHandler struct {
	Pool *pgxpool.Pool
}

func (h *QuranHandler) ListSurahs(c *fiber.Ctx) error {
	setImmutableCache(c)
	rows, err := h.Pool.Query(c.Context(), `
		SELECT s.id, s.name_arabic, COALESCE(s.name_transliteration,''), COALESCE(s.name_translation,''),
		       COALESCE(s.revelation_type,''), s.ayah_count,
		       COALESCE((
		         SELECT MIN(mp.page_number)
		         FROM ayahs a
		         JOIN mushaf_line_items li ON li.ayah_id = a.id
		         JOIN mushaf_lines ml ON ml.id = li.line_id
		         JOIN mushaf_pages mp ON mp.id = ml.page_id
		         WHERE a.surah_id = s.id
		       ), 1) AS first_page
		FROM surahs s
		ORDER BY s.id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var id, ayahCount, firstPage int16
		var ar, tr, trans, rev string
		if err := rows.Scan(&id, &ar, &tr, &trans, &rev, &ayahCount, &firstPage); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"id":                   id,
			"name_arabic":          ar,
			"name_transliteration": tr,
			"name_translation":     trans,
			"revelation_type":      rev,
			"ayah_count":           ayahCount,
			"first_page":           firstPage,
		})
	}
	return c.JSON(fiber.Map{"data": out})
}

func (h *QuranHandler) ListJuz(c *fiber.Ctx) error {
	setImmutableCache(c)
	rows, err := h.Pool.Query(c.Context(), `
		SELECT mp.juz_number, MIN(mp.page_number) AS first_page
		FROM mushaf_pages mp
		WHERE mp.juz_number IS NOT NULL
		GROUP BY mp.juz_number
		ORDER BY mp.juz_number
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var juz, firstPage int16
		if err := rows.Scan(&juz, &firstPage); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"juz_number": juz,
			"first_page": firstPage,
		})
	}
	return c.JSON(fiber.Map{"data": out})
}

func (h *QuranHandler) GetSurah(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "surah id")
	if err != nil {
		return err
	}
	var surahID, ayahCount int16
	var ar, tr, trans, rev string
	err = h.Pool.QueryRow(c.Context(), `
		SELECT id, name_arabic, COALESCE(name_transliteration,''), COALESCE(name_translation,''),
		       COALESCE(revelation_type,''), ayah_count
		FROM surahs WHERE id = $1
	`, id).Scan(&surahID, &ar, &tr, &trans, &rev, &ayahCount)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "surah not found")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"id":                   surahID,
		"name_arabic":          ar,
		"name_transliteration": tr,
		"name_translation":     trans,
		"revelation_type":      rev,
		"ayah_count":           ayahCount,
	})
}

func (h *QuranHandler) ListSurahAyahs(c *fiber.Ctx) error {
	setImmutableCache(c)
	id, err := parsePositiveInt(c.Params("id"), "surah id")
	if err != nil {
		return err
	}
	limit, offset := parsePagination(c)

	var total int
	if err := h.Pool.QueryRow(c.Context(), `SELECT count(*) FROM ayahs WHERE surah_id = $1`, id).Scan(&total); err != nil {
		return err
	}
	if total == 0 {
		return fiber.NewError(fiber.StatusNotFound, "surah not found")
	}

	rows, err := h.Pool.Query(c.Context(), `
		SELECT a.id, a.ayah_number, a.juz_number, a.hizb_number,
		       COALESCE(string_agg(w.arabic_text, ' ' ORDER BY w.word_number), '') AS text_uthmani
		FROM ayahs a
		LEFT JOIN quran_words w ON w.ayah_id = a.id
		WHERE a.surah_id = $1
		GROUP BY a.id, a.ayah_number, a.juz_number, a.hizb_number
		ORDER BY a.ayah_number
		LIMIT $2 OFFSET $3
	`, id, limit, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	var ayahs []fiber.Map
	for rows.Next() {
		var ayahID int64
		var ayahNum int16
		var juz, hizb *int16
		var txt string
		if err := rows.Scan(&ayahID, &ayahNum, &juz, &hizb, &txt); err != nil {
			return err
		}
		ayahs = append(ayahs, fiber.Map{
			"id":          ayahID,
			"surah_id":    id,
			"ayah_number": ayahNum,
			"juz_number":  juz,
			"hizb_number": hizb,
			"arabic_text": txt,
		})
	}
	return c.JSON(fiber.Map{
		"data": ayahs,
		"pagination": fiber.Map{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *QuranHandler) GetAyah(c *fiber.Ctx) error {
	setImmutableCache(c)
	surahID, err := parsePositiveInt(c.Params("surah"), "surah")
	if err != nil {
		return err
	}
	ayahNum, err := parsePositiveInt(c.Params("ayah"), "ayah")
	if err != nil {
		return err
	}

	var ayahID int64
	var juz, hizb *int16
	err = h.Pool.QueryRow(c.Context(), `
		SELECT id, juz_number, hizb_number
		FROM ayahs WHERE surah_id = $1 AND ayah_number = $2
	`, surahID, ayahNum).Scan(&ayahID, &juz, &hizb)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "ayah not found")
	}
	if err != nil {
		return err
	}

	rows, err := h.Pool.Query(c.Context(), `
		SELECT w.id, w.word_number, w.arabic_text,
		       COALESCE(wt.translation, '')
		FROM quran_words w
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.ayah_id = $1
		ORDER BY w.word_number
	`, ayahID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var words []fiber.Map
	for rows.Next() {
		var wid int64
		var wnum int16
		var ar, tr string
		if err := rows.Scan(&wid, &wnum, &ar, &tr); err != nil {
			return err
		}
		words = append(words, fiber.Map{
			"word_id":        wid,
			"word_number":    wnum,
			"arabic_text":    ar,
			"translation_id": tr,
		})
	}
	return c.JSON(fiber.Map{
		"id":          ayahID,
		"surah_id":    surahID,
		"ayah_number": ayahNum,
		"juz_number":  juz,
		"hizb_number": hizb,
		"words":       words,
	})
}

func (h *QuranHandler) GetAyahIrab(c *fiber.Ctx) error {
	setImmutableCache(c)
	surahID, err := parsePositiveInt(c.Params("surah"), "surah")
	if err != nil {
		return err
	}
	ayahNum, err := parsePositiveInt(c.Params("ayah"), "ayah")
	if err != nil {
		return err
	}

	var ayahID int64
	err = h.Pool.QueryRow(c.Context(), `SELECT id FROM ayahs WHERE surah_id = $1 AND ayah_number = $2`, surahID, ayahNum).Scan(&ayahID)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "ayah not found")
	}
	if err != nil {
		return err
	}

	wRows, err := h.Pool.Query(c.Context(), `
		SELECT w.id, w.word_number, w.arabic_text, COALESCE(wt.translation, '')
		FROM quran_words w
		LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.language_code = 'id'
		WHERE w.ayah_id = $1
		ORDER BY w.word_number
	`, ayahID)
	if err != nil {
		return err
	}
	var words []fiber.Map
	for wRows.Next() {
		var wid int64
		var wnum int16
		var ar, tr string
		if err := wRows.Scan(&wid, &wnum, &ar, &tr); err != nil {
			wRows.Close()
			return err
		}
		words = append(words, fiber.Map{
			"word_id":        wid,
			"word_number":    wnum,
			"arabic_text":    ar,
			"translation_id": tr,
		})
	}
	wRows.Close()

	rows, err := h.Pool.Query(c.Context(), `
		SELECT ia.id, ia.opinion_label, COALESCE(ia.summary,''), s.name, COALESCE(s.author,'')
		FROM irab_analyses ia
		JOIN irab_sources s ON s.id = ia.source_id
		WHERE ia.ayah_id = $1
		ORDER BY ia.id
	`, ayahID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var analyses []fiber.Map
	for rows.Next() {
		var aid int64
		var label, summary, srcName, author string
		if err := rows.Scan(&aid, &label, &summary, &srcName, &author); err != nil {
			return err
		}

		nRows, err := h.Pool.Query(c.Context(), `
			SELECT n.id, n.word_id, w.word_number, w.arabic_text, n.segment_number, n.sequence_order,
			       n.role_arabic, COALESCE(n.role_latin,''), COALESCE(n.irab_status,''),
			       COALESCE(n.irab_sign,''), COALESCE(n.amil,''), COALESCE(n.explanation,'')
			FROM irab_word_nodes n
			JOIN quran_words w ON w.id = n.word_id
			WHERE n.analysis_id = $1
			ORDER BY n.sequence_order
		`, aid)
		if err != nil {
			return err
		}
		var nodes []fiber.Map
		for nRows.Next() {
			var nid, wid int64
			var wnum, segNum, seq int16
			var ar, roleAr, roleLat, status, sign, amil, expl string
			if err := nRows.Scan(&nid, &wid, &wnum, &ar, &segNum, &seq, &roleAr, &roleLat, &status, &sign, &amil, &expl); err != nil {
				nRows.Close()
				return err
			}
			nodes = append(nodes, fiber.Map{
				"node_id":        nid,
				"word_id":        wid,
				"word_number":    wnum,
				"arabic_text":    ar,
				"segment_number": segNum,
				"sequence_order": seq,
				"role_arabic":    roleAr,
				"role_latin":     roleLat,
				"irab_status":    status,
				"irab_sign":      sign,
				"amil":           amil,
				"explanation":    expl,
			})
		}
		nRows.Close()

		rRows, err := h.Pool.Query(c.Context(), `
			SELECT r.id, r.source_node_id, r.target_node_id, sn.word_id, tn.word_id,
			       r.relation_type, COALESCE(r.description,'')
			FROM irab_relations r
			JOIN irab_word_nodes sn ON sn.id = r.source_node_id
			JOIN irab_word_nodes tn ON tn.id = r.target_node_id
			WHERE r.analysis_id = $1
			ORDER BY r.id
		`, aid)
		if err != nil {
			return err
		}
		var relations []fiber.Map
		for rRows.Next() {
			var rid, srcNid, tgtNid, srcWid, tgtWid int64
			var relType, desc string
			if err := rRows.Scan(&rid, &srcNid, &tgtNid, &srcWid, &tgtWid, &relType, &desc); err != nil {
				rRows.Close()
				return err
			}
			relations = append(relations, fiber.Map{
				"id":             rid,
				"source_node_id": srcNid,
				"target_node_id": tgtNid,
				"source_word_id": srcWid,
				"target_word_id": tgtWid,
				"relation_type":  relType,
				"description":    desc,
			})
		}
		rRows.Close()

		pRows, err := h.Pool.Query(c.Context(), `
			SELECT id, phrase_type, phrase_arabic, phrase_latin, start_word_id, end_word_id,
			       COALESCE(mahal_irab,''), COALESCE(explanation,'')
			FROM irab_phrases
			WHERE analysis_id = $1
			ORDER BY start_word_id, end_word_id, id
		`, aid)
		if err != nil {
			return err
		}
		var phrases []fiber.Map
		for pRows.Next() {
			var pid, swid, ewid int64
			var ptype, par, plat, mahal, expl string
			if err := pRows.Scan(&pid, &ptype, &par, &plat, &swid, &ewid, &mahal, &expl); err != nil {
				pRows.Close()
				return err
			}
			phrases = append(phrases, fiber.Map{
				"id":            pid,
				"phrase_type":   ptype,
				"phrase_arabic": par,
				"phrase_latin":  plat,
				"start_word_id": swid,
				"end_word_id":   ewid,
				"mahal_irab":    mahal,
				"explanation":   expl,
			})
		}
		pRows.Close()

		analyses = append(analyses, fiber.Map{
			"analysis_id":   aid,
			"opinion_label": label,
			"summary":       summary,
			"source":        fiber.Map{"name": srcName, "author": author},
			"nodes":         nodes,
			"relations":     relations,
			"phrases":       phrases,
		})
	}

	return c.JSON(fiber.Map{
		"ayah_id":     ayahID,
		"surah_id":    surahID,
		"ayah_number": ayahNum,
		"words":       words,
		"analyses":    analyses,
	})
}

func (h *QuranHandler) ListEditions(c *fiber.Ctx) error {
	setImmutableCache(c)
	rows, err := h.Pool.Query(c.Context(), `
		SELECT code, name, riwayah, page_count, target_lines_per_page, COALESCE(source_version,'')
		FROM mushaf_editions ORDER BY id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var code, name, riwayah, srcVer string
		var pageCount int16
		var targetLines *int16
		if err := rows.Scan(&code, &name, &riwayah, &pageCount, &targetLines, &srcVer); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"code":                  code,
			"name":                  name,
			"riwayah":               riwayah,
			"page_count":            pageCount,
			"target_lines_per_page": targetLines,
			"source_version":        srcVer,
		})
	}
	return c.JSON(fiber.Map{"data": out})
}

func parseGlyphCodes(raw string) []int {
	if raw == "" {
		return nil
	}
	parts := strings.Fields(raw)
	codes := make([]int, 0, len(parts))
	for _, p := range parts {
		if v, err := strconv.Atoi(p); err == nil {
			codes = append(codes, v)
		}
	}
	return codes
}

func (h *QuranHandler) GetPage(c *fiber.Ctx) error {
	setImmutableCache(c)
	pageNum, err := parsePositiveInt(c.Params("page"), "page")
	if err != nil || pageNum > 604 {
		return fiber.NewError(fiber.StatusBadRequest, "page must be between 1 and 604")
	}
	edition := c.Query("edition", "madinah-hafs-604")

	var pageID int64
	var juz, hizb *int16
	var fontKey string
	err = h.Pool.QueryRow(c.Context(), `
		SELECT p.id, p.juz_number, p.hizb_number, COALESCE(p.font_asset_key, '')
		FROM mushaf_pages p
		JOIN mushaf_editions e ON e.id = p.edition_id
		WHERE e.code = $1 AND p.page_number = $2
	`, edition, pageNum).Scan(&pageID, &juz, &hizb, &fontKey)
	if err == pgx.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "page not found")
	}
	if err != nil {
		return err
	}

	sRows, err := h.Pool.Query(c.Context(), `
		SELECT s.id, s.name_arabic, MIN(a.ayah_number), MAX(a.ayah_number)
		FROM mushaf_lines l
		JOIN mushaf_line_items li ON li.line_id = l.id
		JOIN ayahs a ON a.id = li.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		WHERE l.page_id = $1
		GROUP BY s.id, s.name_arabic
		ORDER BY s.id
	`, pageID)
	if err != nil {
		return err
	}
	var surahsOnPage []fiber.Map
	for sRows.Next() {
		var sid, firstA, lastA int16
		var nameAr string
		if err := sRows.Scan(&sid, &nameAr, &firstA, &lastA); err != nil {
			sRows.Close()
			return err
		}
		surahsOnPage = append(surahsOnPage, fiber.Map{
			"id":          sid,
			"name_arabic": nameAr,
			"first_ayah":  firstA,
			"last_ayah":   lastA,
		})
	}
	sRows.Close()

	iRows, err := h.Pool.Query(c.Context(), `
		SELECT l.line_number, COALESCE(l.line_type,''), l.is_centered,
		       li.item_type, li.word_id, li.surah_id, li.ayah_id, li.position_in_line,
		       COALESCE(li.display_text,''), COALESCE(li.source_glyph_code,''),
		       a.ayah_number, COALESCE(wt.translation,''),
		       CASE
		         WHEN li.word_id IS NULL THEN NULL
		         ELSE (
		           SELECT mp.page_number
		           FROM quran_words pw
		           JOIN mushaf_line_items pli ON pli.word_id = pw.id
		           JOIN mushaf_lines pml ON pml.id = pli.line_id
		           JOIN mushaf_pages mp ON mp.id = pml.page_id
		           WHERE pw.normalized_search_text = w.normalized_search_text
		             AND pw.id < w.id
		           ORDER BY pw.id ASC
		           LIMIT 1
		         )
		       END AS first_occurrence_page,
		       COALESCE((
		         SELECT string_agg(DISTINCT
		           CASE
		             WHEN n.role_latin = 'Mubtada''' THEN 'mubtada'
		             WHEN n.role_latin LIKE '%Khabar%' THEN 'khabar'
		             WHEN n.role_latin LIKE '%Fa''il%' THEN 'fail'
		             WHEN n.role_latin LIKE '%Maf''ul%' THEN 'maful'
		             WHEN n.role_latin = 'Harf Jar' THEN 'harf_jar'
		             WHEN n.role_latin = 'Ism Majrur' THEN 'ism_majrur'
		             WHEN n.role_latin IN ('Harf Nasikh','Fi''il Madhi','Fi''il Mudhari''','Fi''il Amr','Fi''il Naqish','Fi''il Madhi Majhul','Fi''il Mudhari'' Majhul') THEN 'amil'
		             ELSE ''
		           END, ','
		         )
		         FROM irab_word_nodes n
		         WHERE n.word_id = li.word_id
		       ), '') AS grammar_roles_raw
		FROM mushaf_lines l
		JOIN mushaf_line_items li ON li.line_id = l.id
		LEFT JOIN quran_words w ON w.id = li.word_id
		LEFT JOIN ayahs a ON a.id = li.ayah_id
		LEFT JOIN word_translations wt ON wt.word_id = li.word_id AND wt.language_code = 'id'
		WHERE l.page_id = $1
		ORDER BY l.line_number, li.position_in_line
	`, pageID)
	if err != nil {
		return err
	}
	defer iRows.Close()

	type lineAcc struct {
		LineNumber int16       `json:"line_number"`
		LineType   string      `json:"line_type"`
		IsCentered bool        `json:"is_centered"`
		Items      []fiber.Map `json:"items"`
	}
	var lines []*lineAcc
	lineMap := make(map[int16]*lineAcc)

	for iRows.Next() {
		var lineNum, pos int16
		var lineType, itemType, dispTxt, glyphRaw, transID, grammarRaw string
		var isCentered bool
		var wordID, ayahID *int64
		var surahID, ayahNum, firstOccPage *int16
		if err := iRows.Scan(&lineNum, &lineType, &isCentered, &itemType, &wordID, &surahID, &ayahID, &pos, &dispTxt, &glyphRaw, &ayahNum, &transID, &firstOccPage, &grammarRaw); err != nil {
			return err
		}
		la, ok := lineMap[lineNum]
		if !ok {
			la = &lineAcc{LineNumber: lineNum, LineType: lineType, IsCentered: isCentered}
			lineMap[lineNum] = la
			lines = append(lines, la)
		}
		var grammarRoles []string
		for _, g := range strings.Split(grammarRaw, ",") {
			if g != "" {
				grammarRoles = append(grammarRoles, g)
			}
		}
		isFirstOcc := wordID != nil && firstOccPage == nil
		la.Items = append(la.Items, fiber.Map{
			"item_type":             itemType,
			"word_id":               wordID,
			"surah_id":              surahID,
			"ayah_id":               ayahID,
			"ayah_number":           ayahNum,
			"position":              pos,
			"display_text":          dispTxt,
			"source_glyph_code":     glyphRaw,
			"glyph_codes":           parseGlyphCodes(glyphRaw),
			"translation_id":        transID,
			"is_first_occurrence":   isFirstOcc,
			"first_occurrence_page": firstOccPage,
			"grammar_roles":         grammarRoles,
		})
	}

	return c.JSON(fiber.Map{
		"edition":        edition,
		"page_number":    pageNum,
		"juz_number":     juz,
		"hizb_number":    hizb,
		"font_asset_key": fontKey,
		"surahs_on_page": surahsOnPage,
		"lines":          lines,
	})
}
