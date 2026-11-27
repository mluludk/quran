"use client";

import { useEffect, useState } from "react";
import {
  fetchTopFrequency,
  fetchWordFrequency,
  searchArabic,
  type TopFrequencyItem,
  type WordFrequencyResponse,
} from "@/lib/api";

export default function FrequencyClient({ initialWordId }: { initialWordId: number }) {
  const [kind, setKind] = useState<"words" | "roots">("words");
  const [topList, setTopList] = useState<TopFrequencyItem[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<number>(initialWordId);
  const [freq, setFreq] = useState<WordFrequencyResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchTopFrequency(kind, 30).then(setTopList).catch(() => {});
  }, [kind]);

  useEffect(() => {
    setLoading(true);
    fetchWordFrequency(selectedWordId, 12, offset)
      .then(setFreq)
      .finally(() => setLoading(false));
  }, [selectedWordId, offset]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const res = await searchArabic(query.trim(), 1, 0);
    const first = res.data?.[0];
    if (first) {
      setOffset(0);
      setSelectedWordId(first.word_id);
    }
  }

  return (
    <main style={{ maxWidth: 1140, margin: "0 auto", padding: "1.5rem" }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Quran Vocabulary Frequency</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#57534e", fontSize: "0.88rem" }}>
            Statistik kemunculan kata, variasi bentuk, akar kata, distribusi Makkiyah/Madaniyah, dan perbandingan konteks ayat.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href="/mushaf" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", color: "#292524", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Mushaf
          </a>
          <a href="/tarjim" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", color: "#292524", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Tarjim
          </a>
          <a href="/learn" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #166534", background: "#f0fdf4", color: "#166534", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>
            Belajar
          </a>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "1.25rem", alignItems: "start" }}>
        {/* Left: Leaderboard + Search */}
        <aside style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <input
              type="text"
              dir="rtl"
              className="arabic-ui"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kata (mis. رحمة)..."
              style={{ flex: 1, padding: "0.35rem 0.6rem", borderRadius: 8, border: "1px solid #d6d3d1", fontSize: "1.05rem" }}
            />
            <button type="submit" style={{ padding: "0.35rem 0.7rem", borderRadius: 8, border: "none", background: "#7c5c32", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Cari
            </button>
          </form>

          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setKind("words")}
              style={{ flex: 1, padding: "0.35rem", borderRadius: 8, border: "1px solid #d6cfc2", background: kind === "words" ? "#292524" : "#fff", color: kind === "words" ? "#fff" : "#292524", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
            >
              Kata Terbanyak
            </button>
            <button
              type="button"
              onClick={() => setKind("roots")}
              style={{ flex: 1, padding: "0.35rem", borderRadius: 8, border: "1px solid #d6cfc2", background: kind === "roots" ? "#292524" : "#fff", color: kind === "roots" ? "#fff" : "#292524", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
            >
              Akar Terbanyak
            </button>
          </div>

          <div style={{ maxHeight: "65vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {topList.map((item, idx) => {
              const targetWid = item.word_id ?? item.sample_word_id ?? 1;
              return (
                <button
                  key={`${kind}-${idx}`}
                  type="button"
                  onClick={() => {
                    setOffset(0);
                    setSelectedWordId(targetWid);
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.45rem 0.65rem",
                    borderRadius: 8,
                    border: selectedWordId === targetWid ? "1.5px solid #7c5c32" : "1px solid #e7e5e4",
                    background: selectedWordId === targetWid ? "#fffdf7" : "#fafaf9",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <span className="arabic-ui" style={{ fontSize: "1.3rem", marginRight: "0.5rem" }}>
                      {kind === "roots" ? item.arabic_text.split("").join(" ") : item.arabic_text}
                    </span>
                    {item.translation_id && (
                      <span style={{ fontSize: "0.8rem", color: "#57534e" }}>{item.translation_id}</span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#7c5c32" }}>
                    {item.count}×
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: Detailed Frequency & Context Comparison */}
        <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {loading || !freq ? (
            <p>Memuat statistik frekuensi...</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #f5f5f4", paddingBottom: "0.75rem" }}>
                <div>
                  <span className="arabic-ui" style={{ fontSize: "2.5rem" }}>{freq.arabic_text}</span>
                  <span style={{ marginLeft: "0.75rem", fontSize: "1.05rem", fontWeight: 600, color: "#1e3a5f" }}>
                    “{freq.translation_id}”
                  </span>
                </div>
                {freq.root?.arabic_text && (
                  <span style={{ padding: "0.25rem 0.7rem", borderRadius: 999, background: "#fef3c7", color: "#78350f", fontSize: "0.86rem", fontWeight: 600 }}>
                    Root: <span className="arabic-ui" style={{ fontSize: "1.15rem" }}>{freq.root.arabic_text.split("").join(" ")}</span> ({freq.root.count}×)
                  </span>
                )}
              </div>

              {/* Stat Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.65rem" }}>
                {[
                  { label: "Kemunculan Kata", val: `${freq.word_count}×` },
                  { label: "Kemunculan Root", val: freq.root?.count ? `${freq.root.count}×` : "—" },
                  { label: "Jumlah Surah", val: `${freq.surah_count} surah` },
                  { label: "Makkiyah / Madaniyah", val: `${freq.makkiyah_count} / ${freq.madaniyah_count}` },
                ].map((c) => (
                  <div key={c.label} style={{ padding: "0.65rem 0.8rem", borderRadius: 10, background: "#fafaf9", border: "1px solid #e7e5e4" }}>
                    <div style={{ fontSize: "0.74rem", color: "#78716c" }}>{c.label}</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: "0.15rem" }}>{c.val}</div>
                  </div>
                ))}
              </div>

              {/* Variations */}
              {freq.variations && freq.variations.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#57534e", marginBottom: "0.4rem" }}>
                    Variasi Bentuk Kata ({freq.variations.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {freq.variations.map((v) => (
                      <span key={v.arabic_text} style={{ padding: "0.25rem 0.6rem", borderRadius: 8, background: "#fffdf7", border: "1px solid #e7e5e4", fontSize: "0.85rem" }}>
                        <span className="arabic-ui" style={{ fontSize: "1.2rem" }}>{v.arabic_text}</span>{" "}
                        <strong style={{ color: "#7c5c32" }}>({v.count}×)</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Surahs */}
              {freq.top_surahs && freq.top_surahs.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#57534e", marginBottom: "0.4rem" }}>
                    Surah Terbanyak
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {freq.top_surahs.map((s) => (
                      <span key={s.surah_id} style={{ padding: "0.22rem 0.6rem", borderRadius: 999, background: "#f5f5f4", fontSize: "0.8rem" }}>
                        {s.transliteration} ({s.count}×)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Occurrences */}
              <div>
                <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#57534e", marginBottom: "0.45rem" }}>
                  Perbandingan Penggunaan dalam Konteks ({freq.word_count} ayat)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {(freq.occurrences ?? []).map((occ) => (
                    <div key={occ.word_id} style={{ padding: "0.7rem 0.85rem", borderRadius: 10, border: "1px solid #e7e5e4", background: "#fffdf9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#57534e", marginBottom: "0.3rem" }}>
                        <span>
                          <span className="arabic-ui" style={{ fontSize: "1rem" }}>{occ.surah_name}</span> ({occ.surah_id}:{occ.ayah_number}) · Arti kata: <strong>{occ.translation_id}</strong>
                        </span>
                        {occ.page_number && <span>Hal. {occ.page_number}</span>}
                      </div>
                      <div className="arabic-ui" style={{ fontSize: "1.4rem", direction: "rtl", lineHeight: 1.75 }}>
                        {occ.ayah_text}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", fontSize: "0.84rem" }}>
                  <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 12))}>
                    ← Sebelumnya
                  </button>
                  <span>
                    {offset + 1}–{Math.min(offset + 12, freq.word_count)} dari {freq.word_count}
                  </span>
                  <button type="button" disabled={offset + 12 >= freq.word_count} onClick={() => setOffset((o) => o + 12)}>
                    Berikutnya →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
