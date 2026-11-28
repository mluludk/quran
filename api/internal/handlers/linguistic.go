package handlers

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LinguisticHandler struct {
	Pool *pgxpool.Pool
}

// GetIrabValidationSummary returns dataset-wide i'rab validation status, confidence, and review queue.
func (h *LinguisticHandler) GetIrabValidationSummary(c *fiber.Ctx) error {
	setImmutableCache(c)

	var totalAnalyses, altCount int64
	var avgConf float64
	err := h.Pool.QueryRow(c.Context(), `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE opinion_label <> 'primary' AND opinion_label <> 'masaq_quran'),
		       COALESCE(ROUND(AVG(confidence_score)::numeric, 3)::float8, 0)
		FROM irab_analyses
	`).Scan(&totalAnalyses, &altCount, &avgConf)
	if err != nil {
		return err
	}

	sRows, err := h.Pool.Query(c.Context(), `
		SELECT validation_status, COUNT(*) AS cnt, ROUND(AVG(confidence_score)::numeric, 3)::float8
		FROM irab_analyses
		GROUP BY validation_status
		ORDER BY cnt DESC
	`)
	if err != nil {
		return err
	}
	defer sRows.Close()

	var byStatus []fiber.Map
	for sRows.Next() {
		var st string
		var cnt int64
		var avg float64
		if err := sRows.Scan(&st, &cnt, &avg); err != nil {
			return err
		}
		byStatus = append(byStatus, fiber.Map{
			"status":         st,
			"count":          cnt,
			"avg_confidence": avg,
		})
	}

	rRows, err := h.Pool.Query(c.Context(), `
		SELECT a.surah_id, s.name_transliteration, a.ayah_number, ia.confidence_score::float8, COALESCE(ia.validation_notes,'')
		FROM irab_analyses ia
		JOIN ayahs a ON a.id = ia.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		WHERE ia.validation_status = 'needs_review'
		ORDER BY a.surah_id, a.ayah_number
		LIMIT 20
	`)
	if err != nil {
		return err
	}
	defer rRows.Close()

	var reviewQueue []fiber.Map
	for rRows.Next() {
		var sid int16
		var sName, notes string
		var anum int16
		var conf float64
		if err := rRows.Scan(&sid, &sName, &anum, &conf, &notes); err != nil {
			return err
		}
		reviewQueue = append(reviewQueue, fiber.Map{
			"surah_id":         sid,
			"surah_name":       sName,
			"ayah_number":      anum,
			"confidence_score": conf,
			"notes":            notes,
		})
	}

	return c.JSON(fiber.Map{
		"total_analyses":       totalAnalyses,
		"alternative_opinions": altCount,
		"avg_confidence":       avgConf,
		"by_status":            byStatus,
		"needs_review_sample":  reviewQueue,
	})
}

// ExploreSarf returns morphological/wazan distributions and filtered Quranic words for Sarf Explorer.
func (h *LinguisticHandler) ExploreSarf(c *fiber.Ctx) error {
	setImmutableCache(c)

	posFilter := strings.TrimSpace(c.Query("pos"))
	tagFilter := strings.TrimSpace(c.Query("tag"))
	q := strings.TrimSpace(c.Query("q"))
	limit, _ := strconv.Atoi(c.Query("limit", "24"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit <= 0 || limit > 60 {
		limit = 24
	}
	if offset < 0 {
		offset = 0
	}

	// POS distribution
	posRows, err := h.Pool.Query(c.Context(), `
		SELECT COALESCE(pos, 'OTHER') AS pos, COUNT(*) AS cnt
		FROM word_morphology
		GROUP BY COALESCE(pos, 'OTHER')
		ORDER BY cnt DESC
		LIMIT 12
	`)
	if err != nil {
		return err
	}
	var posSummary []fiber.Map
	for posRows.Next() {
		var pos string
		var cnt int64
		if err := posRows.Scan(&pos, &cnt); err != nil {
			posRows.Close()
			return err
		}
		posSummary = append(posSummary, fiber.Map{"pos": pos, "count": cnt})
	}
	posRows.Close()

	// Verb form (VF:1 .. VF:12) distribution
	vfRows, err := h.Pool.Query(c.Context(), `
		SELECT (regexp_match(morphology_data->>'tags', '(VF:[0-9]+)'))[1] AS vf, COUNT(*) AS cnt
		FROM word_morphology
		WHERE morphology_data->>'tags' ~ 'VF:[0-9]+'
		GROUP BY vf
		ORDER BY cnt DESC
	`)
	if err != nil {
		return err
	}
	var vfSummary []fiber.Map
	for vfRows.Next() {
		var vf string
		var cnt int64
		if err := vfRows.Scan(&vf, &cnt); err != nil {
			vfRows.Close()
			return err
		}
		vfSummary = append(vfSummary, fiber.Map{"tag": vf, "count": cnt})
	}
	vfRows.Close()

	// Dynamic filter
	conds := []string{"wm.lemma_id IS NOT NULL"}
	args := []any{}
	argIdx := 1

	if posFilter != "" {
		conds = append(conds, fmt.Sprintf("wm.pos = $%d", argIdx))
		args = append(args, posFilter)
		argIdx++
	}
	if tagFilter != "" {
		conds = append(conds, fmt.Sprintf("wm.morphology_data->>'tags' LIKE $%d", argIdx))
		args = append(args, "%"+tagFilter+"%")
		argIdx++
	}
	if q != "" {
		conds = append(conds, fmt.Sprintf("(qw.normalized_search_text LIKE $%d OR l.arabic_text LIKE $%d OR r.arabic_text LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+q+"%")
		argIdx++
	}

	whereSQL := strings.Join(conds, " AND ")

	var total int64
	countSQL := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM word_morphology wm
		JOIN quran_words qw ON qw.id = wm.word_id
		LEFT JOIN lemmas l ON l.id = wm.lemma_id
		LEFT JOIN roots r ON r.id = wm.root_id
		WHERE %s
	`, whereSQL)
	if err := h.Pool.QueryRow(c.Context(), countSQL, args...).Scan(&total); err != nil {
		return err
	}

	listArgs := append(append([]any{}, args...), limit, offset)
	listSQL := fmt.Sprintf(`
		SELECT wm.word_id, qw.arabic_text, COALESCE(wt.translation,''), COALESCE(wm.pos,''),
		       COALESCE(l.arabic_text,''), COALESCE(r.arabic_text,''),
		       COALESCE(wm.morphology_data->>'tags',''),
		       a.surah_id, s.name_transliteration, a.ayah_number, qw.word_number,
		       wm.segment_number, COALESCE(wm.segment_arabic,''),
		       COALESCE((SELECT string_agg(COALESCE(wm2.segment_arabic,''), '|' ORDER BY wm2.segment_number)
		                 FROM word_morphology wm2 WHERE wm2.word_id = wm.word_id), '')
		FROM word_morphology wm
		JOIN quran_words qw ON qw.id = wm.word_id
		JOIN ayahs a ON a.id = qw.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = qw.id AND wt.language_code = 'id'
		LEFT JOIN lemmas l ON l.id = wm.lemma_id
		LEFT JOIN roots r ON r.id = wm.root_id
		WHERE %s
		ORDER BY wm.word_id, wm.segment_number
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	rows, err := h.Pool.Query(c.Context(), listSQL, listArgs...)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []fiber.Map
	for rows.Next() {
		var wid int64
		var ar, tr, pos, lem, rt, tags, sName, segAr, allSegs string
		var sid, anum, wnum, segNum int16
		if err := rows.Scan(&wid, &ar, &tr, &pos, &lem, &rt, &tags, &sid, &sName, &anum, &wnum, &segNum, &segAr, &allSegs); err != nil {
			return err
		}
		items = append(items, fiber.Map{
			"word_id":        wid,
			"arabic_text":    ar,
			"translation_id": tr,
			"pos":            pos,
			"lemma":          lem,
			"root":           rt,
			"tags":           tags,
			"surah_id":       sid,
			"surah_name":     sName,
			"ayah_number":    anum,
			"word_number":    wnum,
			"segment_number": segNum,
			"segment_arabic": segAr,
			"all_segments":   allSegs,
		})
	}

	return c.JSON(fiber.Map{
		"summary": fiber.Map{
			"pos_counts":       posSummary,
			"verb_form_counts": vfSummary,
		},
		"items": items,
		"pagination": fiber.Map{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}
