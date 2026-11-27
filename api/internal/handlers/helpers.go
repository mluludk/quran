package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

func parsePagination(c *fiber.Ctx) (limit int, offset int) {
	limit = c.QueryInt("limit", 20)
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset = c.QueryInt("offset", 0)
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

func setImmutableCache(c *fiber.Ctx) {
	c.Set("Cache-Control", "public, max-age=86400")
}

func parsePositiveInt(raw string, name string) (int, error) {
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return 0, fiber.NewError(fiber.StatusBadRequest, name+" must be a positive integer")
	}
	return v, nil
}
