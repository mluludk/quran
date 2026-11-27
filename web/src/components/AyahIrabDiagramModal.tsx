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

export default function AyahIrabDiagramModal({ target, onClose }: Props) {
  const [data, setData] = useState<AyahIrabResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setLoading(true);
    setError(null);
    fetchAyahIrab(target.surah, target.ayah)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat diagram"))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  const words = data?.words ?? [];
  const analysis = data?.analyses?.[0];
  const nodes = analysis?.nodes ?? [];
  const relations = analysis?.relations ?? [];

  // Layout constants (RTL: word 0 on the right, last word on the left)
  const colWidth = 116;
  const padX = 40;
  const svgWidth = Math.max(540, words.length * colWidth + padX * 2);
  const dotY = 128;

  // Map word_id -> X center coordinate (right-to-left)
  const wordX = new Map<number, number>();
  words.forEach((w, idx) => {
    const x = svgWidth - padX - colWidth / 2 - idx * colWidth;
    wordX.set(w.word_id, x);
  });

  // Compute arc heights so overlapping arcs stack cleanly
  const validRels = relations.filter(
    (r) => wordX.has(r.source_word_id) && wordX.has(r.target_word_id) && r.source_word_id !== r.target_word_id
  );
  const maxSpan = validRels.reduce((acc, r) => {
    const d = Math.abs((wordX.get(r.source_word_id) ?? 0) - (wordX.get(r.target_word_id) ?? 0));
    return Math.max(acc, d);
  }, colWidth);
  const svgHeight = dotY + Math.min(220, Math.max(110, maxSpan * 0.45 + 65));

  // Group primary role label per word
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
          maxWidth: 960,
          width: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>
              Diagram Sintaksis I‘rab — <span className="arabic-ui">{target.surahName}</span> ({target.surah}:{target.ayah})
            </h3>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "#57534e" }}>
              Urutan kanan-ke-kiri (RTL) · {words.length} kata · {validRels.length} relasi nahwu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: "1.4rem", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowX: "auto", overflowY: "auto", border: "1px solid #e7e5e4", borderRadius: 10, background: "#fffdf9", padding: "0.75rem" }}>
          {loading && <p style={{ textAlign: "center" }}>Memuat diagram i‘rab...</p>}
          {error && <p style={{ textAlign: "center", color: "#b91c1c" }}>{error}</p>}

          {!loading && !error && words.length > 0 && (
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
                const depth = Math.min(180, Math.max(48, span * 0.42 + (idx % 2) * 14));
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
                    <rect
                      x={cx - 42}
                      y={labelY - 12}
                      width={84}
                      height={18}
                      rx={9}
                      fill="#fff"
                      stroke={color}
                      strokeWidth={0.8}
                    />
                    <text
                      x={cx}
                      y={labelY}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill={color}
                      className="arabic-ui"
                    >
                      {rel.description || rel.relation_type}
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.75rem", fontSize: "0.78rem", color: "#57534e" }}>
          <span style={{ color: "#b91c1c" }}>● Jar wa Majrur</span>
          <span style={{ color: "#7c3aed" }}>● Mudhaf &amp; Mudhaf Ilaih</span>
          <span style={{ color: "#0369a1" }}>● Mubtada&apos; &amp; Khabar</span>
          <span style={{ color: "#047857" }}>● Na&apos;at &amp; Man&apos;ut</span>
        </div>
      </div>
    </div>
  );
}
