package handlers

import (
	"context"
	"math/rand"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func buildTadrijLearningPath(totalMastered int, juzMap map[int16][2]int) []fiber.Map {
	stages := []struct {
		Stage   int
		Title   string
		Sub     string
		Mode    string
		Juz     int16
		Target  int
	}{
		{0, "Tahap 0: 50 Kata Kunci Inti", "Fondasi 50 kata paling sering muncul (80/20)", "frequency", 0, 50},
		{1, "Tahap 1: Juz 30 (Juz Amma)", "Surah pendek & bacaan shalat (81,2% cakupan mushaf)", "juz", 30, 0},
		{2, "Tahap 2: Juz 1 (Al-Fatihah – Al-Baqarah)", "Kosakata inti awal Al-Baqarah (88,5% kumulatif)", "juz", 1, 0},
		{3, "Tahap 3: Juz 2 (Al-Baqarah Lanjutan)", "Struktur ayat hukum & kisah (90,7% kumulatif)", "juz", 2, 0},
		{4, "Tahap 4: Juz 26 (Al-Ahqaf – Qaf)", "Kosakata menengah-tinggi (92,6% kumulatif)", "juz", 26, 0},
		{5, "Tahap 5: Juz 25 (Fussilat – Al-Jatsiyah)", "Menyempurnakan cakupan ~93,7% mushaf", "juz", 25, 0},
	}

	out := make([]fiber.Map, 0, len(stages))
	prevCompleted := true
	for _, st := range stages {
		total := st.Target
		done := totalMastered
		if st.Juz > 0 {
			pair := juzMap[st.Juz]
			total = pair[0]
			done = pair[1]
		} else if done > total {
			done = total
		}
		pct := 0.0
		if total > 0 {
			pct = float64(done) * 100.0 / float64(total)
		}
		status := "locked"
		if pct >= 70.0 {
			status = "completed"
		} else if prevCompleted || st.Stage <= 1 {
			status = "active"
		}
		prevCompleted = (pct >= 50.0)
		out = append(out, fiber.Map{
			"stage":          st.Stage,
			"title":          st.Title,
			"subtitle":       st.Sub,
			"mode":           st.Mode,
			"juz_number":     st.Juz,
			"total_words":    total,
			"mastered_words": done,
			"progress_pct":   pct,
			"status":         status,
		})
	}
	return out
}

func (h *LearnHandler) recordDailyStudy(ctx context.Context, isCorrect bool) error {
	_, err := h.Pool.Exec(ctx, `
		INSERT INTO learning_daily_logs (user_id, study_date, reviewed_count, correct_count)
		VALUES ($1, CURRENT_DATE, 1, CASE WHEN $2 THEN 1 ELSE 0 END)
		ON CONFLICT (user_id, study_date) DO UPDATE
		SET reviewed_count = learning_daily_logs.reviewed_count + 1,
		    correct_count = learning_daily_logs.correct_count + CASE WHEN $2 THEN 1 ELSE 0 END,
		    updated_at = now()
	`, defaultLearnUserID, isCorrect)
	if err != nil {
		return err
	}

	_, err = h.Pool.Exec(ctx, `
		INSERT INTO learning_user_goals (user_id, daily_target, current_streak, longest_streak, last_study_date)
		VALUES ($1, 15, 1, 1, CURRENT_DATE)
		ON CONFLICT (user_id) DO UPDATE
		SET current_streak = CASE
		      WHEN learning_user_goals.last_study_date = CURRENT_DATE THEN GREATEST(1, learning_user_goals.current_streak)
		      WHEN learning_user_goals.last_study_date = CURRENT_DATE - 1 THEN learning_user_goals.current_streak + 1
		      ELSE 1
		    END,
		    longest_streak = GREATEST(
		      learning_user_goals.longest_streak,
		      CASE
		        WHEN learning_user_goals.last_study_date = CURRENT_DATE THEN GREATEST(1, learning_user_goals.current_streak)
		        WHEN learning_user_goals.last_study_date = CURRENT_DATE - 1 THEN learning_user_goals.current_streak + 1
		        ELSE 1
		      END
		    ),
		    last_study_date = CURRENT_DATE,
		    updated_at = now()
	`, defaultLearnUserID)
	return err
}

func (h *LearnHandler) GetGoals(c *fiber.Ctx) error {
	var dailyTarget, currentStreak, longestStreak int
	var todayReviewed, todayCorrect int
	err := h.Pool.QueryRow(c.Context(), `
		SELECT g.daily_target, g.current_streak, g.longest_streak,
		       COALESCE(l.reviewed_count, 0), COALESCE(l.correct_count, 0)
		FROM learning_user_goals g
		LEFT JOIN learning_daily_logs l ON l.user_id = g.user_id AND l.study_date = CURRENT_DATE
		WHERE g.user_id = $1
	`, defaultLearnUserID).Scan(&dailyTarget, &currentStreak, &longestStreak, &todayReviewed, &todayCorrect)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"daily_target":   dailyTarget,
		"today_reviewed": todayReviewed,
		"today_correct":  todayCorrect,
		"current_streak": currentStreak,
		"longest_streak": longestStreak,
	})
}

func (h *LearnHandler) UpdateGoals(c *fiber.Ctx) error {
	var body struct {
		DailyTarget int `json:"daily_target"`
	}
	if err := c.BodyParser(&body); err != nil || body.DailyTarget < 5 || body.DailyTarget > 200 {
		return fiber.NewError(fiber.StatusBadRequest, "daily_target must be between 5 and 200")
	}
	_, err := h.Pool.Exec(c.Context(), `
		INSERT INTO learning_user_goals (user_id, daily_target)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET daily_target = $2, updated_at = now()
	`, defaultLearnUserID, body.DailyTarget)
	if err != nil {
		return err
	}
	return h.GetGoals(c)
}

func (h *LearnHandler) GetGrammarQuiz(c *fiber.Ctx) error {
	topic := strings.ToLower(strings.TrimSpace(c.Query("topic", "nahwu")))
	limit := c.QueryInt("limit", 10)
	if limit <= 0 || limit > 25 {
		limit = 10
	}

	if topic == "sarf" {
		rows, err := h.Pool.Query(c.Context(), `
			SELECT qw.id, qw.arabic_text, COALESCE(wt.translation,''), COALESCE(wm.pos,''),
			       COALESCE(l.arabic_text,''), COALESCE(r.arabic_text,''),
			       COALESCE(wm.morphology_data->>'tags',''),
			       a.surah_id, s.name_transliteration, a.ayah_number
			FROM word_morphology wm
			JOIN quran_words qw ON qw.id = wm.word_id
			JOIN ayahs a ON a.id = qw.ayah_id
			JOIN surahs s ON s.id = a.surah_id
			JOIN roots r ON r.id = wm.root_id
			LEFT JOIN lemmas l ON l.id = wm.lemma_id
			LEFT JOIN word_translations wt ON wt.word_id = qw.id AND wt.language_code = 'id'
			WHERE a.juz_number IN (30, 1) AND wm.pos IN ('V', 'N') AND r.arabic_text <> ''
			ORDER BY random()
			LIMIT $1
		`, limit)
		if err != nil {
			return err
		}
		defer rows.Close()

		rRows, err := h.Pool.Query(c.Context(), `SELECT arabic_text FROM roots ORDER BY random() LIMIT 120`)
		if err != nil {
			return err
		}
		var rootPool []string
		for rRows.Next() {
			var rt string
			if err := rRows.Scan(&rt); err == nil {
				rootPool = append(rootPool, rt)
			}
		}
		rRows.Close()

		var questions []fiber.Map
		for rows.Next() {
			var wid int64
			var ar, tr, pos, lem, rt, tags, sName string
			var sid, anum int16
			if err := rows.Scan(&wid, &ar, &tr, &pos, &lem, &rt, &tags, &sid, &sName, &anum); err != nil {
				return err
			}
			choices := buildChoices(rt, rootPool)
			questions = append(questions, fiber.Map{
				"topic":          "sarf",
				"word_id":        wid,
				"arabic_text":    ar,
				"translation_id": tr,
				"prompt":         "Apa akar kata (tsulatsi/ruba'i) dari lafaz ini?",
				"correct_answer": rt,
				"choices":        choices,
				"explanation":    "POS: " + pos + " · Lemma: " + lem + " · Tags: " + tags,
				"surah_id":       sid,
				"surah_name":     sName,
				"ayah_number":    anum,
			})
		}
		return c.JSON(fiber.Map{"topic": "sarf", "questions": questions})
	}

	// Nahwu quiz from verified irab_word_nodes
	rows, err := h.Pool.Query(c.Context(), `
		SELECT qw.id, qw.arabic_text, COALESCE(wt.translation,''),
		       n.role_latin, n.role_arabic, COALESCE(n.amil,''), COALESCE(n.explanation,''),
		       a.surah_id, s.name_transliteration, a.ayah_number
		FROM irab_word_nodes n
		JOIN irab_analyses ia ON ia.id = n.analysis_id
		JOIN quran_words qw ON qw.id = n.word_id
		JOIN ayahs a ON a.id = qw.ayah_id
		JOIN surahs s ON s.id = a.surah_id
		LEFT JOIN word_translations wt ON wt.word_id = qw.id AND wt.language_code = 'id'
		WHERE a.juz_number IN (30, 1)
		  AND ia.opinion_label <> 'alternatif'
		  AND n.role_latin IN ('Mubtada''','Khabar','Fa''il','Maf''ul Bih','Huruf Jar','Ism Majrur','Na''at','Mudhaf Ilaih')
		ORDER BY random()
		LIMIT $1
	`, limit)
	if err != nil {
		return err
	}
	defer rows.Close()

	nahwuPool := []string{"Mubtada'", "Khabar", "Fa'il", "Maf'ul Bih", "Huruf Jar", "Ism Majrur", "Na'at", "Mudhaf Ilaih"}
	var questions []fiber.Map
	for rows.Next() {
		var wid int64
		var ar, tr, roleLat, roleAr, amil, expl, sName string
		var sid, anum int16
		if err := rows.Scan(&wid, &ar, &tr, &roleLat, &roleAr, &amil, &expl, &sid, &sName, &anum); err != nil {
			return err
		}
		choices := buildChoices(roleLat, nahwuPool)
		questions = append(questions, fiber.Map{
			"topic":          "nahwu",
			"word_id":        wid,
			"arabic_text":    ar,
			"translation_id": tr,
			"prompt":         "Apa kedudukan nahwu (i'rab) kata ini?",
			"correct_answer": roleLat,
			"choices":        choices,
			"explanation":    roleAr + (func() string { if amil != "" { return " · Amil: " + amil } ; return "" })() + " — " + expl,
			"surah_id":       sid,
			"surah_name":     sName,
			"ayah_number":    anum,
		})
	}
	rand.Shuffle(len(questions), func(i, j int) {
		questions[i], questions[j] = questions[j], questions[i]
	})
	return c.JSON(fiber.Map{"topic": "nahwu", "questions": questions})
}

func (h *LearnHandler) SubmitQuizLog(c *fiber.Ctx) error {
	var body struct {
		IsCorrect bool `json:"is_correct"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid payload")
	}
	if err := h.recordDailyStudy(c.Context(), body.IsCorrect); err != nil {
		return err
	}
	return h.GetGoals(c)
}
