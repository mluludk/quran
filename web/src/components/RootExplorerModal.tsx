"use client";

import { useEffect, useState } from "react";
import { fetchRootOccurrences, type SearchWordHit } from "@/lib/api";

interface Props {
  rootId: number | null;
  rootText: string;
  onClose: () => void;
  onJumpToPage: (page: number) => void;
}

export default function RootExplorerModal({ rootId, rootText, onClose, onJumpToPage }: Props) {
  const [hits, setHits] = useState<SearchWordHit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rootId) return;
    setLoading(true);
    fetchRootOccurrences(rootId, 20, offset)
      .then((res) => {
        setHits(res.data ?? []);
        setTotal(res.pagination.total);
      })
      .finally(() => setLoading(false));
  }, [rootId, offset]);

  if (!rootId) return null;

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
          maxWidth: 640,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>
            Root Explorer: <span style={{ fontSize: "1.35rem" }}>{rootText}</span> ({total} kata)
          </h3>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "1.25rem", cursor: "pointer" }}>
            ×
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {loading ? (
            <p>Memuat kemunculan akar kata...</p>
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
                  <span style={{ fontSize: "1.25rem", marginRight: "0.65rem" }}>{h.arabic_text}</span>
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
      </div>
    </div>
  );
}
