package main

import (
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/requestid"
)

func main() {
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:3000"
	}

	app := fiber.New(fiber.Config{
		AppName: "Digital Mushaf API v1",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": fiber.Map{
					"code":    "API_ERROR",
					"message": err.Error(),
				},
			})
		},
	})

	app.Use(requestid.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: strings.TrimSpace(corsOrigins),
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	v1 := app.Group("/api/v1")
	v1.Get("/editions", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"data": []fiber.Map{
				{
					"code":                  "madinah-hafs-604",
					"name":                  "Mushaf Madinah (Hafs)",
					"riwayah":               "hafs",
					"page_count":            604,
					"target_lines_per_page": 15,
				},
			},
		})
	})

	v1.Get("/pages/:page", func(c *fiber.Ctx) error {
		page, err := c.ParamsInt("page")
		if err != nil || page < 1 || page > 604 {
			return fiber.NewError(fiber.StatusBadRequest, "page must be between 1 and 604")
		}
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
			"error": fiber.Map{
				"code":    "NOT_IMPLEMENTED",
				"message": "Implemented in M2 after M1 PostgreSQL ETL",
			},
		})
	})

	log.Printf("listening on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
