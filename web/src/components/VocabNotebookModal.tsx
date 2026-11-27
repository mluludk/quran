"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createVocabCollection,
  deleteVocabItem,
  getVocabProgress,
  listVocabCollections,
  listVocabItems,
  updateVocabItem,
  type VocabCollection,
  type VocabItem,
  type VocabProgress,
} from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onJumpToPage: (page: number) => void;
}

const MASTERY_LABELS: Record<number, { label: string; bg: string; fg: string }> = {
  0: { label: "Baru", bg: "#f5f5f4", fg: "#44403c" },
  1: { label: "Belajar", bg: "#fef3c7", fg: "#92400e" },
  2: { label: "Dikuasai", bg: "#dcfce7", fg: "#166534" },
};

export default function VocabNotebookModal({ open, onClose, onJumpToPage }: Props) {
  const [tab, setTab] = useState<"list" | "flashcard">("list");
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [selectedCol, setSelectedCol] = useState<number>(0);
  const [newTheme, setNewTheme] = useState("");
  const [items, setItems] = useState<VocabItem[]>([]);
  const [progress, setProgress] = useState<VocabProgress | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const loadAll = useCallback(async (colId: number) => {
    setLoading(true);
    try {
      const [cols, its, prog] = await Promise.all([
        listVocabCollections(),
        listVocabItems(colId),
        getVocabProgress(),
      ]);
      setCollections(cols);
      setItems(its);
      setProgress(prog);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setCardIdx(0);
      setFlipped(false);
      loadAll(selectedCol);
    }
  }, [open, selectedCol, loadAll]);

  if (!open) return null;

  async function handleAddTheme(e: React.FormEvent) {
    e.preventDefault();
    if (!newTheme.trim()) return;
    await createVocabCollection(newTheme.trim());
    setNewTheme("");
    loadAll(selectedCol);
  }

  async function handleSaveNote(id: number) {
    await updateVocabItem(id, { note: noteDraft });
    setEditingNoteId(null);
    loadAll(selectedCol);
  }

  async function handleFlashcardReview(item: VocabItem, level: number) {
    await updateVocabItem(item.id, { mastery_level: level, reviewed: true });
    setFlipped(false);
    setCardIdx((idx) => (items.length > 1 ? (idx + 1) % items.length : 0));
    loadAll(selectedCol);
  }

  const currentCard = items[cardIdx % Math.max(1, items.length)];
  const masteredPct =
    progress && progress.total_items > 0
      ? Math.round((progress.mastered_count * 100) / progress.total_items)
      : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 55,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          maxWidth: 760,
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
            <h3 style={{ margin: 0 }}>Quran Vocabulary Notebook</h3>
            {progress && (
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "#57534e" }}>
                {progress.total_items} tersimpan · {progress.mastered_count} dikuasai ({masteredPct}%) ·{" "}
                {progress.learning_count} belajar · {progress.total_reviews}× review
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "1.35rem", cursor: "pointer" }}>
            ×
          </button>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div style={{ height: 8, background: "#f5f5f4", borderRadius: 999, overflow: "hidden", marginBottom: "0.85rem" }}>
            <div style={{ width: `${masteredPct}%`, height: "100%", background: "#16a34a", transition: "width 200ms ease" }} />
          </div>
        )}

        {/* Tabs & Theme Filter */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              type="button"
              onClick={() => setTab("list")}
              style={{
                padding: "0.38rem 0.8rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: tab === "list" ? "#292524" : "#fff",
                color: tab === "list" ? "#fff" : "#292524",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Catatan &amp; Koleksi ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("flashcard");
                setFlipped(false);
                setCardIdx(0);
              }}
              style={{
                padding: "0.38rem 0.8rem",
                borderRadius: 8,
                border: "1px solid #d6cfc2",
                background: tab === "flashcard" ? "#7c5c32" : "#fff",
                color: tab === "flashcard" ? "#fff" : "#292524",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Mode Flashcard
            </button>
          </div>

          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(Number(e.target.value))}
            style={{ padding: "0.35rem 0.65rem", borderRadius: 8, border: "1px solid #d6d3d1", fontSize: "0.85rem" }}
          >
            <option value={0}>Semua Tema</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.item_count})
              </option>
            ))}
          </select>
        </div>

        {/* Tab Content */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <p>Memuat vocabulary notebook...</p>
          ) : tab === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <form onSubmit={handleAddTheme} style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  type="text"
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  placeholder="Tambah tema baru (mis. Doa, Fi'il Sehari-hari)..."
                  style={{ flex: 1, padding: "0.4rem 0.65rem", borderRadius: 8, border: "1px solid #d6d3d1", fontSize: "0.86rem" }}
                />
                <button
                  type="submit"
                  style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #9a7b4f", background: "#fffdf7", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
                >
                  + Tema
                </button>
              </form>

              {items.length === 0 ? (
                <p style={{ color: "#57534e", fontSize: "0.9rem" }}>
                  Belum ada kata atau ayat tersimpan. Klik kata di Mushaf lalu tekan <strong>+ Simpan Kata</strong> atau <strong>+ Simpan Ayat</strong>.
                </p>
              ) : (
                items.map((it) => {
                  const m = MASTERY_LABELS[it.mastery_level] ?? MASTERY_LABELS[0];
                  return (
                    <div
                      key={it.id}
                      style={{
                        padding: "0.7rem 0.85rem",
                        border: "1px solid #e7e5e4",
                        borderRadius: 10,
                        background: "#fffdf9",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", padding: "0.1rem 0.45rem", borderRadius: 6, background: "#e7e5e4" }}>
                            {it.item_type === "ayah" ? "Ayat" : "Kata"}
                          </span>
                          <span style={{ fontSize: "0.74rem", padding: "0.1rem 0.5rem", borderRadius: 999, background: m.bg, color: m.fg, fontWeight: 600 }}>
                            {m.label}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "#57534e" }}>
                            <span className="arabic-ui">{it.surah_name}</span> {it.surah_id}:{it.ayah_number}
                            {it.collection_name ? ` · ${it.collection_name}` : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          {it.page_number && (
                            <button
                              type="button"
                              onClick={() => {
                                onJumpToPage(it.page_number!);
                                onClose();
                              }}
                              style={{ fontSize: "0.78rem", padding: "0.2rem 0.5rem", borderRadius: 6, border: "1px solid #9a7b4f", background: "#fff", cursor: "pointer" }}
                            >
                              Hal. {it.page_number}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteVocabItem(it.id);
                              loadAll(selectedCol);
                            }}
                            style={{ fontSize: "0.78rem", padding: "0.2rem 0.5rem", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem" }}>
                        <span className="arabic-ui" style={{ fontSize: it.item_type === "ayah" ? "1.35rem" : "1.65rem", direction: "rtl" }}>
                          {it.arabic_text}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                          {it.translation_id || (it.root ? `Root: ${it.root}` : "")}
                        </span>
                      </div>

                      {editingNoteId === it.id ? (
                        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
                          <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Tulis catatan pribadi..."
                            style={{ flex: 1, padding: "0.35rem 0.55rem", borderRadius: 6, border: "1px solid #d6d3d1", fontSize: "0.84rem" }}
                          />
                          <button type="button" onClick={() => handleSaveNote(it.id)}>Simpan</button>
                          <button type="button" onClick={() => setEditingNoteId(null)}>Batal</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "#57534e" }}>
                          <span>Catatan: {it.note || <em>(kosong)</em>}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(it.id);
                              setNoteDraft(it.note);
                            }}
                            style={{ border: "none", background: "transparent", color: "#7c5c32", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                          >
                            Edit catatan
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : !currentCard ? (
            <p style={{ color: "#57534e" }}>Simpan minimal 1 kata atau ayat untuk mulai berlatih Flashcard.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "1rem 0" }}>
              <div style={{ fontSize: "0.82rem", color: "#78716c" }}>
                Kartu {(cardIdx % items.length) + 1} dari {items.length} ·{" "}
                <span className="arabic-ui">{currentCard.surah_name}</span> ({currentCard.surah_id}:{currentCard.ayah_number})
              </div>

              <div
                onClick={() => setFlipped((f) => !f)}
                style={{
                  width: "100%",
                  maxWidth: 500,
                  minHeight: 200,
                  padding: "1.5rem",
                  borderRadius: 14,
                  border: "2px solid #d6cfc2",
                  background: flipped ? "#f8fafc" : "#fffdf7",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  gap: "0.75rem",
                }}
              >
                <span className="arabic-ui" style={{ fontSize: currentCard.item_type === "ayah" ? "1.65rem" : "2.5rem", direction: "rtl" }}>
                  {currentCard.arabic_text}
                </span>

                {!flipped ? (
                  <span style={{ fontSize: "0.84rem", color: "#78716c" }}>
                    Klik kartu untuk melihat arti &amp; catatan
                  </span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1c1917" }}>
                      {currentCard.translation_id || "—"}
                    </div>
                    {currentCard.root && (
                      <div style={{ fontSize: "0.88rem", color: "#57534e" }}>
                        Root: <span className="arabic-ui" style={{ fontSize: "1.1rem" }}>{currentCard.root.split("").join(" ")}</span>
                      </div>
                    )}
                    {currentCard.note && (
                      <div style={{ fontSize: "0.86rem", color: "#475569", fontStyle: "italic" }}>
                        “{currentCard.note}”
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!flipped ? (
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "none", background: "#292524", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Tampilkan Jawaban
                </button>
              ) : (
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => handleFlashcardReview(currentCard, 0)}
                    style={{ padding: "0.45rem 0.9rem", borderRadius: 8, border: "1px solid #d6d3d1", background: "#f5f5f4", cursor: "pointer", fontWeight: 600 }}
                  >
                    Ulangi (Baru)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFlashcardReview(currentCard, 1)}
                    style={{ padding: "0.45rem 0.9rem", borderRadius: 8, border: "1px solid #f59e0b", background: "#fef3c7", color: "#92400e", cursor: "pointer", fontWeight: 600 }}
                  >
                    Masih Belajar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFlashcardReview(currentCard, 2)}
                    style={{ padding: "0.45rem 0.9rem", borderRadius: 8, border: "1px solid #16a34a", background: "#dcfce7", color: "#166534", cursor: "pointer", fontWeight: 600 }}
                  >
                    Sudah Hafal ✓
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
