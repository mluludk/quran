package handlers

import (
	"encoding/json"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BundleUserHandler struct {
	Pool         *pgxpool.Pool
	ManifestPath string
}

func (h *BundleUserHandler) GetLatestBundle(c *fiber.Ctx) error {
	raw, err := os.ReadFile(h.ManifestPath)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "bundle manifest not found")
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return err
	}
	return c.JSON(doc)
}

func (h *BundleUserHandler) ListBookmarks(c *fiber.Ctx) error {
	rows, err := h.Pool.Query(c.Context(), `
		SELECT id, page_number, ayah_id, COALESCE(note,''), created_at
		FROM bookmarks
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var out []fiber.Map
	for rows.Next() {
		var id int64
		var pageNum *int16
		var ayahID *int64
		var note string
		var created any
		if err := rows.Scan(&id, &pageNum, &ayahID, &note, &created); err != nil {
			return err
		}
		out = append(out, fiber.Map{
			"id":          id,
			"page_number": pageNum,
			"ayah_id":     ayahID,
			"note":        note,
			"created_at":  created,
		})
	}
	return c.JSON(fiber.Map{"data": out})
}

func (h *BundleUserHandler) CreateBookmark(c *fiber.Ctx) error {
	var body struct {
		PageNumber *int16 `json:"page_number"`
		AyahID     *int64 `json:"ayah_id"`
		Note       string `json:"note"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid JSON body")
	}
	if body.PageNumber == nil && body.AyahID == nil {
		return fiber.NewError(fiber.StatusBadRequest, "page_number or ayah_id is required")
	}

	var id int64
	err := h.Pool.QueryRow(c.Context(), `
		INSERT INTO bookmarks (page_number, ayah_id, note)
		VALUES ($1, $2, $3)
		RETURNING id
	`, body.PageNumber, body.AyahID, body.Note).Scan(&id)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":          id,
		"page_number": body.PageNumber,
		"ayah_id":     body.AyahID,
		"note":        body.Note,
	})
}

func (h *BundleUserHandler) DeleteBookmark(c *fiber.Ctx) error {
	id, err := parsePositiveInt(c.Params("id"), "bookmark id")
	if err != nil {
		return err
	}
	tag, err := h.Pool.Exec(c.Context(), `UPDATE bookmarks SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "bookmark not found")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *BundleUserHandler) GetReadingProgress(c *fiber.Ctx) error {
	var pageNum int16
	var ayahID *int64
	var updated any
	err := h.Pool.QueryRow(c.Context(), `
		SELECT page_number, ayah_id, updated_at
		FROM reading_progress
		ORDER BY updated_at DESC
		LIMIT 1
	`).Scan(&pageNum, &ayahID, &updated)
	if err != nil {
		return c.JSON(fiber.Map{"page_number": 1, "ayah_id": nil})
	}
	return c.JSON(fiber.Map{
		"page_number": pageNum,
		"ayah_id":     ayahID,
		"updated_at":  updated,
	})
}

func (h *BundleUserHandler) PutReadingProgress(c *fiber.Ctx) error {
	var body struct {
		PageNumber int16  `json:"page_number"`
		AyahID     *int64 `json:"ayah_id"`
	}
	if err := c.BodyParser(&body); err != nil || body.PageNumber < 1 || body.PageNumber > 604 {
		return fiber.NewError(fiber.StatusBadRequest, "page_number must be between 1 and 604")
	}
	_, err := h.Pool.Exec(c.Context(), `
		INSERT INTO reading_progress (user_id, edition_id, page_number, ayah_id, updated_at)
		VALUES ('00000000-0000-0000-0000-000000000001',
		        (SELECT id FROM mushaf_editions WHERE code = 'madinah-hafs-604' LIMIT 1),
		        $1, $2, now())
		ON CONFLICT (user_id, edition_id) DO UPDATE
		  SET page_number = EXCLUDED.page_number,
		      ayah_id = EXCLUDED.ayah_id,
		      updated_at = now()
	`, body.PageNumber, body.AyahID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"page_number": body.PageNumber,
		"ayah_id":     body.AyahID,
	})
}
