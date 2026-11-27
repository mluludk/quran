"use client";

import { useEffect, useState } from "react";
import { fetchWordContext, searchArabic, type WordContextResponse } from "@/lib/api";

const CONCEPT_PRESETS = [
  { label: "تقوى", sub: "Taqwa", wordId: 27186 },
  { label: "إيمان", sub: "Iman", wordId: 37 },
  { label: "صبر", sub: "Sabar", wordId: 67148 },
  { label: "رحمة", sub: "Rahmat", wordId: 6565 },
  { label: "هدى", sub: "Huda", wordId: 44 },
];

export default function ContextExplorerClient({ initialWordId }: { initialWordId: number }) {
  const [wordId, setWordId] = useState(initialWordId);
  const [pairRootId, setPairRootId] = useState<number>(0);
  const [meaning, setMeaning] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<WordContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchWordContext(wordId, { pairRootId, meaning, limit: 15, offset })
      .then(setData)
      .finally(() => setLoading(false));
  }, [wordId, pairRootId, meaning, offset]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const res = await searchArabic(query.trim(), 1, 0);
    const first = res.data?.[0];
    if (first) {
      setWordId(first.word_id);
      setPairRootId(0);
      setMeaning("");
      setOffset(0);
    }
  }

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "1.5rem" }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Semantic &amp; Context Explorer</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#57534e", fontSize: "0.88rem" }}>
            Eksplorasi pasangan kata (<em>collocation</em>), nuansa makna kontekstual, dan perbandingan penggunaan dalam ayat Al-Qur&apos;an.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href="/mushaf" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", color: "#292524", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Mushaf
          </a>
          <a href="/frequency" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", color: "#292524", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Frekuensi
          </a>
          <a href="/learn" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #166534", background: "#f0fdf4", color: "#166534", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Belajar
          </a>
        </div>
      </header>

      {/* Presets & Search */}
      <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#57534e" }}>Istilah Kunci:</span>
          {CONCEPT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setWordId(p.wordId);
                setPairRootId(0);
                setMeaning("");
                setOffset(0);
              }}
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: 999,
                border: wordId === p.wordId ? "1.5px solid #7c5c32" : "1px solid #d6cfc2",
                background: wordId === p.wordId ? "#fffdf7" : "#fafaf9",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.86rem",
              }}
            >
              <span className="arabic-ui" style={{ fontSize: "1.15rem" }}>{p.label}</span>{" "}
              <span style={{ color: "#78716c", fontSize: "0.76rem" }}>({p.sub})</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.4rem" }}>
          <input
            type="text"
            dir="rtl"
            className="arabic-ui"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kata Arab lain..."
            style={{ padding: "0.35rem 0.65rem", borderRadius: 8, border: "1px solid #d6d3d1", fontSize: "1.05rem", width: 200 }}
          />
          <button type="submit" style={{ padding: "0.38rem 0.8rem", borderRadius: 8, border: "none", background: "#292524", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Eksplorasi
          </button>
        </form>
      </section>

      {loading || !data ? (
        <p>Memuat analisis konteks...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: "1.25rem", alignItems: "start" }}>
          {/* Left: Meaning Nuances & Co-occurring Roots */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#57534e", marginBottom: "0.45rem" }}>
                Nuansa Terjemahan Kontekstual
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {(data.meaning_groups ?? []).map((mg) => {
                  const active = meaning === mg.translation;
                  return (
                    <button
                      key={mg.translation}
                      type="button"
                      onClick={() => {
                        setMeaning(active ? "" : mg.translation);
                        setOffset(0);
                      }}
                      style={{
                        padding: "0.24rem 0.55rem",
                        borderRadius: 8,
                        border: active ? "1.5px solid #2563eb" : "1px solid #e7e5e4",
                        background: active ? "#eff6ff" : "#fafaf9",
                        color: active ? "#1d4ed8" : "#292524",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {mg.translation} ({mg.count}×)
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#57534e", marginBottom: "0.45rem" }}>
                Kata yang Sering Berpasangan (Klik untuk Filter)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "52vh", overflowY: "auto" }}>
                {(data.collocations ?? []).map((col) => {
                  const active = pairRootId === col.root_id;
                  return (
                    <button
                      key={col.root_id}
                      type="button"
                      onClick={() => {
                        setPairRootId(active ? 0 : col.root_id);
                        setOffset(0);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.45rem 0.65rem",
                        borderRadius: 8,
                        border: active ? "1.5px solid #7c5c32" : "1px solid #e7e5e4",
                        background: active ? "#fffdf7" : "#fafaf9",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <span className="arabic-ui" style={{ fontSize: "1.25rem", marginRight: "0.45rem" }}>
                          {col.sample_arabic}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#57534e" }}>
                          ({col.root_text.split("").join(" ")}) · {col.sample_translation}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#7c5c32" }}>
                        {col.ayah_count} ayat
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right: Contextual Ayahs */}
          <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #f5f5f4", paddingBottom: "0.75rem", marginBottom: "0.85rem" }}>
              <div>
                <span className="arabic-ui" style={{ fontSize: "2.25rem" }}>{data.arabic_text}</span>
                <span style={{ marginLeft: "0.65rem", fontWeight: 600, color: "#1e3a5f" }}>
                  “{data.translation_id}”
                </span>
              </div>
              <span style={{ fontSize: "0.84rem", color: "#57534e" }}>
                {data.pagination.total} ayat cocok
                {(pairRootId > 0 || meaning) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPairRootId(0);
                      setMeaning("");
                      setOffset(0);
                    }}
                    style={{ marginLeft: "0.5rem", fontSize: "0.78rem", color: "#b91c1c", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Reset filter
                  </button>
                )}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {(data.ayahs ?? []).map((a) => (
                <div key={`${a.ayah_id}-${a.word_id}`} style={{ padding: "0.75rem 0.9rem", borderRadius: 10, border: "1px solid #e7e5e4", background: "#fffdf9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#57534e", marginBottom: "0.3rem" }}>
                    <span>
                      <span className="arabic-ui" style={{ fontSize: "1rem" }}>{a.surah_name}</span> ({a.surah_id}:{a.ayah_number}) · Arti kata:{" "}
                      <strong>{a.translation_id}</strong>
                    </span>
                    {a.page_number && <span>Hal. {a.page_number}</span>}
                  </div>
                  <div className="arabic-ui" style={{ fontSize: "1.45rem", direction: "rtl", lineHeight: 1.8 }}>
                    {a.ayah_text}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.85rem", fontSize: "0.84rem" }}>
              <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 15))}>
                ← Sebelumnya
              </button>
              <span>
                {data.pagination.total === 0 ? 0 : offset + 1}–{Math.min(offset + 15, data.pagination.total)} dari {data.pagination.total}
              </span>
              <button type="button" disabled={offset + 15 >= data.pagination.total} onClick={() => setOffset((o) => o + 15)}>
                Berikutnya →
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
