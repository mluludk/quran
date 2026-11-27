"use client";

import { useState } from "react";

export interface MorphSegment {
  segment: number;
  arabic: string;
  pos: string;
  root: string | null;
  lemma: string | null;
  tags: string;
}

export interface LineItem {
  item_type: "surah_header" | "basmala" | "word" | "ayah_end";
  surah_number?: number;
  word_id?: number;
  location?: string;
  surah?: number;
  ayah?: number;
  word?: number;
  text?: string;
  glyph_codes: number[];
  translation_id?: string | null;
  morphology?: MorphSegment[];
}

export interface MushafLine {
  line_number: number;
  line_type: string;
  is_centered: boolean;
  items: LineItem[];
}

export interface MushafPage {
  page_number: number;
  font_family: string;
  lines: MushafLine[];
}

function codesToString(codes: number[]): string {
  return codes.map((c) => String.fromCodePoint(c)).join("");
}

export default function MushafProofClient({ pages }: { pages: MushafPage[] }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [selectedWord, setSelectedWord] = useState<LineItem | null>(null);

  const page = pages[pageIdx];

  return (
    <div>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "1rem 1.5rem 0",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>M0 Renderer &amp; Hit-Test Proof (QPC V4)</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#57534e", fontSize: "0.9rem" }}>
            Page {page.page_number} · {page.lines.length} lines · Font <code>{page.font_family}</code> · Fixed RTL layout (no reflow)
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {pages.map((p, idx) => (
            <button
              key={p.page_number}
              type="button"
              onClick={() => {
                setPageIdx(idx);
                setSelectedWord(null);
              }}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: idx === pageIdx ? "#292524" : "#fff",
                color: idx === pageIdx ? "#fff" : "#292524",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Page {p.page_number}
            </button>
          ))}
        </div>
      </header>

      <div className="mushaf-shell">
        <section className="mushaf-page-frame" aria-label={`Mushaf page ${page.page_number}`}>
          <div className="mushaf-lines">
            {page.lines.map((line) => {
              if (line.line_type === "surah_name") {
                const item = line.items[0];
                return (
                  <p key={line.line_number} className="mushaf-line mushaf-surah-header">
                    {item ? codesToString(item.glyph_codes) : ""}
                  </p>
                );
              }
              if (line.line_type === "basmallah") {
                const item = line.items[0];
                return (
                  <p key={line.line_number} className="mushaf-line mushaf-basmala">
                    {item ? codesToString(item.glyph_codes) : ""}
                  </p>
                );
              }
              return (
                <p
                  key={line.line_number}
                  className={`mushaf-line ${line.is_centered ? "is-centered" : ""}`}
                >
                  {line.items.map((item) => {
                    const glyphText =
                      item.glyph_codes.length > 0 ? codesToString(item.glyph_codes) : item.text ?? "";
                    const style =
                      item.glyph_codes.length > 0 ? { fontFamily: `'${page.font_family}', serif` } : undefined;

                    if (item.item_type === "ayah_end") {
                      return (
                        <span key={item.word_id} className="mushaf-ayah-end" style={style}>
                          {glyphText}
                        </span>
                      );
                    }

                    const isSelected = selectedWord?.word_id === item.word_id;
                    return (
                      <button
                        key={item.word_id}
                        type="button"
                        className={`mushaf-word ${isSelected ? "is-selected" : ""}`}
                        style={style}
                        onClick={() => setSelectedWord(item)}
                        title={item.location}
                      >
                        {glyphText}
                      </button>
                    );
                  })}
                </p>
              );
            })}
          </div>
        </section>

        <aside className="word-panel" aria-live="polite">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Word Explorer (M0)</h2>
          {!selectedWord ? (
            <p style={{ color: "#57534e", fontSize: "0.9rem", margin: 0 }}>
              Klik kata mana saja pada halaman Mushaf di sebelah kiri untuk menguji <em>hit-testing</em>, terjemahan Indonesia, dan segmen morfologi.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "2rem", direction: "rtl" }}>{selectedWord.text}</span>
                <span style={{ fontSize: "0.85rem", color: "#57534e" }}>
                  <code>{selectedWord.location}</code> · id #{selectedWord.word_id}
                </span>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#78716c" }}>
                  Terjemahan (ID)
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {selectedWord.translation_id ?? "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#78716c", marginBottom: "0.35rem" }}>
                  Morphology ({selectedWord.morphology?.length ?? 0} segmen)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(selectedWord.morphology ?? []).map((seg) => (
                    <div
                      key={seg.segment}
                      style={{
                        padding: "0.5rem 0.65rem",
                        background: "#fafaf9",
                        border: "1px solid #e7e5e4",
                        borderRadius: 8,
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                        <span style={{ fontSize: "1.1rem" }}>{seg.arabic}</span>
                        <span>POS: {seg.pos}</span>
                      </div>
                      <div style={{ color: "#57534e", marginTop: "0.2rem" }}>
                        {seg.root && <span>Root: {seg.root} · </span>}
                        {seg.lemma && <span>Lemma: {seg.lemma}</span>}
                      </div>
                      <div style={{ color: "#78716c", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                        <code>{seg.tags}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
