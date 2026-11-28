"use client";

import { useEffect, useState } from "react";
import { fetchAyahIrab, type AyahIrabResponse } from "@/lib/api";

interface Props {
  target: { surah: number; ayah: number; surahName: string } | null;
  onClose: () => void;
}

const REL_COLOR_MAP: Record<string, string> = {
  jar_majrur: "#b91c1c",
  mudhaf_ilaih: "#7c3aed",
  khabar: "#0369a1",
  naat: "#047857",
};

const PHRASE_COLOR_MAP: Record<string, string> = {
  jar_majrur: "#b91c1c",
  idhafah: "#7c3aed",
  jumlah_ismiyah: "#0369a1",
  jumlah_filiyah: "#0f766e",
  shilah_maushul: "#b45309",
  klausa_syarat: "#be123c",
};

export default function AyahIrabDiagramModal({ target, onClose }: Props) {
  const [data, setData] = useState<AyahIrabResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOpinionIdx, setSelectedOpinionIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"diagram" | "tree">("diagram");

  useEffect(() => {
    if (!target) return;
    setLoading(true);
    setError(null);
    setSelectedOpinionIdx(0);
    fetchAyahIrab(target.surah, target.ayah)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat diagram"))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  const words = data?.words ?? [];
  const analyses = data?.analyses ?? [];
  const analysis = analyses[selectedOpinionIdx] ?? analyses[0];
  const nodes = analysis?.nodes ?? [];
  const relations = analysis?.relations ?? [];
  const phrases = analysis?.phrases ?? [];

  const colWidth = 116;
  const padX = 40;
  const svgWidth = Math.max(540, words.length * colWidth + padX * 2);
  const dotY = 128;

  const wordX = new Map<number, number>();
  const wordById = new Map<number, { arabic_text: string; word_number: number }>();
  words.forEach((w, idx) => {
    const x = svgWidth - padX - colWidth / 2 - idx * colWidth;
    wordX.set(w.word_id, x);
    wordById.set(w.word_id, { arabic_text: w.arabic_text, word_number: w.word_number });
  });

  const validRels = relations.filter(
    (r) => wordX.has(r.source_word_id) && wordX.has(r.target_word_id) && r.source_word_id !== r.target_word_id
  );
  const validPhrases = phrases.filter(
    (p) => wordX.has(p.start_word_id) && wordX.has(p.end_word_id)
  );

  const maxSpan = validRels.reduce((acc, r) => {
    const d = Math.abs((wordX.get(r.source_word_id) ?? 0) - (wordX.get(r.target_word_id) ?? 0));
    return Math.max(acc, d);
  }, colWidth);
  const arcBaseBottom = dotY + Math.min(185, Math.max(95, maxSpan * 0.42 + 45));
  const phraseAreaHeight = validPhrases.length > 0 ? validPhrases.length * 30 + 20 : 10;
  const svgHeight = arcBaseBottom + phraseAreaHeight;

  const roleByWord = new Map<number, { roleAr: string; roleLat: string; status: string }>();
  for (const n of nodes) {
    if (!roleByWord.has(n.word_id) || !n.role_latin.includes("Al-Ta'rif")) {
      roleByWord.set(n.word_id, {
        roleAr: n.role_arabic,
        roleLat: n.role_latin,
        status: n.irab_status,
      });
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          maxWidth: 980,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.65rem", gap: "0.75rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>
              Diagram Sintaksis &amp; Grammar Tree — <span className="arabic-ui">{target.surahName}</span> ({target.surah}:{target.ayah})
            </h3>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "#57534e" }}>
              Urutan kanan-ke-kiri (RTL) · {words.length} kata · {validRels.length} relasi · {validPhrases.length} frasa/klausa
            </p>
            {analysis && (
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.45rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 999,
                    fontWeight: 700,
                    background:
                      analysis.validation_status === "verified"
                        ? "#dcfce7"
                        : analysis.validation_status === "needs_review"
                          ? "#fef3c7"
                          : "#e0f2fe",
                    color:
                      analysis.validation_status === "verified"
                        ? "#166534"
                        : analysis.validation_status === "needs_review"
                          ? "#92400e"
                          : "#075985",
                  }}
                >
                  {analysis.validation_status === "verified"
                    ? "✓ Terverifikasi"
                    : analysis.validation_status === "needs_review"
                      ? "⚠ Perlu Review"
                      : "● Auto-Validated"}
                  {typeof analysis.confidence_score === "number"
                    ? ` (${Math.round(analysis.confidence_score * 100)}%)`
                    : ""}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#57534e" }}>
                  Sumber: <strong>{analysis.source?.name || "—"}</strong>
                  {analysis.source?.author ? ` (${analysis.source.author})` : ""}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: "1.4rem", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* Opinion Switcher & View Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.65rem" }}>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setViewMode("diagram")}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: viewMode === "diagram" ? "#0f766e" : "#fff",
                color: viewMode === "diagram" ? "#fff" : "#292524",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Diagram Busur &amp; Frasa
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: viewMode === "tree" ? "#0f766e" : "#fff",
                color: viewMode === "tree" ? "#fff" : "#292524",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Grammar / Syntax Tree
            </button>
          </div>

          {analyses.length > 1 && (
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "#57534e", fontWeight: 600 }}>Pendapat I‘rab:</span>
              {analyses.map((a, idx) => (
                <button
                  key={a.analysis_id}
                  type="button"
                  onClick={() => setSelectedOpinionIdx(idx)}
                  style={{
                    padding: "0.25rem 0.6rem",
                    borderRadius: 999,
                    border: "1px solid #d6cfc2",
                    background: idx === selectedOpinionIdx ? "#7c3aed" : "#fafaf9",
                    color: idx === selectedOpinionIdx ? "#fff" : "#292524",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {a.opinion_label === "alternatif" ? "Alternatif" : "Utama"} ({idx + 1})
                </button>
              ))}
            </div>
          )}
        </div>

        {analysis?.summary && (
          <div style={{ fontSize: "0.8rem", color: "#44403c", background: "#f5f5f4", padding: "0.45rem 0.7rem", borderRadius: 8, marginBottom: "0.65rem" }}>
            {analysis.summary}
          </div>
        )}

        <div style={{ overflowX: "auto", overflowY: "auto", border: "1px solid #e7e5e4", borderRadius: 10, background: "#fffdf9", padding: "0.75rem" }}>
          {loading && <p style={{ textAlign: "center" }}>Memuat diagram i‘rab...</p>}
          {!loading && !error && data && viewMode === "tree" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <div style={{ padding: "0.55rem 0.75rem", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, fontWeight: 700, color: "#065f46", fontSize: "0.88rem" }}>
                🌳 Struktur Pohon Ayat ({target.surah}:{target.ayah})
              </div>
              {validPhrases.length > 0 && (
                <div style={{ paddingLeft: "1rem", borderLeft: "2px solid #cbd5e1", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {validPhrases.map((ph) => {
                    const color = PHRASE_COLOR_MAP[ph.phrase_type] || "#475569";
                    const phWords = words.filter((w) => w.word_id >= ph.start_word_id && w.word_id <= ph.end_word_id);
                    return (
                      <div key={ph.id} style={{ padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid #e7e5e4", borderLeft: `4px solid ${color}`, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <div>
                            <strong style={{ color, fontSize: "0.84rem" }}>{ph.phrase_latin}</strong>{" "}
                            <span className="arabic-ui" style={{ fontSize: "1.05rem" }}>{ph.phrase_arabic}</span>
                            {ph.mahal_irab && <span className="arabic-ui" style={{ fontSize: "0.9rem", color: "#475569" }}> ({ph.mahal_irab})</span>}
                          </div>
                          <span className="arabic-ui" style={{ fontSize: "1.15rem", direction: "rtl" }}>
                            {phWords.map((w) => w.arabic_text).join(" ")}
                          </span>
                        </div>
                        {ph.explanation && <div style={{ fontSize: "0.77rem", color: "#57534e", marginTop: "0.2rem" }}>{ph.explanation}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ paddingLeft: "1rem", borderLeft: "2px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: "0.5rem" }}>
                {words.map((w) => {
                  const wordNodes = nodes.filter((n) => n.word_id === w.word_id);
                  return (
                    <div key={w.word_id} style={{ border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.5rem", background: "#fff" }}>
                      <div className="arabic-ui" style={{ fontSize: "1.3rem", textAlign: "right", color: "#1c1917" }}>{w.arabic_text}</div>
                      <div style={{ fontSize: "0.75rem", color: "#57534e", marginBottom: "0.25rem" }}>{w.translation_id}</div>
                      {wordNodes.map((n) => (
                        <div key={n.node_id} style={{ fontSize: "0.75rem", borderTop: "1px dashed #e7e5e4", paddingTop: "0.2rem", marginTop: "0.2rem" }}>
                          <div style={{ fontWeight: 700, color: "#0f766e" }}>{n.role_latin || n.role_arabic}</div>
                          {n.amil && <div style={{ color: "#78716c" }}>Amil: <span className="arabic-ui">{n.amil}</span></div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p style={{ textAlign: "center", color: "#b91c1c" }}>{error}</p>}

          {!loading && !error && viewMode === "diagram" && words.length > 0 && (
            <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ display: "block", margin: "0 auto" }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                </marker>
              </defs>

              {/* Dependency Arcs */}
              {validRels.map((rel, idx) => {
                const x1 = wordX.get(rel.source_word_id)!;
                const x2 = wordX.get(rel.target_word_id)!;
                const span = Math.abs(x1 - x2);
                const depth = Math.min(165, Math.max(46, span * 0.4 + (idx % 2) * 14));
                const cx = (x1 + x2) / 2;
                const cy = dotY + depth;
                const labelY = dotY + depth * 0.56 + 14;
                const color = REL_COLOR_MAP[rel.relation_type] ?? "#0369a1";

                return (
                  <g key={rel.id}>
                    <path
                      d={`M ${x1} ${dotY + 4} Q ${cx} ${cy} ${x2} ${dotY + 4}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.8}
                      markerEnd="url(#arrow)"
                    />
                    <rect x={cx - 42} y={labelY - 12} width={84} height={18} rx={9} fill="#fff" stroke={color} strokeWidth={0.8} />
                    <text x={cx} y={labelY} textAnchor="middle" fontSize="11" fontWeight="600" fill={color} className="arabic-ui">
                      {rel.description || rel.relation_type}
                    </text>
                  </g>
                );
              })}

              {/* Phrase & Clause Horizontal Spans (PP, NS, VS, Idhafah, Shilah, Syarth) */}
              {validPhrases.map((ph, idx) => {
                const xStart = wordX.get(ph.start_word_id)!;
                const xEnd = wordX.get(ph.end_word_id)!;
                const leftX = Math.min(xStart, xEnd) - 34;
                const rightX = Math.max(xStart, xEnd) + 34;
                const midX = (leftX + rightX) / 2;
                const y = arcBaseBottom + idx * 30;
                const color = PHRASE_COLOR_MAP[ph.phrase_type] ?? "#334155";

                return (
                  <g key={ph.id}>
                    <line x1={leftX} y1={y} x2={rightX} y2={y} stroke={color} strokeWidth={2.2} />
                    <line x1={leftX} y1={y - 5} x2={leftX} y2={y + 2} stroke={color} strokeWidth={1.6} />
                    <line x1={rightX} y1={y - 5} x2={rightX} y2={y + 2} stroke={color} strokeWidth={1.6} />
                    <rect x={midX - 58} y={y + 4} width={116} height={18} rx={9} fill="#fff" stroke={color} strokeWidth={0.8} />
                    <text x={midX} y={y + 16} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={color} className="arabic-ui">
                      {ph.phrase_arabic}
                    </text>
                  </g>
                );
              })}

              {/* Words & Node Dots */}
              {words.map((w) => {
                const x = wordX.get(w.word_id)!;
                const info = roleByWord.get(w.word_id);
                return (
                  <g key={w.word_id}>
                    <text x={x} y={20} textAnchor="middle" fontSize="10" fill="#78716c">
                      ({target.surah}:{target.ayah}:{w.word_number})
                    </text>
                    <text x={x} y={34} textAnchor="middle" fontSize="11" fill="#44403c">
                      {w.translation_id.length > 14 ? `${w.translation_id.slice(0, 13)}…` : w.translation_id}
                    </text>
                    <text x={x} y={76} textAnchor="middle" fontSize="26" fill="#1c1917" className="arabic-ui">
                      {w.arabic_text}
                    </text>
                    <text x={x} y={102} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0f766e" className="arabic-ui">
                      {info?.roleAr ?? ""}
                    </text>
                    <text x={x} y={116} textAnchor="middle" fontSize="9.5" fill="#64748b">
                      {info?.roleLat ?? ""}
                    </text>
                    <circle cx={x} cy={dotY} r={4} fill="#7c5c32" />
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Phrase & Sentence Explorer Breakdown */}
        {!loading && validPhrases.length > 0 && (
          <div style={{ marginTop: "0.75rem", maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#57534e" }}>
              Phrase &amp; Sentence Explorer ({validPhrases.length})
            </div>
            {validPhrases.map((ph) => {
              const color = PHRASE_COLOR_MAP[ph.phrase_type] ?? "#334155";
              const sw = words.find((w) => w.word_id === ph.start_word_id);
              const ew = words.find((w) => w.word_id === ph.end_word_id);
              const spanText = words
                .filter((w) => sw && ew && w.word_number >= sw.word_number && w.word_number <= ew.word_number)
                .map((w) => w.arabic_text)
                .join(" ");

              return (
                <div
                  key={ph.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.45rem 0.7rem",
                    border: "1px solid #e7e5e4",
                    borderLeft: `4px solid ${color}`,
                    borderRadius: 8,
                    fontSize: "0.84rem",
                    background: "#fafaf9",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color }}>{ph.phrase_latin}</span>
                      <span className="arabic-ui" style={{ fontSize: "1.1rem", fontWeight: 600 }}>{ph.phrase_arabic}</span>
                      {ph.mahal_irab && (
                        <span className="arabic-ui" style={{ fontSize: "0.95rem", color: "#475569" }}>
                          ({ph.mahal_irab})
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#57534e", fontSize: "0.78rem" }}>{ph.explanation}</div>
                  </div>
                  <span className="arabic-ui" style={{ fontSize: "1.3rem", direction: "rtl", whiteSpace: "nowrap" }}>
                    {spanText}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
