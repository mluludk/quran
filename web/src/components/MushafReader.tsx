"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createBookmark,
  createVocabItem,
  fetchJuzList,
  fetchPage,
  fetchSurahs,
  fetchWordDetail,
  getReadingProgress,
  listBookmarks,
  putReadingProgress,
  type BookmarkItem,
  type JuzSummary,
  type MushafPageResponse,
  type SurahSummary,
  type WordDetailResponse,
} from "@/lib/api";
import WordExplorerPanel from "./WordExplorerPanel";
import RootExplorerModal from "./RootExplorerModal";
import SearchAndBookmarksModal from "./SearchAndBookmarksModal";
import AyahIrabDiagramModal from "./AyahIrabDiagramModal";
import VocabNotebookModal from "./VocabNotebookModal";

function codesToString(codes: number[] | null): string {
  if (!codes || codes.length === 0) return "";
  return codes.map((c) => String.fromCodePoint(c)).join("");
}

const GRAMMAR_FILTERS = [
  { key: "mubtada", label: "Mubtada'", bg: "#dcfce7", border: "#16a34a", fg: "#166534" },
  { key: "khabar", label: "Khabar", bg: "#dbeafe", border: "#2563eb", fg: "#1e40af" },
  { key: "fail", label: "Fa'il", bg: "#fef3c7", border: "#d97706", fg: "#92400e" },
  { key: "maful", label: "Maf'ul Bih", bg: "#fce7f3", border: "#db2777", fg: "#9d174d" },
  { key: "harf_jar", label: "Huruf Jar", bg: "#fee2e2", border: "#dc2626", fg: "#991b1b" },
  { key: "ism_majrur", label: "Ism Majrur", bg: "#ede9fe", border: "#7c3aed", fg: "#5b21b6" },
  { key: "amil", label: "Amil (Fi'il/Nasikh)", bg: "#ffedd5", border: "#ea580c", fg: "#9a3412" },
] as const;

export default function MushafReader({
  initialPage = 1,
  mode = "mushaf",
}: {
  initialPage?: number;
  mode?: "mushaf" | "tarjim";
}) {
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [pageData, setPageData] = useState<MushafPageResponse | null>(null);
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [juzList, setJuzList] = useState<JuzSummary[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  const [wordDetail, setWordDetail] = useState<WordDetailResponse | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);

  const [rootModal, setRootModal] = useState<{ id: number; text: string } | null>(null);
  const [diagramModal, setDiagramModal] = useState<{ surah: number; ayah: number; surahName: string } | null>(null);
  const [vocabOpen, setVocabOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hideSeenTranslations, setHideSeenTranslations] = useState(true);
  const [grammarMode, setGrammarMode] = useState(false);
  const [activeGrammarKeys, setActiveGrammarKeys] = useState<string[]>(
    GRAMMAR_FILTERS.map((g) => g.key)
  );
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  const refreshBookmarks = useCallback(() => {
    listBookmarks().then(setBookmarks).catch(() => {});
  }, []);

  useEffect(() => {
    fetchSurahs().then(setSurahs).catch(() => {});
    fetchJuzList().then(setJuzList).catch(() => {});
    refreshBookmarks();
  }, [refreshBookmarks]);

  useEffect(() => {
    // Inject per-page QPC V4 @font-face dynamically
    const fontName = `p${pageNumber}`;
    const styleId = `font-${fontName}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `@font-face{font-family:'${fontName}';src:url('/fonts/qpcv4/${fontName}.woff2') format('woff2');font-display:swap}`;
      document.head.appendChild(style);
    }

    setPageLoading(true);
    setPageError(null);
    setPageInput(String(pageNumber));
    setSelectedWordId(null);
    setWordDetail(null);

    fetchPage(pageNumber)
      .then((data) => {
        setPageData(data);
        putReadingProgress(pageNumber).catch(() => {});
      })
      .catch((err) => setPageError(err instanceof Error ? err.message : "Gagal memuat halaman"))
      .finally(() => setPageLoading(false));
  }, [pageNumber]);

  async function handleSelectWord(wordId: number) {
    setSelectedWordId(wordId);
    setWordLoading(true);
    setWordError(null);
    try {
      const detail = await fetchWordDetail(wordId);
      setWordDetail(detail);
    } catch (err) {
      setWordError(err instanceof Error ? err.message : "Gagal memuat detail kata");
    } finally {
      setWordLoading(false);
    }
  }

  async function handleBookmarkPage() {
    await createBookmark(pageNumber, `Halaman ${pageNumber}`);
    refreshBookmarks();
  }

  async function handleResumeProgress() {
    const prog = await getReadingProgress();
    if (prog?.page_number) {
      setPageNumber(prog.page_number);
    }
  }

  const fontName = `p${pageNumber}`;

  return (
    <div>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 1140,
          margin: "0 auto",
          padding: "1rem 1.5rem 0",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>
            {mode === "tarjim" ? "Tarjim — Mushaf Terjemah Per Kata" : "Digital Mushaf Madinah (604 Halaman)"}
          </h1>
          {pageData && (
            <p style={{ margin: "0.2rem 0 0", color: "#57534e", fontSize: "0.85rem" }}>
              Hal. {pageData.page_number} / 604
              {pageData.juz_number ? ` · Juz ${pageData.juz_number}` : ""}
              {pageData.hizb_number ? ` · Hizb ${pageData.hizb_number}` : ""}
              {pageData.surahs_on_page?.length
                ? ` · ${pageData.surahs_on_page.map((s) => s.name_arabic).join(" / ")}`
                : ""}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
          <a
            href={mode === "tarjim" ? "/mushaf" : "/tarjim"}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #d6cfc2",
              background: "#fafaf9",
              color: "#292524",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {mode === "tarjim" ? "Mode Mushaf" : "Mode Tarjim"}
          </a>
          {mode === "tarjim" && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.82rem",
                color: "#44403c",
                cursor: "pointer",
                padding: "0.35rem 0.6rem",
                borderRadius: 8,
                border: "1px solid #e7e5e4",
                background: "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={hideSeenTranslations}
                onChange={(e) => setHideSeenTranslations(e.target.checked)}
              />
              Hanya kata baru (sejak Al-Fatihah)
            </label>
          )}
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            style={{ padding: "0.4rem 0.7rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", cursor: "pointer" }}
          >
            ← Prev
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(pageInput);
              if (n >= 1 && n <= 604) setPageNumber(n);
            }}
            style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}
          >
            <input
              type="number"
              min={1}
              max={604}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              style={{ width: 64, padding: "0.38rem 0.5rem", borderRadius: 8, border: "1px solid #d6cfc2", textAlign: "center" }}
            />
            <button type="submit" style={{ padding: "0.4rem 0.65rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", cursor: "pointer" }}>
              Go
            </button>
          </form>

          <button
            type="button"
            disabled={pageNumber >= 604}
            onClick={() => setPageNumber((p) => Math.min(604, p + 1))}
            style={{ padding: "0.4rem 0.7rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", cursor: "pointer" }}
          >
            Next →
          </button>

          {surahs.length > 0 && (
            <select
              aria-label="Pilih Surah"
              value={pageData?.surahs_on_page?.[0]?.id ?? ""}
              onChange={(e) => {
                const sid = Number(e.target.value);
                const s = surahs.find((item) => item.id === sid);
                if (s?.first_page) setPageNumber(s.first_page);
              }}
              style={{ padding: "0.4rem 0.55rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", fontSize: "0.84rem", maxWidth: 170 }}
            >
              {surahs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.name_transliteration}
                </option>
              ))}
            </select>
          )}

          {juzList.length > 0 && (
            <select
              aria-label="Pilih Juz"
              value={pageData?.juz_number ?? ""}
              onChange={(e) => {
                const jid = Number(e.target.value);
                const j = juzList.find((item) => item.juz_number === jid);
                if (j?.first_page) setPageNumber(j.first_page);
              }}
              style={{ padding: "0.4rem 0.55rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", fontSize: "0.84rem" }}
            >
              {juzList.map((j) => (
                <option key={j.juz_number} value={j.juz_number}>
                  Juz {j.juz_number} (Hal. {j.first_page})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleBookmarkPage}
            style={{ padding: "0.4rem 0.75rem", borderRadius: 8, border: "1px solid #9a7b4f", background: "#fffdf7", cursor: "pointer" }}
          >
            ★ Bookmark
          </button>

          <button
            type="button"
            onClick={handleResumeProgress}
            style={{ padding: "0.4rem 0.75rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", cursor: "pointer" }}
          >
            Terakhir Baca
          </button>

          <button
            type="button"
            onClick={() => setGrammarMode((g) => !g)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 8,
              border: grammarMode ? "1.5px solid #2563eb" : "1px solid #d6cfc2",
              background: grammarMode ? "#eff6ff" : "#fff",
              color: grammarMode ? "#1d4ed8" : "#292524",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {grammarMode ? "Nahwu Mode: ON" : "Mode Belajar Nahwu"}
          </button>

          <button
            type="button"
            onClick={() => setVocabOpen(true)}
            style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #9a7b4f", background: "#fffdf7", color: "#7c5c32", cursor: "pointer", fontWeight: 600 }}
          >
            Notebook
          </button>

          <a
            href="/learn"
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 8,
              border: "1px solid #166534",
              background: "#f0fdf4",
              color: "#166534",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Belajar
          </a>

          <a
            href="/frequency"
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 8,
              border: "1px solid #d6cfc2",
              background: "#fff",
              color: "#292524",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Frekuensi
          </a>

          <a
            href="/context"
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 8,
              border: "1px solid #d6cfc2",
              background: "#fff",
              color: "#292524",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Konteks
          </a>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            style={{ padding: "0.4rem 0.85rem", borderRadius: 8, border: "none", background: "#292524", color: "#fff", cursor: "pointer", fontWeight: 600 }}
          >
            Cari / Bookmarks
          </button>
        </div>
      </header>

      <div className="mushaf-shell">
        <section className="mushaf-page-frame" aria-label={`Mushaf page ${pageNumber}`}>
          {grammarMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "0.9rem", paddingBottom: "0.65rem", borderBottom: "1px solid #ede9e0" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.74rem", color: "#78716c", fontWeight: 600 }}>Preset cepat:</span>
                {[
                  { label: "Semua", keys: GRAMMAR_FILTERS.map((g) => g.key) },
                  { label: "Kosongkan", keys: [] },
                  { label: "Mubtada' + Khabar", keys: ["mubtada", "khabar"] },
                  { label: "Huruf Jar + Ism Majrur", keys: ["harf_jar", "ism_majrur"] },
                  { label: "Fi'il + Fa'il + Maf'ul", keys: ["amil", "fail", "maful"] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setActiveGrammarKeys([...preset.keys])}
                    style={{
                      padding: "0.16rem 0.5rem",
                      borderRadius: 6,
                      border: "1px solid #d6cfc2",
                      background: "#fff",
                      color: "#44403c",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {GRAMMAR_FILTERS.map((gf) => {
                  const active = activeGrammarKeys.includes(gf.key);
                  return (
                    <button
                      key={gf.key}
                      type="button"
                      onClick={() =>
                        setActiveGrammarKeys((prev) =>
                          prev.includes(gf.key) ? prev.filter((k) => k !== gf.key) : [...prev, gf.key]
                        )
                      }
                      style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: 999,
                        border: `1.5px solid ${active ? gf.border : "#d6d3d1"}`,
                        background: active ? gf.bg : "#fafaf9",
                        color: active ? gf.fg : "#78716c",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {active ? "✓ " : ""}{gf.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {pageLoading && <p style={{ textAlign: "center", color: "#57534e" }}>Memuat halaman {pageNumber}...</p>}
          {pageError && (
            <p style={{ textAlign: "center", color: "#b91c1c" }}>
              {pageError} — pastikan Go/Fiber API berjalan di <code>localhost:8080</code>.
            </p>
          )}

          {!pageLoading && !pageError && pageData && (
            <div
              className="mushaf-lines"
              style={mode === "tarjim" ? { width: "100%", maxWidth: 740, gap: "0.9rem" } : undefined}
            >
              {pageData.lines.map((line) => {
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
                    style={
                      mode === "tarjim"
                        ? {
                            flexWrap: "wrap",
                            whiteSpace: "normal",
                            justifyContent: line.is_centered ? "center" : "flex-start",
                            gap: "0.75rem 1.05rem",
                            lineHeight: 1.5,
                            paddingBottom: "0.35rem",
                            borderBottom: "1px dashed #ede9e0",
                          }
                        : undefined
                    }
                  >
                    {line.items.map((item) => {
                      const glyphText =
                        item.glyph_codes && item.glyph_codes.length > 0
                          ? codesToString(item.glyph_codes)
                          : item.display_text;
                      const style =
                        item.glyph_codes && item.glyph_codes.length > 0
                          ? { fontFamily: `'${fontName}', serif` }
                          : undefined;

                      if (item.item_type === "ayah_end" || !item.word_id) {
                        return (
                          <span key={`${line.line_number}-${item.position}`} className="mushaf-ayah-end" style={style}>
                            {glyphText}
                          </span>
                        );
                      }

                      const isSelected = selectedWordId === item.word_id;
                      const matchedFilter = grammarMode
                        ? GRAMMAR_FILTERS.find(
                            (gf) =>
                              activeGrammarKeys.includes(gf.key) &&
                              (item.grammar_roles ?? []).includes(gf.key)
                          )
                        : undefined;
                      const grammarStyle = matchedFilter
                        ? {
                            backgroundColor: matchedFilter.bg,
                            borderBottom: `2.5px solid ${matchedFilter.border}`,
                          }
                        : undefined;

                      if (mode === "tarjim") {
                        const showTr = !hideSeenTranslations || item.is_first_occurrence !== false;
                        return (
                          <button
                            key={item.word_id}
                            type="button"
                            className={`mushaf-word ${isSelected ? "is-selected" : ""}`}
                            onClick={() => handleSelectWord(item.word_id!)}
                            title={item.display_text}
                            style={{
                              display: "inline-flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "0.2rem",
                              padding: "0.25rem 0.4rem",
                              ...grammarStyle,
                            }}
                          >
                            <span style={{ ...style, fontSize: "1.65rem", lineHeight: 1.4 }}>
                              {glyphText}
                            </span>
                            <span
                              style={{
                                fontFamily: "system-ui, sans-serif",
                                fontSize: "0.76rem",
                                fontWeight: 500,
                                color: showTr ? "#1e3a5f" : "#94a3b8",
                                lineHeight: 1.25,
                                direction: "ltr",
                                textAlign: "center",
                                maxWidth: 130,
                              }}
                            >
                              {showTr
                                ? item.translation_id || "—"
                                : item.first_occurrence_page
                                  ? `(hal ${item.first_occurrence_page})`
                                  : "·"}
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={item.word_id}
                          type="button"
                          className={`mushaf-word ${isSelected ? "is-selected" : ""}`}
                          style={{ ...style, ...grammarStyle }}
                          onClick={() => handleSelectWord(item.word_id!)}
                          title={item.display_text}
                        >
                          {glyphText}
                        </button>
                      );
                    })}
                  </p>
                );
              })}
            </div>
          )}
        </section>

        <WordExplorerPanel
          loading={wordLoading}
          error={wordError}
          word={wordDetail}
          onSelectRoot={(id, text) => setRootModal({ id, text })}
          onOpenAyahDiagram={(surah, ayah, surahName) => setDiagramModal({ surah, ayah, surahName })}
          onSaveToVocab={async (itemType, w) => {
            await createVocabItem({
              item_type: itemType,
              word_id: itemType === "word" ? w.word_id : null,
              ayah_id: w.ayah_id,
            });
            setVocabOpen(true);
          }}
        />
      </div>

      {surahs.length > 0 && (
        <div style={{ maxWidth: 1140, margin: "0 auto 2rem", padding: "0 1.5rem", fontSize: "0.82rem", color: "#78716c" }}>
          Daftar 114 Surah termuat ({surahs[0]?.name_transliteration} – {surahs[surahs.length - 1]?.name_transliteration}).
        </div>
      )}

      <AyahIrabDiagramModal
        target={diagramModal}
        onClose={() => setDiagramModal(null)}
      />

      <VocabNotebookModal
        open={vocabOpen}
        onClose={() => setVocabOpen(false)}
        onJumpToPage={(p) => setPageNumber(p)}
      />

      <RootExplorerModal
        rootId={rootModal?.id ?? null}
        rootText={rootModal?.text ?? ""}
        onClose={() => setRootModal(null)}
        onJumpToPage={(p) => setPageNumber(p)}
      />

      <SearchAndBookmarksModal
        open={searchOpen}
        bookmarks={bookmarks}
        onClose={() => setSearchOpen(false)}
        onJumpToPage={(p) => setPageNumber(p)}
        onSelectRoot={(id, text) => setRootModal({ id, text })}
        onBookmarksChanged={refreshBookmarks}
      />
    </div>
  );
}
