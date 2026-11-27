package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type VocabHandler struct {
	Pool *pgxpool.Pool
}

func (h *VocabHandler) ListCollections(c *fiber.Ctx) error {
	rows, err := h.Pool.Query(c.Context(), `
		SELECT vc.id, vc.name, COALESCE(vc.description,''),
		       count(vi.id) FILTER (WHERE vi.deleted_at IS NULL) AS item_count
		FROM vocab_collections vc
		LEFT JOIN vocab_items vi ON vi.collection_id = vc.id
		GROUP BY vc.id, vc.name, vc.description
		ORDER BY vc.id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var id int64
		var name, desc string
		var cnt int
		if err := rows.Scan(&id, &name, &desc, &cnt); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"id":          id,
			"name":        name,
			"description": desc,
			"item_count":  cnt,
		})
	}
	return c.JSON(fiber.Map{"data": out})
}

func (h *VocabHandler) CreateCollection(c *fiber.Ctx) error {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "collection name is required")
	}
	var id int64
	err := h.Pool.QueryRow(c.Context(), `
		INSERT INTO vocab_collections (name, description)
		VALUES ($1, $2)
		RETURNING id
	`, strings.TrimSpace(body.Name), strings.TrimSpace(body.Description)).Scan(&id)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":          id,
		"name":        strings.TrimSpace(body.Name),
		"description": strings.TrimSpace(body.Description),
		"item_count":  0,
	})
}

func (h *VocabHandler) ListItems(c *fiber.Ctx) error {
	collectionID := c.QueryInt("collection_id", 0)
	itemType := strings.TrimSpace(c.Query("item_type"))

	rows, err := h.Pool.Query(c.Context(), `
		SELECT vi.id, vi.collection_id, COALESCE(vc.name,''), vi.item_type,
		       vi.word_id, vi.ayah_id, vi.note, vi.mastery_level, vi.review_count,
		       COALESCE(w.arabic_text, (
		         SELECT string_agg(qw.arabic_text, ' ' ORDER BY qw.word_number)
		         FROM quran_words qw WHERE qw.ayah_id = vi.ayah_id
		       ), '') AS arabic_text,
		       COALESCE(wt.translation, '') AS translation_id,
		       COALESCE(r.arabic_text, '') AS root_text,
		       COALESCE(s.name_arabic, '') AS surah_name,
		       COALESCE(a.surah_id, 0) AS surah_id,
		       COALESCE(a.ayah_number, 0) AS ayah_number,
		       (SELECT mp.page_number
		        FROM mushaf_line_items li
		        JOIN mushaf_lines ml ON ml.id = li.line_id
		        JOIN mushaf_pages mp ON mp.id = ml.page_id
		        WHERE (vi.word_id IS NOT NULL AND li.word_id = vi.word_id)
		           OR (vi.word_id IS NULL AND li.ayah_id = vi.ayah_id)
		        LIMIT 1) AS page_number
		FROM vocab_items vi
		LEFT JOIN vocab_collections vc ON vc.id = vi.collection_id
		LEFT JOIN quran_words w ON w.id = vi.word_id
		LEFT JOIN ayahs a ON a.id = COALESCE(vi.ayah_id, w.ayah_id)
		LEFT JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = vi.word_id AND wt.language_code = 'id'
		LEFT JOIN LATERAL (
		  SELECT r2.arabic_text
		  FROM word_morphology wm2
		  JOIN roots r2 ON r2.id = wm2.root_id
		  WHERE wm2.word_id = vi.word_id AND wm2.root_id IS NOT NULL
		  ORDER BY wm2.segment_number LIMIT 1
		) r ON true
		WHERE vi.deleted_at IS NULL
		  AND ($1 = 0 OR vi.collection_id = $1)
		  AND ($2 = '' OR vi.item_type = $2)
		ORDER BY vi.updated_at DESC, vi.id DESC
	`, collectionID, itemType)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var id int64
		var colID, wordID, ayahID *int64
		var mastery, surahID, ayahNum int16
		var pageNum *int16
		var revCount int
		var colName, iType, note, ar, tr, rootTxt, sName string
		if err := rows.Scan(&id, &colID, &colName, &iType, &wordID, &ayahID, &note, &mastery, &revCount,
			&ar, &tr, &rootTxt, &sName, &surahID, &ayahNum, &pageNum); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"id":              id,
			"collection_id":   colID,
			"collection_name": colName,
			"item_type":       iType,
			"word_id":         wordID,
			"ayah_id":         ayahID,
			"note":            note,
			"mastery_level":   mastery,
			"review_count":    revCount,
			"arabic_text":     ar,
			"translation_id":  tr,
			"root":            rootTxt,
			"surah_name":      sName,
			"surah_id":        surahID,
			"ayah_number":     ayahNum,
			"page_number":     pageNum,
		})
	}
	return c.JSON(fiber.Map{"data": out})
}

func (h *VocabHandler) CreateItem(c *fiber.Ctx) error {
	var body struct {
		CollectionID *int64 `json:"collection_id"`
		ItemType     string `json:"item_type"`
		WordID       *int64 `json:"word_id"`
		AyahID       *int64 `json:"ayah_id"`
		Note         string `json:"note"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid JSON body")
	}
	if body.ItemType != "word" && body.ItemType != "ayah" {
		return fiber.NewError(fiber.StatusBadRequest, "item_type must be 'word' or 'ayah'")
	}
	if body.ItemType == "word" && body.WordID == nil {
		return fiber.NewError(fiber.StatusBadRequest, "word_id is required when item_type='word'")
	}
	if body.ItemType == "ayah" && body.AyahID == nil {
		return fiber.NewError(fiber.StatusBadRequest, "ayah_id is required when item_type='ayah'")
	}

	colID := body.CollectionID
	if colID == nil {
		var defaultID int64
		if err := h.Pool.QueryRow(c.Context(), `SELECT id FROM vocab_collections ORDER BY id LIMIT 1`).Scan(&defaultID); err == nil {
			colID = &defaultID
		}
	}

	var id int64
	err := h.Pool.QueryRow(c.Context(), `
		INSERT INTO vocab_items (collection_id, item_type, word_id, ayah_id, note)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, colID, body.ItemType, body.WordID, body.AyahID, strings.TrimSpace(body.Note)).Scan(&id)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":            id,
		"collection_id": colID,
		"item_type":     body.ItemType,
		"word_id":       body.WordID,
		"ayah_id":       body.AyahID,
		"note":          strings.TrimSpace(body.Note),
		"mastery_level": 0,
	})
}

func (h *VocabHandler) UpdateItem(c *fiber.Ctx) error {
	id, err := parsePositiveInt(c.Params("id"), "vocab item id")
	if err != nil {
		return err
	}
	var body struct {
		Note         *string `json:"note"`
		CollectionID *int64  `json:"collection_id"`
		MasteryLevel *int16  `json:"mastery_level"`
		Reviewed     bool    `json:"reviewed"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid JSON body")
	}

	tag, err := h.Pool.Exec(c.Context(), `
		UPDATE vocab_items
		SET note = COALESCE($2, note),
		    collection_id = COALESCE($3, collection_id),
		    mastery_level = COALESCE($4, mastery_level),
		    review_count = CASE WHEN $5 THEN review_count + 1 ELSE review_count END,
		    last_reviewed_at = CASE WHEN $5 THEN now() ELSE last_reviewed_at END,
		    updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL
	`, id, body.Note, body.CollectionID, body.MasteryLevel, body.Reviewed)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "vocab item not found")
	}
	return c.JSON(fiber.Map{"id": id, "updated": true})
}

func (h *VocabHandler) DeleteItem(c *fiber.Ctx) error {
	id, err := parsePositiveInt(c.Params("id"), "vocab item id")
	if err != nil {
		return err
	}
	tag, err := h.Pool.Exec(c.Context(), `UPDATE vocab_items SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "vocab item not found")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *VocabHandler) GetProgress(c *fiber.Ctx) error {
	var total, newCnt, learningCnt, masteredCnt, totalReviews int
	err := h.Pool.QueryRow(c.Context(), `
		SELECT count(*),
		       count(*) FILTER (WHERE mastery_level = 0),
		       count(*) FILTER (WHERE mastery_level = 1),
		       count(*) FILTER (WHERE mastery_level >= 2),
		       COALESCE(sum(review_count), 0)
		FROM vocab_items
		WHERE deleted_at IS NULL
	`).Scan(&total, &newCnt, &learningCnt, &masteredCnt, &totalReviews)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"total_items":    total,
		"new_count":      newCnt,
		"learning_count": learningCnt,
		"mastered_count": masteredCnt,
		"total_reviews":  totalReviews,
	})
}
