"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createVocabItem,
  fetchLearnDeck,
  fetchLearnSummary,
  submitLearnAnswer,
  type LearnCard,
  type LearnSummaryResponse,
} from "@/lib/api";

export default function LearnClient() {
  const [summary, setSummary] = useState<LearnSummaryResponse | null>(null);
  const [track, setTrack] = useState<"frequency" | "juz" | "page">("frequency");
  const [juz, setJuz] = useState(30);
  const [page, setPage] = useState(1);
  const [onlyNew, setOnlyNew] = useState(true);
  const [practiceMode, setPracticeMode] = useState<"quiz" | "flashcard">("quiz");

  const [cards, setCards] = useState<LearnCard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const loadSummary = useCallback(() => {
    fetchLearnSummary().then(setSummary).catch(() => {});
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
    loadDeck();
  }, [loadDeck]);

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

      {/* Track & Mode Controls */}
      <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {[
            { id: "frequency", label: "Frekuensi (80/20)" },
            { id: "juz", label: "Per Juz (1–30)" },
            { id: "page", label: "Per Halaman (1–604)" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrack(t.id as "frequency" | "juz" | "page")}
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
