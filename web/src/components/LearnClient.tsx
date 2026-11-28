"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createVocabItem,
  fetchGrammarQuiz,
  fetchLearnDeck,
  fetchLearnGoals,
  fetchLearnSummary,
  submitGrammarQuizLog,
  submitLearnAnswer,
  updateLearnGoals,
  type GrammarQuizQuestion,
  type LearnCard,
  type LearnGoalsResponse,
  type LearnSummaryResponse,
} from "@/lib/api";

export default function LearnClient() {
  const [summary, setSummary] = useState<LearnSummaryResponse | null>(null);
  const [goals, setGoals] = useState<LearnGoalsResponse | null>(null);
  const [engineTab, setEngineTab] = useState<"vocab" | "nahwu" | "sarf">("vocab");
  const [track, setTrack] = useState<"due" | "adaptive" | "frequency" | "juz" | "page">("adaptive");
  const [juz, setJuz] = useState(30);
  const [page, setPage] = useState(1);
  const [onlyNew, setOnlyNew] = useState(true);
  const [practiceMode, setPracticeMode] = useState<"quiz" | "flashcard">("quiz");

  const [cards, setCards] = useState<LearnCard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const [grammarQs, setGrammarQs] = useState<GrammarQuizQuestion[]>([]);
  const [grammarIdx, setGrammarIdx] = useState(0);
  const [grammarChoice, setGrammarChoice] = useState<string | null>(null);
  const [grammarLoading, setGrammarLoading] = useState(false);

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const loadSummary = useCallback(() => {
    fetchLearnSummary().then(setSummary).catch(() => {});
    fetchLearnGoals().then(setGoals).catch(() => {});
  }, []);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setCardIdx(0);
    setSelectedChoice(null);
    setFlipped(false);
    try {
      const list = await fetchLearnDeck({
        mode: track,
        juz,
        page,
        onlyNew,
        limit: 20,
      });
      setCards(list);
    } finally {
      setLoading(false);
    }
  }, [track, juz, page, onlyNew]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (engineTab === "vocab") {
      loadDeck();
    } else {
      setGrammarLoading(true);
      setGrammarIdx(0);
      setGrammarChoice(null);
      fetchGrammarQuiz(engineTab, 10)
        .then(setGrammarQs)
        .finally(() => setGrammarLoading(false));
    }
  }, [engineTab, loadDeck]);

  const card = cards[cardIdx];

  async function handleQuizPick(choice: string) {
    if (!card || selectedChoice !== null) return;
    setSelectedChoice(choice);
    const isCorrect = choice === card.translation_id;
    await submitLearnAnswer(card.normalized_word, isCorrect);
    loadSummary();
  }

  async function handleFlashcardAnswer(isCorrect: boolean) {
    if (!card) return;
    await submitLearnAnswer(card.normalized_word, isCorrect);
    loadSummary();
    nextCard();
  }

  function nextCard() {
    setSelectedChoice(null);
    setFlipped(false);
    if (cardIdx + 1 < cards.length) {
      setCardIdx((i) => i + 1);
    } else {
      loadDeck();
    }
  }

  async function handleSaveToNotebook() {
    if (!card) return;
    await createVocabItem({
      item_type: "word",
      word_id: card.word_id,
      note: `Dari latihan /learn (${card.surah_name} ${card.surah_id}:${card.ayah_number})`,
    });
    setSavedToast("Tersimpan ke Notebook ✓");
    setTimeout(() => setSavedToast(null), 2000);
  }

  const masteredPct =
    summary && summary.total_unique_words > 0
      ? ((summary.mastered_words * 100) / summary.total_unique_words).toFixed(1)
      : "0.0";

  return (
    <main style={{ maxWidth: 1020, margin: "0 auto", padding: "1.5rem" }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Belajar Hafalan Terjemah Per Kata</h1>
          {summary && (
            <p style={{ margin: "0.25rem 0 0", color: "#57534e", fontSize: "0.88rem" }}>
              Dikuasai: <strong>{summary.mastered_words}</strong> / {summary.total_unique_words} kata unik ({masteredPct}%) ·{" "}
              Sedang belajar: <strong>{summary.learning_words}</strong> · Akurasi:{" "}
              <strong>
                {summary.total_correct + summary.total_wrong > 0
                  ? Math.round((summary.total_correct * 100) / (summary.total_correct + summary.total_wrong))
                  : 0}
                %
              </strong>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href="/mushaf" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", color: "#292524", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Mushaf
          </a>
          <a href="/tarjim" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", color: "#292524", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Tarjim
          </a>
        </div>
      </header>

      {/* Daily Learning Goal & Streak */}
      {goals && (
        <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "1rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", fontWeight: 700, marginBottom: "0.3rem" }}>
              <span>Target Harian: {goals.today_reviewed} / {goals.daily_target} soal</span>
              <span style={{ color: "#b45309" }}>🔥 Streak: {goals.current_streak} hari (Terbaik: {goals.longest_streak})</span>
            </div>
            <div style={{ height: 7, background: "#f5f5f4", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round((goals.today_reviewed * 100) / Math.max(1, goals.daily_target)))}%`, height: "100%", background: goals.today_reviewed >= goals.daily_target ? "#16a34a" : "#d97706" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.76rem", color: "#57534e" }}>Target:</span>
            {[10, 15, 25, 40].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateLearnGoals(t).then(setGoals).catch(() => {})}
                style={{
                  padding: "0.22rem 0.5rem",
                  borderRadius: 6,
                  border: "1px solid #d6cfc2",
                  background: goals.daily_target === t ? "#0f766e" : "#fff",
                  color: goals.daily_target === t ? "#fff" : "#292524",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Engine Tabs: Vocab vs Nahwu Quiz vs Sharaf Quiz */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {[
          { id: "vocab", label: "Kosakata (SRS & Adaptif)" },
          { id: "nahwu", label: "Kuis Nahwu (I‘rab)" },
          { id: "sarf", label: "Kuis Sharaf (Akar Kata)" },
        ].map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setEngineTab(tb.id as "vocab" | "nahwu" | "sarf")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 8,
              border: "1px solid #d6cfc2",
              background: engineTab === tb.id ? "#0f766e" : "#fff",
              color: engineTab === tb.id ? "#fff" : "#292524",
              fontWeight: 700,
              fontSize: "0.86rem",
              cursor: "pointer",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {engineTab !== "vocab" && (
        <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 14, padding: "1.5rem", minHeight: 280, marginBottom: "1.25rem" }}>
          {grammarLoading ? (
            <p style={{ textAlign: "center", color: "#57534e" }}>Menyiapkan soal {engineTab === "nahwu" ? "Nahwu" : "Sharaf"}...</p>
          ) : !grammarQs[grammarIdx] ? (
            <p style={{ textAlign: "center", color: "#57534e" }}>Tidak ada soal tersedia.</p>
          ) : (
            (() => {
              const gq = grammarQs[grammarIdx];
              return (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#78716c", marginBottom: "0.75rem" }}>
                    <span>Soal {grammarIdx + 1} / {grammarQs.length} · {engineTab.toUpperCase()}</span>
                    <span>QS. {gq.surah_name} ({gq.surah_id}:{gq.ayah_number})</span>
                  </div>
                  <div style={{ textAlign: "center", padding: "0.75rem 0" }}>
                    <div className="arabic-ui" style={{ fontSize: "2.4rem", color: "#1c1917" }}>{gq.arabic_text}</div>
                    <div style={{ fontSize: "0.85rem", color: "#57534e", marginBottom: "0.4rem" }}>Arti: {gq.translation_id || "—"}</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f766e" }}>{gq.prompt}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", maxWidth: 540, margin: "0.75rem auto 0" }}>
                    {gq.choices.map((ch) => {
                      const picked = grammarChoice === ch;
                      const isCorrect = ch === gq.correct_answer;
                      let bg = "#fafaf9";
                      let border = "1px solid #d6d3d1";
                      if (grammarChoice !== null) {
                        if (isCorrect) { bg = "#dcfce7"; border = "1.5px solid #16a34a"; }
                        else if (picked) { bg = "#fee2e2"; border = "1.5px solid #dc2626"; }
                      }
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={async () => {
                            if (grammarChoice !== null) return;
                            setGrammarChoice(ch);
                            const updated = await submitGrammarQuizLog(ch === gq.correct_answer).catch(() => null);
                            if (updated) setGoals(updated);
                          }}
                          className={engineTab === "sarf" ? "arabic-ui" : undefined}
                          style={{ padding: "0.65rem 0.85rem", borderRadius: 10, border, background: bg, cursor: grammarChoice ? "default" : "pointer", fontWeight: 600, fontSize: engineTab === "sarf" ? "1.15rem" : "0.88rem" }}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                  {grammarChoice !== null && (
                    <div style={{ marginTop: "1rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.82rem", color: "#44403c", background: "#f5f5f4", padding: "0.5rem 0.75rem", borderRadius: 8, maxWidth: 540, margin: "0 auto 0.75rem" }}>
                        {gq.explanation}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGrammarChoice(null);
                          if (grammarIdx + 1 < grammarQs.length) setGrammarIdx((i) => i + 1);
                          else {
                            setGrammarLoading(true);
                            setGrammarIdx(0);
                            fetchGrammarQuiz(engineTab, 10).then(setGrammarQs).finally(() => setGrammarLoading(false));
                          }
                        }}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                      >
                        Soal Berikutnya →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </section>
      )}

      {engineTab === "vocab" && (
      <>
      {/* Track & Mode Controls */}
      <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {[
            { id: "adaptive", label: "Adaptif" },
            { id: "due", label: `Due Review (${summary?.due_review_count ?? 0})` },
            { id: "frequency", label: "Frekuensi (80/20)" },
            { id: "juz", label: "Per Juz (1–30)" },
            { id: "page", label: "Per Halaman (1–604)" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrack(t.id as "due" | "adaptive" | "frequency" | "juz" | "page")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: track === t.id ? "#292524" : "#fafaf9",
                color: track === t.id ? "#fff" : "#292524",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              {t.label}
            </button>
          ))}

          {track === "juz" && (
            <>
              <select
                value={juz}
                onChange={(e) => setJuz(Number(e.target.value))}
                style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid #d6d3d1", fontSize: "0.85rem" }}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    Juz {j}
                  </option>
                ))}
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", color: "#44403c" }}>
                <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
                Hanya kata baru (sejak Al-Fatihah)
              </label>
            </>
          )}

          {track === "page" && (
            <input
              type="number"
              min={1}
              max={604}
              value={page}
              onChange={(e) => setPage(Math.min(604, Math.max(1, Number(e.target.value) || 1)))}
              style={{ width: 76, padding: "0.38rem 0.5rem", borderRadius: 8, border: "1px solid #d6d3d1", textAlign: "center" }}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            onClick={() => setPracticeMode("quiz")}
            style={{
              padding: "0.38rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #9a7b4f",
              background: practiceMode === "quiz" ? "#7c5c32" : "#fff",
              color: practiceMode === "quiz" ? "#fff" : "#7c5c32",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.84rem",
            }}
          >
            Kuis 4 Pilihan
          </button>
          <button
            type="button"
            onClick={() => setPracticeMode("flashcard")}
            style={{
              padding: "0.38rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #9a7b4f",
              background: practiceMode === "flashcard" ? "#7c5c32" : "#fff",
              color: practiceMode === "flashcard" ? "#fff" : "#7c5c32",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.84rem",
            }}
          >
            Flashcard
          </button>
        </div>
      </section>

      {/* Practice Card */}
      <section style={{ background: "#fffdf7", border: "1px solid #d6cfc2", borderRadius: 14, padding: "1.75rem", minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        {loading ? (
          <p style={{ color: "#57534e" }}>Menyiapkan dek latihan...</p>
        ) : !card ? (
          <p style={{ color: "#57534e" }}>Tidak ada kata ditemukan untuk filter ini.</p>
        ) : (
          <>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "#57534e" }}>
              <span>
                Kartu {cardIdx + 1} / {cards.length} · Muncul <strong>{card.frequency}×</strong> di{" "}
                {track === "juz" ? `Juz ${juz}` : track === "page" ? `Hal. ${page}` : "Al-Qur'an"}
              </span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {savedToast && <span style={{ color: "#15803d", fontWeight: 600 }}>{savedToast}</span>}
                <button
                  type="button"
                  onClick={handleSaveToNotebook}
                  style={{ padding: "0.25rem 0.6rem", borderRadius: 6, border: "1px solid #d6cfc2", background: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
                >
                  + Simpan ke Notebook
                </button>
              </div>
            </div>

            <div className="arabic-ui" style={{ fontSize: "3.2rem", lineHeight: 1.5, direction: "rtl", color: "#1c1917" }}>
              {card.arabic_text}
            </div>

            <div style={{ fontSize: "0.84rem", color: "#78716c" }}>
              <span className="arabic-ui" style={{ fontSize: "1.05rem" }}>{card.surah_name}</span> ({card.surah_id}:{card.ayah_number})
              {card.page_number ? ` · Hal. ${card.page_number}` : ""}
              {card.root && (
                <span>
                  {" "}· Root: <span className="arabic-ui" style={{ fontSize: "1.05rem" }}>{card.root.split("").join(" ")}</span>
                </span>
              )}
            </div>

            {practiceMode === "quiz" ? (
              <div style={{ width: "100%", maxWidth: 560, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.65rem", marginTop: "0.5rem" }}>
                {card.choices.map((ch) => {
                  const isPicked = selectedChoice === ch;
                  const isAnswer = ch === card.translation_id;
                  let bg = "#fff";
                  let border = "#d6d3d1";
                  if (selectedChoice !== null) {
                    if (isAnswer) {
                      bg = "#dcfce7";
                      border = "#16a34a";
                    } else if (isPicked) {
                      bg = "#fee2e2";
                      border = "#dc2626";
                    }
                  }
                  return (
                    <button
                      key={ch}
                      type="button"
                      disabled={selectedChoice !== null}
                      onClick={() => handleQuizPick(ch)}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: 10,
                        border: `1.5px solid ${border}`,
                        background: bg,
                        cursor: selectedChoice === null ? "pointer" : "default",
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "#1c1917",
                      }}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>
                {flipped ? (
                  <>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e3a5f" }}>
                      {card.translation_id}
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem" }}>
                      <button
                        type="button"
                        onClick={() => handleFlashcardAnswer(false)}
                        style={{ padding: "0.45rem 1rem", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontWeight: 600, cursor: "pointer" }}
                      >
                        Belum Hafal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlashcardAnswer(true)}
                        style={{ padding: "0.45rem 1rem", borderRadius: 8, border: "1px solid #86efac", background: "#dcfce7", color: "#166534", fontWeight: 600, cursor: "pointer" }}
                      >
                        Sudah Hafal ✓
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFlipped(true)}
                    style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "none", background: "#292524", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Tampilkan Arti
                  </button>
                )}
              </div>
            )}

            {practiceMode === "quiz" && selectedChoice !== null && (
              <button
                type="button"
                onClick={nextCard}
                style={{ marginTop: "0.5rem", padding: "0.5rem 1.35rem", borderRadius: 8, border: "none", background: "#7c5c32", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Kata Berikutnya →
              </button>
            )}
          </>
        )}
      </section>
      </>
      )}

      {/* Tadrij Learning Path */}
      {summary?.learning_path && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.65rem" }}>Learning Path Bertahap (Metode Tadrij)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.65rem" }}>
            {summary.learning_path.map((st) => (
              <div
                key={st.stage}
                style={{
                  padding: "0.75rem",
                  borderRadius: 10,
                  border: st.status === "completed" ? "1.5px solid #16a34a" : st.status === "active" ? "1.5px solid #0f766e" : "1px solid #e7e5e4",
                  background: "#fff",
                  opacity: st.status === "locked" ? 0.72 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.84rem", fontWeight: 700 }}>
                  <span>{st.title}</span>
                  <span style={{ fontSize: "0.74rem", color: st.status === "completed" ? "#16a34a" : "#0f766e" }}>
                    {st.progress_pct.toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#57534e", margin: "0.2rem 0 0.45rem" }}>{st.subtitle}</div>
                <div style={{ height: 5, background: "#f5f5f4", borderRadius: 999, overflow: "hidden", marginBottom: "0.5rem" }}>
                  <div style={{ width: `${Math.min(100, st.progress_pct)}%`, height: "100%", background: "#0f766e" }} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEngineTab("vocab");
                    setTrack(st.mode);
                    if (st.juz_number > 0) setJuz(st.juz_number);
                  }}
                  style={{ width: "100%", padding: "0.35rem", borderRadius: 6, border: "1px solid #d6cfc2", background: "#fafaf9", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}
                >
                  Latih Tahap Ini →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Juz 1-30 Progress Grid */}
      {summary?.juz_progress && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.65rem" }}>Progress Penguasaan Per Juz (1–30)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: "0.55rem" }}>
            {summary.juz_progress.map((jp) => {
              const pct = jp.unique_words > 0 ? Math.round((jp.mastered_words * 100) / jp.unique_words) : 0;
              return (
                <button
                  key={jp.juz_number}
                  type="button"
                  onClick={() => {
                    setTrack("juz");
                    setJuz(jp.juz_number);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "0.55rem 0.7rem",
                    borderRadius: 8,
                    border: track === "juz" && juz === jp.juz_number ? "1.5px solid #7c5c32" : "1px solid #e7e5e4",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700 }}>
                    <span>Juz {jp.juz_number}</span>
                    <span style={{ color: "#15803d" }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#78716c", marginTop: "0.15rem" }}>
                    {jp.mastered_words} / {jp.unique_words} kata
                  </div>
                  <div style={{ height: 4, background: "#f5f5f4", borderRadius: 999, marginTop: "0.35rem", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#16a34a" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
