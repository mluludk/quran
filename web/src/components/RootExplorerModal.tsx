"use client";

import { useEffect, useState } from "react";
import {
  fetchRootFamily,
  fetchRootOccurrences,
  type RootFamilyMember,
  type RootFamilyResponse,
  type SearchWordHit,
} from "@/lib/api";

interface Props {
  rootId: number | null;
  rootText: string;
  onClose: () => void;
  onJumpToPage: (page: number) => void;
}

const DIACRITIC_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;

function normalizeLetter(ch: string): string {
  if (ch === "أ" || ch === "إ" || ch === "آ" || ch === "ٱ") return "ا";
  if (ch === "ى") return "ي";
  return ch;
}

function HighlightedRootWord({ word, root }: { word: string; root: string }) {
  const rootLetters = root.split("").map(normalizeLetter);
  let rootIdx = 0;

  // Walk characters in order; color matching root radicals dark and extra letters crimson
  const chars = Array.from(word);
  return (
    <span className="arabic-ui" style={{ fontSize: "1.65rem", direction: "rtl" }}>
      {chars.map((ch, idx) => {
        if (DIACRITIC_RE.test(ch)) {
          return (
            <span key={idx} style={{ color: "inherit" }}>
              {ch}
            </span>
          );
        }
        const norm = normalizeLetter(ch);
        if (rootIdx < rootLetters.length && norm === rootLetters[rootIdx]) {
          rootIdx += 1;
          return (
            <span key={idx} style={{ color: "#1c1917", fontWeight: 700 }}>
              {ch}
            </span>
          );
        }
        return (
          <span key={idx} style={{ color: "#dc2626", fontWeight: 600 }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  "Fi'il": { bg: "#dcfce7", fg: "#166534" },
  Isim: { bg: "#dbeafe", fg: "#1d4ed8" },
  Masdar: { bg: "#fef3c7", fg: "#92400e" },
  Harf: { bg: "#f5f5f4", fg: "#44403c" },
};

export default function RootExplorerModal({ rootId, rootText, onClose, onJumpToPage }: Props) {
  const [tab, setTab] = useState<"family" | "occurrences">("family");
  const [catFilter, setCatFilter] = useState<string>("Semua");
  const [familyData, setFamilyData] = useState<RootFamilyResponse | null>(null);
  const [hits, setHits] = useState<SearchWordHit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rootId) return;
    setTab("family");
    setCatFilter("Semua");
    setOffset(0);
    setLoading(true);
    fetchRootFamily(rootId)
      .then((res) => {
        setFamilyData(res);
        setTotal(res.root.occurrence_count);
      })
      .finally(() => setLoading(false));
  }, [rootId]);

  useEffect(() => {
    if (!rootId || tab !== "occurrences") return;
    setLoading(true);
    fetchRootOccurrences(rootId, 20, offset)
      .then((res) => {
        setHits(res.data ?? []);
        setTotal(res.pagination.total);
      })
      .finally(() => setLoading(false));
  }, [rootId, tab, offset]);

  if (!rootId) return null;

  const spacedRoot = rootText.split("").join(" ");
  const familyList: RootFamilyMember[] = (familyData?.family ?? []).filter(
    (m) => catFilter === "Semua" || m.category === catFilter
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 720,
          width: "100%",
          maxHeight: "84vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>
              Root &amp; Word Family: <span className="arabic-ui" style={{ fontSize: "1.65rem" }}>{spacedRoot}</span>
            </h3>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "#57534e" }}>
              {familyData?.root.lemma_count ?? 0} bentuk turunan · {total} total kemunculan di Al-Qur&apos;an
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "1.35rem", cursor: "pointer" }}>
            ×
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              type="button"
              onClick={() => setTab("family")}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: tab === "family" ? "#292524" : "#fff",
                color: tab === "family" ? "#fff" : "#292524",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Keluarga Kata ({familyData?.root.lemma_count ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTab("occurrences")}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: tab === "occurrences" ? "#292524" : "#fff",
                color: tab === "occurrences" ? "#fff" : "#292524",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Semua Kemunculan ({total})
            </button>
          </div>

          {tab === "family" && (
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {["Semua", "Fi'il", "Isim", "Masdar"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCatFilter(cat)}
                  style={{
                    padding: "0.28rem 0.65rem",
                    borderRadius: 999,
                    border: "1px solid #e7e5e4",
                    background: catFilter === cat ? "#7c5c32" : "#fafaf9",
                    color: catFilter === cat ? "#fff" : "#44403c",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {loading ? (
            <p>Memuat data keluarga kata...</p>
          ) : tab === "family" ? (
            <>
              <div style={{ fontSize: "0.76rem", color: "#78716c", marginBottom: "0.2rem" }}>
                Huruf hitam = huruf akar (<strong>{spacedRoot}</strong>) ·{" "}
                <span style={{ color: "#dc2626", fontWeight: 600 }}>Huruf merah</span> = imbuhan / pola turunan (ziyadah)
              </div>
              {familyList.map((m, idx) => {
                const badge = CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.Harf;
                return (
                  <div
                    key={`${m.lemma_id}-${m.pos}-${idx}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.65rem 0.85rem",
                      border: "1px solid #e7e5e4",
                      borderRadius: 10,
                      background: "#fffdf9",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                        <HighlightedRootWord word={m.lemma || m.sample_arabic} root={rootText} />
                        <span style={{ padding: "0.15rem 0.55rem", borderRadius: 999, background: badge.bg, color: badge.fg, fontSize: "0.76rem", fontWeight: 600 }}>
                          {m.pattern_label}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#57534e" }}>
                          <strong>{m.occurrence_count}×</strong> kemunculan
                        </span>
                      </div>
                      <div style={{ fontSize: "0.86rem", color: "#292524" }}>
                        Contoh:{" "}
                        <span className="arabic-ui" style={{ fontSize: "1.1rem" }}>{m.sample_arabic}</span>{" "}
                        {m.sample_translation && <span>— “{m.sample_translation}”</span>}{" "}
                        <span style={{ color: "#78716c", fontSize: "0.78rem" }}>
                          ({m.sample_surah_name} {m.sample_surah_id}:{m.sample_ayah_number})
                        </span>
                      </div>
                    </div>

                    {m.sample_page && (
                      <button
                        type="button"
                        onClick={() => {
                          onJumpToPage(m.sample_page!);
                          onClose();
                        }}
                        style={{
                          padding: "0.38rem 0.75rem",
                          borderRadius: 6,
                          border: "1px solid #9a7b4f",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Hal. {m.sample_page}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            hits.map((h) => (
              <div
                key={h.word_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.55rem 0.75rem",
                  border: "1px solid #e7e5e4",
                  borderRadius: 8,
                }}
              >
                <div>
                  <span className="arabic-ui" style={{ fontSize: "1.45rem", marginRight: "0.65rem" }}>{h.arabic_text}</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{h.translation_id}</span>
                  <div style={{ fontSize: "0.78rem", color: "#57534e" }}>
                    {h.surah_name} ({h.surah_id}:{h.ayah_number}) · Hal. {h.page_number ?? "?"}
                  </div>
                </div>
                {h.page_number && (
                  <button
                    type="button"
                    onClick={() => {
                      onJumpToPage(h.page_number!);
                      onClose();
                    }}
                    style={{
                      padding: "0.35rem 0.7rem",
                      borderRadius: 6,
                      border: "1px solid #9a7b4f",
                      background: "#fffdf7",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                    }}
                  >
                    Buka Hal. {h.page_number}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {tab === "occurrences" && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.85rem", fontSize: "0.85rem" }}>
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - 20))}
            >
              ← Sebelumnya
            </button>
            <span>
              {offset + 1}–{Math.min(offset + 20, total)} dari {total}
            </span>
            <button
              type="button"
              disabled={offset + 20 >= total}
              onClick={() => setOffset((o) => o + 20)}
            >
              Berikutnya →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
