"use client";

import type { WordDetailResponse } from "@/lib/api";

interface Props {
  loading: boolean;
  error: string | null;
  word: WordDetailResponse | null;
  onSelectRoot: (rootId: number, rootText: string) => void;
  onOpenAyahDiagram: (surah: number, ayah: number, surahName: string) => void;
}

const POS_ARABIC_MAP: Record<string, string> = {
  N: "Isim",
  V: "Fi'il",
  P: "Harf",
};

const POS_ENGLISH_MAP: Record<string, string> = {
  N: "Noun (Isim)",
  V: "Verb (Fi'il)",
  P: "Particle (Harf)",
};

const STATUS_ARABIC_MAP: Record<string, string> = {
  "marfu'": "مرفوع",
  mansub: "منصوب",
  majrur: "مجرور",
  majzum: "مجزوم",
  mabni: "مبني",
};

const STATUS_LABEL_MAP: Record<string, string> = {
  "marfu'": "Marfu'",
  mansub: "Mansub",
  majrur: "Majrur",
  majzum: "Majzum",
  mabni: "Mabni",
};

function formatSpacedRoot(root: string): string {
  return root.split("").join(" ");
}

export default function WordExplorerPanel({ loading, error, word, onSelectRoot, onOpenAyahDiagram }: Props) {
  const stemSeg =
    word?.morphology?.find((s) => s.root) ?? word?.morphology?.[word.morphology.length - 1];
  const primaryIrab =
    word?.irab?.find((n) => n.role_latin && !n.role_latin.includes("DET")) ?? word?.irab?.[0];

  const posBadge = stemSeg ? POS_ARABIC_MAP[stemSeg.pos] ?? stemSeg.pos : null;
  const roleBadge = primaryIrab?.role_latin || null;
  const statusBadge = primaryIrab?.irab_status
    ? STATUS_LABEL_MAP[primaryIrab.irab_status] ?? primaryIrab.irab_status
    : null;

  return (
    <aside className="word-panel" aria-live="polite">
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>
        Word &amp; I‘rab Explorer
      </h2>

      {loading && <p style={{ color: "#57534e", fontSize: "0.9rem" }}>Memuat detail kata...</p>}
      {error && <p style={{ color: "#b91c1c", fontSize: "0.9rem" }}>{error}</p>}

      {!loading && !error && !word && (
        <p style={{ color: "#57534e", fontSize: "0.9rem", margin: 0 }}>
          Klik kata mana saja pada halaman Mushaf untuk melihat terjemahan Indonesia, morfologi (Sharaf), kedudukan gramatikal (I‘rab / Nahwu), dan hubungan antar-kata.
        </p>
      )}

      {!loading && word && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Header Word + 3 Summary Badges */}
          <div style={{ borderBottom: "1px solid #f5f5f4", paddingBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="arabic-ui" style={{ fontSize: "2.35rem", lineHeight: 1.4, direction: "rtl" }}>
                {word.arabic_text}
              </span>
              <span style={{ fontSize: "0.82rem", color: "#57534e" }}>
                <span className="arabic-ui" style={{ fontSize: "1rem" }}>{word.surah_name}</span>{" "}
                {word.surah_id}:{word.ayah_number}:{word.word_number}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
              {roleBadge && (
                <span style={{ padding: "0.18rem 0.6rem", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: "0.78rem", fontWeight: 600 }}>
                  {roleBadge}
                </span>
              )}
              {posBadge && (
                <span style={{ padding: "0.18rem 0.6rem", borderRadius: 999, background: "#f5f5f4", color: "#44403c", fontSize: "0.78rem", fontWeight: 600 }}>
                  {posBadge}
                </span>
              )}
              {statusBadge && (
                <span style={{ padding: "0.18rem 0.6rem", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 600 }}>
                  {statusBadge}
                </span>
              )}
              <button
                type="button"
                onClick={() => onOpenAyahDiagram(word.surah_id, word.ayah_number, word.surah_name)}
                style={{
                  marginLeft: "auto",
                  padding: "0.2rem 0.6rem",
                  borderRadius: 999,
                  border: "1px solid #9a7b4f",
                  background: "#fffdf7",
                  color: "#7c5c32",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Diagram I‘rab Ayat ↗
              </button>
            </div>
          </div>

          {/* Terjemahan */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#57534e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Terjemahan
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, marginTop: "0.2rem" }}>
              {word.translation_id || "—"}
            </div>
          </div>

          {/* Morphology */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#57534e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
              Morphology
            </div>
            {stemSeg && (
              <ul style={{ margin: "0 0 0.5rem", paddingLeft: "1.15rem", fontSize: "0.9rem", lineHeight: 1.7 }}>
                {stemSeg.root && stemSeg.root_id && (
                  <li>
                    Root:{" "}
                    <button
                      type="button"
                      onClick={() => onSelectRoot(stemSeg.root_id!, stemSeg.root)}
                      style={{
                        background: "#fef3c7",
                        border: "1px solid #f59e0b",
                        borderRadius: 6,
                        padding: "0.05rem 0.45rem",
                        cursor: "pointer",
                        fontWeight: 600,
                        color: "#78350f",
                      }}
                    >
                      <span className="arabic-ui" style={{ fontSize: "1.1rem" }}>
                        {formatSpacedRoot(stemSeg.root)}
                      </span>{" "}
                      ↗
                    </button>
                  </li>
                )}
                {stemSeg.lemma && (
                  <li>
                    Lemma:{" "}
                    <span className="arabic-ui" style={{ fontSize: "1.15rem" }}>
                      {stemSeg.lemma}
                    </span>
                  </li>
                )}
                <li>POS: {POS_ENGLISH_MAP[stemSeg.pos] ?? stemSeg.pos}</li>
              </ul>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {(word.morphology ?? []).map((seg) => (
                <span
                  key={seg.segment_number}
                  style={{
                    fontSize: "0.78rem",
                    padding: "0.2rem 0.5rem",
                    background: "#fafaf9",
                    border: "1px solid #e7e5e4",
                    borderRadius: 6,
                  }}
                >
                  <span className="arabic-ui" style={{ fontSize: "1.05rem" }}>{seg.segment_arabic}</span> ({seg.pos})
                </span>
              ))}
            </div>
          </div>

          {/* I'rab */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#57534e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
              I‘rab
            </div>
            {(!word.irab || word.irab.length === 0) ? (
              <p style={{ fontSize: "0.84rem", color: "#78716c", margin: 0 }}>Belum tersedia untuk kata ini.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {word.irab.map((node) => (
                  <div
                    key={node.node_id}
                    style={{
                      padding: "0.55rem 0.7rem",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: "0.86rem",
                    }}
                  >
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.65 }}>
                      <li>
                        Kedudukan:{" "}
                        <span className="arabic-ui" style={{ fontSize: "1.15rem", fontWeight: 600 }}>
                          {node.role_arabic}
                        </span>{" "}
                        <span style={{ color: "#475569" }}>({node.role_latin})</span>
                      </li>
                      {node.irab_status && (
                        <li>
                          Status:{" "}
                          <span className="arabic-ui" style={{ fontSize: "1.1rem" }}>
                            {STATUS_ARABIC_MAP[node.irab_status] ?? node.irab_status}
                          </span>{" "}
                          <span style={{ color: "#475569" }}>({STATUS_LABEL_MAP[node.irab_status] ?? node.irab_status})</span>
                        </li>
                      )}
                      {node.irab_sign && (
                        <li>
                          Tanda:{" "}
                          <span className="arabic-ui" style={{ fontSize: "1.1rem" }}>
                            {node.irab_sign}
                          </span>
                        </li>
                      )}
                      {node.explanation && <li>Penjelasan: {node.explanation}</li>}
                    </ul>
                    <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.25rem" }}>
                      Sumber: {node.source}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hubungan Nahwu */}
          {word.relations && word.relations.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#57534e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
                Hubungan Nahwu
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {word.relations.map((rel) => (
                  <div
                    key={rel.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.65rem",
                      background: "#fafaf9",
                      border: "1px solid #e7e5e4",
                      borderRadius: 8,
                    }}
                  >
                    <span className="arabic-ui" style={{ fontSize: "1.35rem" }}>{rel.source_arabic}</span>
                    <span style={{ color: "#78716c", fontSize: "0.85rem" }}>↓</span>
                    <span style={{ padding: "0.15rem 0.65rem", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", fontSize: "0.78rem", fontWeight: 600 }}>
                      {rel.relation_type} — <span className="arabic-ui" style={{ fontSize: "0.95rem" }}>{rel.description}</span>
                    </span>
                    <span className="arabic-ui" style={{ fontSize: "1.35rem" }}>{rel.target_arabic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
