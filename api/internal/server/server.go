package server

import (
	"strings"

	"github.com/digital-mushaf/api/internal/handlers"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewApp(pool *pgxpool.Pool, manifestPath string, corsOrigins string) *fiber.App {
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
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Get("/healthz", func(c *fiber.Ctx) error {
		if err := pool.Ping(c.Context()); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"status": "unhealthy"})
		}
		return c.JSON(fiber.Map{"status": "ok"})
	})

	qh := &handlers.QuranHandler{Pool: pool}
	wh := &handlers.WordHandler{Pool: pool}
	bh := &handlers.BundleUserHandler{Pool: pool, ManifestPath: manifestPath}
	vh := &handlers.VocabHandler{Pool: pool}
	lh := &handlers.LearnHandler{Pool: pool}
	fh := &handlers.FrequencyHandler{Pool: pool}
	ch := &handlers.ContextHandler{Pool: pool}

	v1 := app.Group("/api/v1")

	// Quran & Mushaf
	v1.Get("/surahs", qh.ListSurahs)
	v1.Get("/juz", qh.ListJuz)
	v1.Get("/surahs/:id", qh.GetSurah)
	v1.Get("/surahs/:id/ayahs", qh.ListSurahAyahs)
	v1.Get("/ayahs/:surah/:ayah", qh.GetAyah)
	v1.Get("/ayahs/:surah/:ayah/irab", qh.GetAyahIrab)
	v1.Get("/editions", qh.ListEditions)
	v1.Get("/pages/:page", qh.GetPage)

	// Word, Morphology, I'rab, Roots & Search
	v1.Get("/words/:id", wh.GetWord)
	v1.Get("/words/:id/translation", wh.GetWordTranslation)
	v1.Get("/words/:id/morphology", wh.GetWordMorphology)
	v1.Get("/words/:id/irab", wh.GetWordIrab)
	v1.Get("/roots/:id", wh.GetRoot)
	v1.Get("/roots/:id/family", wh.GetRootFamily)
	v1.Get("/roots/:id/occurrences", wh.GetRootOccurrences)
	v1.Get("/search/arabic", wh.SearchArabic)
	v1.Get("/search/roots", wh.SearchRoots)
	v1.Get("/search/lemmas", wh.SearchLemmas)

	// Bundles & User state
	v1.Get("/bundles/latest", bh.GetLatestBundle)
	v1.Get("/bundles/:version/manifest", bh.GetLatestBundle)
	v1.Get("/bookmarks", bh.ListBookmarks)
	v1.Post("/bookmarks", bh.CreateBookmark)
	v1.Delete("/bookmarks/:id", bh.DeleteBookmark)
	v1.Get("/reading-progress", bh.GetReadingProgress)
	v1.Put("/reading-progress", bh.PutReadingProgress)

	// Vocabulary Notebook & Flashcards
	v1.Get("/vocab/collections", vh.ListCollections)
	v1.Post("/vocab/collections", vh.CreateCollection)
	v1.Get("/vocab/items", vh.ListItems)
	v1.Post("/vocab/items", vh.CreateItem)
	v1.Patch("/vocab/items/:id", vh.UpdateItem)
	v1.Delete("/vocab/items/:id", vh.DeleteItem)
	v1.Get("/vocab/progress", vh.GetProgress)

	// Word-by-Word Learning Module
	v1.Get("/learn/summary", lh.GetSummary)
	v1.Get("/learn/deck", lh.GetDeck)
	v1.Post("/learn/answer", lh.SubmitAnswer)

	// Vocabulary Frequency & Context Explorer
	v1.Get("/words/:id/frequency", fh.GetWordFrequency)
	v1.Get("/words/:id/context", ch.GetWordContext)
	v1.Get("/frequency/top", fh.GetTopFrequency)

	return app
}
