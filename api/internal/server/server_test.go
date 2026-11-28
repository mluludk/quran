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

	// 10. /api/v1/juz -> 30
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/juz", nil))
	if rec.Code != 200 {
		t.Fatalf("/juz status = %d", rec.Code)
	}

	// 11. /api/v1/learn/summary & /api/v1/learn/deck
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/learn/summary", nil))
	if rec.Code != 200 {
		t.Fatalf("/learn/summary status = %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/learn/deck?mode=frequency&limit=5", nil))
	if rec.Code != 200 {
		t.Fatalf("/learn/deck status = %d: %s", rec.Code, rec.Body.String())
	}

	// 12. /api/v1/words/1/frequency & /api/v1/frequency/top
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/words/1/frequency", nil))
	if rec.Code != 200 {
		t.Fatalf("/words/1/frequency status = %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/frequency/top?kind=words&limit=10", nil))
	if rec.Code != 200 {
		t.Fatalf("/frequency/top status = %d", rec.Code)
	}

	// 13. /api/v1/words/44/context (هدى)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/words/44/context", nil))
	if rec.Code != 200 {
		t.Fatalf("/words/44/context status = %d: %s", rec.Code, rec.Body.String())
	}

	// 14. /api/v1/irab/validation-summary & multi-opinion /ayahs/1/1/irab
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/irab/validation-summary", nil))
	if rec.Code != 200 {
		t.Fatalf("/irab/validation-summary status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/ayahs/1/1/irab", nil))
	if rec.Code != 200 {
		t.Fatalf("/ayahs/1/1/irab status = %d: %s", rec.Code, rec.Body.String())
	}
	var irab11 struct {
		Analyses []struct {
			OpinionLabel     string  `json:"opinion_label"`
			ValidationStatus string  `json:"validation_status"`
			ConfidenceScore  float64 `json:"confidence_score"`
		} `json:"analyses"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &irab11); err != nil {
		t.Fatal(err)
	}
	if len(irab11.Analyses) < 2 || irab11.Analyses[0].ValidationStatus == "" || irab11.Analyses[0].ConfidenceScore <= 0 {
		t.Fatalf("expected >=2 opinions & validation metadata for 1:1, got %+v", irab11.Analyses)
	}

	// 15. /api/v1/sarf/explore
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/sarf/explore?pos=V&limit=10", nil))
	if rec.Code != 200 {
		t.Fatalf("/sarf/explore status = %d: %s", rec.Code, rec.Body.String())
	}

	// 16. Learning Engine: /learn/goals, /learn/deck?mode=adaptive, /learn/grammar-quiz
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/learn/goals", nil))
	if rec.Code != 200 {
		t.Fatalf("/learn/goals status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/learn/deck?mode=adaptive&limit=5", nil))
	if rec.Code != 200 {
		t.Fatalf("/learn/deck?mode=adaptive status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/learn/grammar-quiz?topic=nahwu&limit=5", nil))
	if rec.Code != 200 {
		t.Fatalf("/learn/grammar-quiz?topic=nahwu status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/learn/grammar-quiz?topic=sarf&limit=5", nil))
	if rec.Code != 200 {
		t.Fatalf("/learn/grammar-quiz?topic=sarf status = %d: %s", rec.Code, rec.Body.String())
	}

	// 17. Knowledge Engine: /knowledge/overview, /knowledge/concepts/taqwa, /ayahs/1/6/knowledge, /knowledge/notes
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/knowledge/overview", nil))
	if rec.Code != 200 {
		t.Fatalf("/knowledge/overview status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/knowledge/concepts/taqwa", nil))
	if rec.Code != 200 {
		t.Fatalf("/knowledge/concepts/taqwa status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/ayahs/1/6/knowledge", nil))
	if rec.Code != 200 {
		t.Fatalf("/ayahs/1/6/knowledge status = %d: %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/knowledge/notes", nil))
	if rec.Code != 200 {
		t.Fatalf("/knowledge/notes status = %d: %s", rec.Code, rec.Body.String())
	}
}
