"use client";

import type { WordDetailResponse } from "@/lib/api";

interface Props {
  loading: boolean;
  error: string | null;
  word: WordDetailResponse | null;
  onSelectRoot: (rootId: number, rootText: string) => void;
}

export default function WordExplorerPanel({ loading, error, word, onSelectRoot }: Props) {
  return (
    <aside className="word-panel" aria-live="polite">
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>
        Word &amp; I‘rab Explorer
      </h2>

      {loading && <p style={{ color: "#57534e", fontSize: "0.9rem" }}>Memuat detail kata...</p>}
      {error && <p style={{ color: "#b91c1c", fontSize: "0.9rem" }}>{error}</p>}

      {!loading && !error && !word && (
        <p style={{ color: "#57534e", fontSize: "0.9rem", margin: 0 }}>
          Klik kata mana saja pada halaman Mushaf untuk melihat terjemahan Indonesia, morfologi (Sharaf), dan kedudukan gramatikal (I‘rab / Nahwu).
        </p>
      )}

      {!loading && word && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #f5f5f4", paddingBottom: "0.6rem" }}>
            <span style={{ fontSize: "2rem", direction: "rtl" }}>{word.arabic_text}</span>
            <span style={{ fontSize: "0.82rem", color: "#57534e" }}>
              {word.surah_name} {word.surah_id}:{word.ayah_number}:{word.word_number}
            </span>
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#78716c", letterSpacing: "0.04em" }}>
              Terjemahan (ID)
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600, marginTop: "0.15rem" }}>
              {word.translation_id || "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#78716c", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
              Morphology / Sharaf ({word.morphology?.length ?? 0} segmen)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {(word.morphology ?? []).map((seg) => (
                <div
                  key={seg.segment_number}
                  style={{
                    padding: "0.5rem 0.65rem",
                    background: "#fafaf9",
                    border: "1px solid #e7e5e4",
                    borderRadius: 8,
                    fontSize: "0.84rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                    <span style={{ fontSize: "1.1rem" }}>{seg.segment_arabic}</span>
                    <span>POS: {seg.pos}</span>
                  </div>
                  <div style={{ color: "#57534e", marginTop: "0.2rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    {seg.root && seg.root_id && (
                      <button
                        type="button"
                        onClick={() => onSelectRoot(seg.root_id!, seg.root)}
                        style={{
                          background: "#fef3c7",
                          border: "1px solid #f59e0b",
                          borderRadius: 6,
                          padding: "0.1rem 0.45rem",
                          cursor: "pointer",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#78350f",
                        }}
                      >
                        Root: {seg.root} ↗
                      </button>
                    )}
                    {seg.lemma && <span>Lemma: {seg.lemma}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#78716c", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
              I‘rab / Nahwu ({word.irab?.length ?? 0} segmen)
            </div>
            {(!word.irab || word.irab.length === 0) ? (
              <p style={{ fontSize: "0.84rem", color: "#78716c", margin: 0 }}>Belum tersedia untuk kata ini.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {word.irab.map((node) => (
                  <div
                    key={node.node_id}
                    style={{
                      padding: "0.55rem 0.65rem",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: "0.84rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{node.role_arabic}</span>
                      <span style={{ color: "#475569", fontSize: "0.78rem" }}>{node.role_latin}</span>
                    </div>
                    <div style={{ color: "#334155", marginTop: "0.2rem" }}>
                      {node.irab_status && <span>Status: <strong>{node.irab_status}</strong></span>}
                      {node.irab_sign && <span> · Tanda: {node.irab_sign}</span>}
                    </div>
                    {node.explanation && (
                      <div style={{ color: "#64748b", fontSize: "0.76rem", marginTop: "0.2rem" }}>
                        {node.explanation}
                      </div>
                    )}
                    <div style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "0.2rem" }}>
                      Sumber: {node.source} ({node.opinion})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
