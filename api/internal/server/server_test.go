package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/digital-mushaf/api/internal/db"
	"github.com/digital-mushaf/api/internal/server"
)

func setupTestApp(t *testing.T) http.Handler {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://mushaf:mushaf_dev@127.0.0.1:55432/digital_mushaf?sslmode=disable"
	}
	pool, err := db.Connect(context.Background(), dsn)
	if err != nil {
		t.Skipf("skipping integration test (postgres unavailable): %v", err)
	}
	t.Cleanup(pool.Close)

	app := server.NewApp(pool, "../../../etl/reports/bundle/manifest.json", "http://localhost:3000")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp, err := app.Test(r, -1)
		if err != nil {
			t.Fatalf("app.Test error: %v", err)
		}
		defer resp.Body.Close()
		for k, vv := range resp.Header {
			for _, v := range vv {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(resp.StatusCode)
		buf := make([]byte, 1<<20)
		for {
			n, rErr := resp.Body.Read(buf)
			if n > 0 {
				_, _ = w.Write(buf[:n])
			}
			if rErr != nil {
				break
			}
		}
	})
}

func TestCoreAndIrabEndpoints(t *testing.T) {
	h := setupTestApp(t)

	// 1. /healthz
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	if rec.Code != 200 {
		t.Fatalf("/healthz status = %d", rec.Code)
	}

	// 2. /api/v1/surahs -> 114
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/surahs", nil))
	if rec.Code != 200 {
		t.Fatalf("/surahs status = %d", rec.Code)
	}
	var surahsResp struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &surahsResp); err != nil {
		t.Fatal(err)
	}
	if len(surahsResp.Data) != 114 {
		t.Fatalf("expected 114 surahs, got %d", len(surahsResp.Data))
	}

	// 3. /api/v1/pages/3 -> 15 lines
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/pages/3", nil))
	if rec.Code != 200 {
		t.Fatalf("/pages/3 status = %d: %s", rec.Code, rec.Body.String())
	}
	var pageResp struct {
		PageNumber int              `json:"page_number"`
		Lines      []map[string]any `json:"lines"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &pageResp); err != nil {
		t.Fatal(err)
	}
	if pageResp.PageNumber != 3 || len(pageResp.Lines) != 15 {
		t.Fatalf("unexpected page 3: num=%d lines=%d", pageResp.PageNumber, len(pageResp.Lines))
	}

	// 4. /api/v1/words/1 -> translation, morphology, irab
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/words/1", nil))
	if rec.Code != 200 {
		t.Fatalf("/words/1 status = %d: %s", rec.Code, rec.Body.String())
	}
	var wordResp struct {
		TranslationID string           `json:"translation_id"`
		Morphology    []map[string]any `json:"morphology"`
		Irab          []map[string]any `json:"irab"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &wordResp); err != nil {
		t.Fatal(err)
	}
	if wordResp.TranslationID == "" || len(wordResp.Morphology) == 0 || len(wordResp.Irab) == 0 {
		t.Fatalf("incomplete word 1 response: tr=%q morph=%d irab=%d",
			wordResp.TranslationID, len(wordResp.Morphology), len(wordResp.Irab))
	}

	// 5. /api/v1/search/arabic?q=الحمد
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/search/arabic?q=%D8%A7%D9%84%D8%AD%D9%85%D8%AF", nil))
	if rec.Code != 200 {
		t.Fatalf("/search/arabic status = %d", rec.Code)
	}

	// 6. /api/v1/bundles/latest
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/bundles/latest", nil))
	if rec.Code != 200 {
		t.Fatalf("/bundles/latest status = %d", rec.Code)
	}

	// 7. /api/v1/ayahs/1/2/irab -> words + relations
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/ayahs/1/2/irab", nil))
	if rec.Code != 200 {
		t.Fatalf("/ayahs/1/2/irab status = %d", rec.Code)
	}
	var irabResp struct {
		Words    []map[string]any `json:"words"`
		Analyses []struct {
			Relations []map[string]any `json:"relations"`
			Phrases   []map[string]any `json:"phrases"`
		} `json:"analyses"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &irabResp); err != nil {
		t.Fatal(err)
	}
	if len(irabResp.Words) == 0 || len(irabResp.Analyses) == 0 || len(irabResp.Analyses[0].Relations) == 0 || len(irabResp.Analyses[0].Phrases) == 0 {
		t.Fatalf("expected words, relations, and phrases for 1:2, got words=%d analyses=%d",
			len(irabResp.Words), len(irabResp.Analyses))
	}

	// 8. /api/v1/roots/1/family -> root + family
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/roots/1/family", nil))
	if rec.Code != 200 {
		t.Fatalf("/roots/1/family status = %d: %s", rec.Code, rec.Body.String())
	}
	var famResp struct {
		Family []map[string]any `json:"family"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &famResp); err != nil {
		t.Fatal(err)
	}
	if len(famResp.Family) == 0 {
		t.Fatalf("expected non-empty root family for root 1")
	}

	// 9. /api/v1/vocab/collections & /api/v1/vocab/progress
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/vocab/collections", nil))
	if rec.Code != 200 {
		t.Fatalf("/vocab/collections status = %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/vocab/progress", nil))
	if rec.Code != 200 {
		t.Fatalf("/vocab/progress status = %d", rec.Code)
	}
}
