"use client";

import { useState } from "react";
import {
  deleteBookmark,
  searchArabic,
  searchRoots,
  type BookmarkItem,
  type SearchWordHit,
} from "@/lib/api";

interface Props {
  open: boolean;
  bookmarks: BookmarkItem[];
  onClose: () => void;
  onJumpToPage: (page: number) => void;
  onSelectRoot: (rootId: number, rootText: string) => void;
  onBookmarksChanged: () => void;
}

export default function SearchAndBookmarksModal({
  open,
  bookmarks,
  onClose,
  onJumpToPage,
  onSelectRoot,
  onBookmarksChanged,
}: Props) {
  const [tab, setTab] = useState<"search" | "bookmarks">("search");
  const [query, setQuery] = useState("");
  const [wordHits, setWordHits] = useState<SearchWordHit[]>([]);
  const [rootHits, setRootHits] = useState<{ id: number; arabic_text: string; occurrence_count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const [wRes, rRes] = await Promise.all([searchArabic(query.trim(), 15, 0), searchRoots(query.trim(), 10)]);
      setWordHits(wRes.data ?? []);
      setRootHits(rRes);
    } finally {
      setLoading(false);
    }
  }

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
        zIndex: 45,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 620,
          width: "100%",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setTab("search")}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: tab === "search" ? "#292524" : "#fff",
                color: tab === "search" ? "#fff" : "#292524",
                cursor: "pointer",
              }}
            >
              Pencarian Arab &amp; Akar
            </button>
            <button
              type="button"
              onClick={() => setTab("bookmarks")}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: tab === "bookmarks" ? "#292524" : "#fff",
                color: tab === "bookmarks" ? "#fff" : "#292524",
                cursor: "pointer",
              }}
            >
              Bookmarks ({bookmarks.length})
            </button>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "1.25rem", cursor: "pointer" }}>
            ×
          </button>
        </div>

        {tab === "search" ? (
          <>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem" }}>
              <input
                type="text"
                dir="rtl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kata atau akar Arab (mis. الحمد atau حمد)..."
                style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid #d6d3d1", fontSize: "1rem" }}
              />
              <button
                type="submit"
                style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "none", background: "#7c5c32", color: "#fff", cursor: "pointer", fontWeight: 600 }}
              >
                Cari
              </button>
            </form>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {loading && <p>Mencari...</p>}
              {!loading && rootHits.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#78716c", marginBottom: "0.35rem" }}>
                    Akar Kata Cocok
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {rootHits.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectRoot(r.id, r.arabic_text);
                        }}
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: 6,
                          border: "1px solid #f59e0b",
                          background: "#fef3c7",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {r.arabic_text} ({r.occurrence_count})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!loading && wordHits.map((h) => (
                <div
                  key={h.word_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #e7e5e4",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <span style={{ fontSize: "1.2rem", marginRight: "0.5rem" }}>{h.arabic_text}</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{h.translation_id}</span>
                    <div style={{ fontSize: "0.76rem", color: "#57534e" }}>
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
                      style={{ padding: "0.3rem 0.65rem", borderRadius: 6, border: "1px solid #9a7b4f", background: "#fffdf7", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      Hal. {h.page_number}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {bookmarks.length === 0 ? (
              <p style={{ color: "#57534e" }}>Belum ada bookmark tersimpan.</p>
            ) : (
              bookmarks.map((b) => (
                <div
                  key={b.id}
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
                    <strong>Halaman {b.page_number ?? "-"}</strong>
                    {b.note && <div style={{ fontSize: "0.82rem", color: "#57534e" }}>{b.note}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {b.page_number && (
                      <button
                        type="button"
                        onClick={() => {
                          onJumpToPage(b.page_number!);
                          onClose();
                        }}
                      >
                        Buka
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteBookmark(b.id);
                        onBookmarksChanged();
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
