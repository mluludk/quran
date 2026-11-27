package main

import (
	"context"
	"log"
	"os"

	"github.com/digital-mushaf/api/internal/db"
	"github.com/digital-mushaf/api/internal/server"
)

func main() {
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://mushaf:mushaf_dev@127.0.0.1:55432/digital_mushaf?sslmode=disable"
	}
	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:3000"
	}
	manifestPath := os.Getenv("BUNDLE_MANIFEST_PATH")
	if manifestPath == "" {
		manifestPath = "../etl/reports/bundle/manifest.json"
	}

	pool, err := db.Connect(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	app := server.NewApp(pool, manifestPath, corsOrigins)
	log.Printf("listening on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
