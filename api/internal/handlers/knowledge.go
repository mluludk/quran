package handlers

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type KnowledgeHandler struct {
	Pool *pgxpool.Pool
}

const defaultKnowledgeUserID = "00000000-0000-0000-0000-000000000001"

func (h *KnowledgeHandler) GetOverview(c *fiber.Ctx) error {
	setImmutableCache(c)

	cRows, err := h.Pool.Query(c.Context(), `
		SELECT id, slug, name_arabic, name_latin, category, summary, source_attribution, COALESCE(root_text,'')
		FROM knowledge_concepts
		ORDER BY id
	`)
	if err != nil {
		return err
	}
	var concepts []fiber.Map
	for cRows.Next() {
		var id int64
		var slug, ar, lat, cat, sum, src, rt string
		if err := cRows.Scan(&id, &slug, &ar, &lat, &cat, &sum, &src, &rt); err != nil {
			cRows.Close()
			return err
		}
		concepts = append(concepts, fiber.Map{
			"id":                 id,
			"slug":               slug,
			"name_arabic":        ar,
			"name_latin":         lat,
			"category":           cat,
			"summary":            sum,
			"source_attribution": src,
			"root_text":          rt,
		})
	}
	cRows.Close()

	lRows, err := h.Pool.Query(c.Context(), `
		SELECT l.id, c1.slug, c2.slug, c1.name_arabic, c2.name_arabic, l.relation_type, l.description
		FROM knowledge_concept_links l
		JOIN knowledge_concepts c1 ON c1.id = l.source_concept_id
		JOIN knowledge_concepts c2 ON c2.id = l.target_concept_id
		ORDER BY l.id
	`)
	if err != nil {
		return err
	}
	var links []fiber.Map
	for lRows.Next() {
		var id int64
		var sSlug, tSlug, sAr, tAr, rel, desc string
		if err := lRows.Scan(&id, &sSlug, &tSlug, &sAr, &tAr, &rel, &desc); err != nil {
			lRows.Close()
			return err
		}
		links = append(links, fiber.Map{
			"id":            id,
			"source_slug":   sSlug,
			"target_slug":   tSlug,
			"source_arabic": sAr,
			"target_arabic": tAr,
			"relation_type": rel,
			"description":   desc,
		})
	}
	lRows.Close()

	tRows, err := h.Pool.Query(c.Context(), `
		SELECT t.id, t.slug, t.title, t.description, COUNT(ta.id) AS ayah_count
		FROM knowledge_themes t
		LEFT JOIN knowledge_theme_ayahs ta ON ta.theme_id = t.id
		GROUP BY t.id
		ORDER BY t.id
	`)
	if err != nil {
		return err
	}
	var themes []fiber.Map
	for tRows.Next() {
		var id, cnt int64
		var slug, title, desc string
		if err := tRows.Scan(&id, &slug, &title, &desc, &cnt); err != nil {
			tRows.Close()
			return err
		}
		themes = append(themes, fiber.Map{
			"id":          id,
			"slug":        slug,
			"title":       title,
			"description": desc,
			"ayah_count":  cnt,
		})
	}
	tRows.Close()

	return c.JSON(fiber.Map{
		"concepts": concepts,
		"links":    links,
		"themes":   themes,
	})
}

func (h *KnowledgeHandler) GetConceptDetail(c *fiber.Ctx) error {
	setImmutableCache(c)
	slug := strings.TrimSpace(c.Params("slug"))

	var id int64
	var nameAr, nameLat, cat, sum, src, rt string
	err := h.Pool.QueryRow(c.Context(), `
		SELECT id, name_arabic, name_latin, category, summary, source_attribution, COALESCE(root_text,'')
		FROM knowledge_concepts
		WHERE slug = $1
	`, slug).Scan(&id, &nameAr, &nameLat, &cat, &sum, &src, &rt)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "concept not found")
	}

	// Linked concepts
	lRows, err := h.Pool.Query(c.Context(), `
		SELECT c.slug, c.name_arabic, c.name_latin, l.relation_type, l.description, 'outgoing' AS dir
		FROM knowledge_concept_links l
		JOIN knowledge_concepts c ON c.id = l.target_concept_id
		WHERE l.source_concept_id = $1
		UNION ALL
		SELECT c.slug, c.name_arabic, c.name_latin, l.relation_type, l.description, 'incoming' AS dir
		FROM knowledge_concept_links l
		JOIN knowledge_concepts c ON c.id = l.source_concept_id
		WHERE l.target_concept_id = $1
	`, id)
	if err != nil {
		return err
	}
	var related []fiber.Map
	for lRows.Next() {
		var rSlug, rAr, rLat, rel, desc, dir string
		if err := lRows.Scan(&rSlug, &rAr, &rLat, &rel, &desc, &dir); err == nil {
			related = append(related, fiber.Map{
				"slug":          rSlug,
				"name_arabic":   rAr,
				"name_latin":    rLat,
				"relation_type": rel,
				"description":   desc,
				"direction":     dir,
			})
		}
	}
	lRows.Close()

	// Sample ayahs matching root_text or mapped in knowledge_theme_ayahs
	aRows, err := h.Pool.Query(c.Context(), `
		SELECT DISTINCT ON (a.id) a.id, a.surah_id, s.name_transliteration, s.name_arabic, a.ayah_number,
		       (SELECT string_agg(qw.arabic_text, ' ' ORDER BY qw.word_number) FROM quran_words qw WHERE qw.ayah_id = a.id),
		       COALESCE((SELECT string_agg(COALESCE(wt.translation,''), ' ' ORDER BY qw.word_number)
		                 FROM quran_words qw LEFT JOIN word_translations wt ON wt.word_id = qw.id AND wt.language_code = 'id'
		                 WHERE qw.ayah_id = a.id), '')
		FROM ayahs a
		JOIN surahs s ON s.id = a.surah_id
		WHERE a.id IN (
			SELECT ayah_id FROM knowledge_theme_ayahs WHERE concept_id = $1
			UNION
			SELECT qw.ayah_id
			FROM quran_words qw
			JOIN word_morphology wm ON wm.word_id = qw.id
			JOIN roots r ON r.id = wm.root_id
			WHERE $2 <> '' AND r.arabic_text = $2
			LIMIT 12
		)
		ORDER BY a.id
		LIMIT 12
	`, id, rt)
	if err != nil {
		return err
	}
	var ayahs []fiber.Map
	for aRows.Next() {
		var aid int64
		var sid, anum int16
		var sLat, sAr, arText, trText string
		if err := aRows.Scan(&aid, &sid, &sLat, &sAr, &anum, &arText, &trText); err == nil {
			ayahs = append(ayahs, fiber.Map{
				"ayah_id":        aid,
				"surah_id":       sid,
				"surah_name":     sLat,
				"surah_arabic":   sAr,
				"ayah_number":    anum,
				"arabic_text":    arText,
				"translation_id": trText,
			})
		}
	}
	aRows.Close()

	return c.JSON(fiber.Map{
		"concept": fiber.Map{
			"id":                 id,
			"slug":               slug,
			"name_arabic":        nameAr,
			"name_latin":         nameLat,
			"category":           cat,
			"summary":            sum,
			"source_attribution": src,
			"root_text":          rt,
		},
		"related_concepts": related,
		"ayahs":            ayahs,
	})
}

func (h *KnowledgeHandler) GetThemeDetail(c *fiber.Ctx) error {
	setImmutableCache(c)
	slug := strings.TrimSpace(c.Params("slug"))

	var id int64
	var title, desc string
	err := h.Pool.QueryRow(c.Context(), `
		SELECT id, title, description FROM knowledge_themes WHERE slug = $1
	`, slug).Scan(&id, &title, &desc)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "theme not found")
	}

	rows, err := h.Pool.Query(c.Context(), `
		SELECT a.id, a.surah_id, s.name_transliteration, s.name_arabic, a.ayah_number, ta.note,
		       COALESCE(kc.slug, ''), COALESCE(kc.name_arabic, ''),
		       (SELECT string_agg(qw.arabic_text, ' ' ORDER BY qw.word_number) FROM quran_words qw WHERE qw.ayah_id = a.id)
		FROM knowledge_theme_ayahs ta
		JOIN ayahs a ON a.id = ta.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN knowledge_concepts kc ON kc.id = ta.concept_id
		WHERE ta.theme_id = $1
		ORDER BY a.surah_id, a.ayah_number
	`, id)
	if err != nil {
		return err
	}
	defer rows.Close()

	var ayahs []fiber.Map
	for rows.Next() {
		var aid int64
		var sid, anum int16
		var sLat, sAr, note, cSlug, cAr, arText string
		if err := rows.Scan(&aid, &sid, &sLat, &sAr, &anum, &note, &cSlug, &cAr, &arText); err == nil {
			ayahs = append(ayahs, fiber.Map{
				"ayah_id":        aid,
				"surah_id":       sid,
				"surah_name":     sLat,
				"surah_arabic":   sAr,
				"ayah_number":    anum,
				"note":           note,
				"concept_slug":   cSlug,
				"concept_arabic": cAr,
				"arabic_text":    arText,
			})
		}
	}

	return c.JSON(fiber.Map{
		"theme": fiber.Map{
			"id":          id,
			"slug":        slug,
			"title":       title,
			"description": desc,
		},
		"ayahs": ayahs,
	})
}

func (h *KnowledgeHandler) GetAyahKnowledge(c *fiber.Ctx) error {
	setImmutableCache(c)
	surah, err := strconv.Atoi(c.Params("surah"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid surah")
	}
	ayahNum, err := strconv.Atoi(c.Params("ayah"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid ayah")
	}

	var ayahID int64
	var sName, sAr, arText, trText string
	err = h.Pool.QueryRow(c.Context(), `
		SELECT a.id, s.name_transliteration, s.name_arabic,
		       (SELECT string_agg(qw.arabic_text, ' ' ORDER BY qw.word_number) FROM quran_words qw WHERE qw.ayah_id = a.id),
		       COALESCE((SELECT string_agg(COALESCE(wt.translation,''), ' ' ORDER BY qw.word_number)
		                 FROM quran_words qw LEFT JOIN word_translations wt ON wt.word_id = qw.id AND wt.language_code = 'id'
		                 WHERE qw.ayah_id = a.id), '')
		FROM ayahs a
		JOIN surahs s ON s.id = a.surah_id
		WHERE a.surah_id = $1 AND a.ayah_number = $2
	`, surah, ayahNum).Scan(&ayahID, &sName, &sAr, &arText, &trText)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "ayah not found")
	}

	// Tafsir references
	tRows, err := h.Pool.Query(c.Context(), `
		SELECT ts.name, ts.author, ts.license_note, at.summary_text, at.key_points
		FROM ayah_tafsirs at
		JOIN tafsir_sources ts ON ts.id = at.source_id
		WHERE at.ayah_id = $1
	`, ayahID)
	if err != nil {
		return err
	}
	var tafsirs []fiber.Map
	for tRows.Next() {
		var srcName, author, lic, summary, kp string
		if err := tRows.Scan(&srcName, &author, &lic, &summary, &kp); err == nil {
			tafsirs = append(tafsirs, fiber.Map{
				"source_name":  srcName,
				"author":       author,
				"license_note": lic,
				"summary_text": summary,
				"key_points":   kp,
			})
		}
	}
	tRows.Close()

	// Cross-references (explicit + shared-root automatic fallback)
	xRows, err := h.Pool.Query(c.Context(), `
		SELECT a2.surah_id, s2.name_transliteration, a2.ayah_number, cr.relation_type, cr.explanation, cr.source_attribution,
		       (SELECT string_agg(qw.arabic_text, ' ' ORDER BY qw.word_number) FROM quran_words qw WHERE qw.ayah_id = a2.id)
		FROM ayah_cross_references cr
		JOIN ayahs a2 ON a2.id = cr.target_ayah_id
		JOIN surahs s2 ON s2.id = a2.surah_id
		WHERE cr.source_ayah_id = $1
		ORDER BY cr.id
	`, ayahID)
	if err != nil {
		return err
	}
	var crossRefs []fiber.Map
	for xRows.Next() {
		var sid, anum int16
		var sLat, rel, expl, src, tgtAr string
		if err := xRows.Scan(&sid, &sLat, &anum, &rel, &expl, &src, &tgtAr); err == nil {
			crossRefs = append(crossRefs, fiber.Map{
				"surah_id":           sid,
				"surah_name":         sLat,
				"ayah_number":        anum,
				"relation_type":      rel,
				"explanation":        expl,
				"source_attribution": src,
				"arabic_text":        tgtAr,
			})
		}
	}
	xRows.Close()

	// Themes linked to this ayah
	thRows, err := h.Pool.Query(c.Context(), `
		SELECT th.slug, th.title, ta.note
		FROM knowledge_theme_ayahs ta
		JOIN knowledge_themes th ON th.id = ta.theme_id
		WHERE ta.ayah_id = $1
	`, ayahID)
	if err != nil {
		return err
	}
	var themes []fiber.Map
	for thRows.Next() {
		var slug, title, note string
		if err := thRows.Scan(&slug, &title, &note); err == nil {
			themes = append(themes, fiber.Map{"slug": slug, "title": title, "note": note})
		}
	}
	thRows.Close()

	return c.JSON(fiber.Map{
		"ayah_id":          ayahID,
		"surah_id":         surah,
		"surah_name":       sName,
		"surah_arabic":     sAr,
		"ayah_number":      ayahNum,
		"arabic_text":      arText,
		"translation_id":   trText,
		"tafsirs":          tafsirs,
		"cross_references": crossRefs,
		"themes":           themes,
	})
}

func (h *KnowledgeHandler) ListNotes(c *fiber.Ctx) error {
	rows, err := h.Pool.Query(c.Context(), `
		SELECT n.id, n.title, n.content, n.tags,
		       a.surah_id, COALESCE(s.name_transliteration,''), a.ayah_number,
		       COALESCE(kc.slug,''), COALESCE(kc.name_latin,''),
		       n.created_at
		FROM knowledge_notes n
		LEFT JOIN ayahs a ON a.id = n.ayah_id
		LEFT JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN knowledge_concepts kc ON kc.id = n.concept_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT 50
	`, defaultKnowledgeUserID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var notes []fiber.Map
	for rows.Next() {
		var id int64
		var title, content, tags, sName, cSlug, cLat string
		var sid, anum *int16
		var createdAt any
		if err := rows.Scan(&id, &title, &content, &tags, &sid, &sName, &anum, &cSlug, &cLat, &createdAt); err == nil {
			notes = append(notes, fiber.Map{
				"id":            id,
				"title":         title,
				"content":       content,
				"tags":          tags,
				"surah_id":      sid,
				"surah_name":    sName,
				"ayah_number":   anum,
				"concept_slug":  cSlug,
				"concept_latin": cLat,
				"created_at":    createdAt,
			})
		}
	}
	return c.JSON(fiber.Map{"notes": notes})
}

func (h *KnowledgeHandler) CreateNote(c *fiber.Ctx) error {
	var body struct {
		Title       string `json:"title"`
		Content     string `json:"content"`
		Tags        string `json:"tags"`
		SurahID     *int16 `json:"surah_id"`
		AyahNumber  *int16 `json:"ayah_number"`
		ConceptSlug string `json:"concept_slug"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.Content) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "title and content are required")
	}

	var ayahID *int64
	if body.SurahID != nil && body.AyahNumber != nil {
		var aid int64
		if err := h.Pool.QueryRow(c.Context(), `SELECT id FROM ayahs WHERE surah_id = $1 AND ayah_number = $2`, *body.SurahID, *body.AyahNumber).Scan(&aid); err == nil {
			ayahID = &aid
		}
	}
	var conceptID *int64
	if strings.TrimSpace(body.ConceptSlug) != "" {
		var cid int64
		if err := h.Pool.QueryRow(c.Context(), `SELECT id FROM knowledge_concepts WHERE slug = $1`, strings.TrimSpace(body.ConceptSlug)).Scan(&cid); err == nil {
			conceptID = &cid
		}
	}

	var newID int64
	err := h.Pool.QueryRow(c.Context(), `
		INSERT INTO knowledge_notes (user_id, title, content, tags, ayah_id, concept_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, defaultKnowledgeUserID, strings.TrimSpace(body.Title), strings.TrimSpace(body.Content), strings.TrimSpace(body.Tags), ayahID, conceptID).Scan(&newID)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": newID})
}

func (h *KnowledgeHandler) DeleteNote(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid id")
	}
	_, err = h.Pool.Exec(c.Context(), `DELETE FROM knowledge_notes WHERE id = $1 AND user_id = $2`, id, defaultKnowledgeUserID)
	if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}
