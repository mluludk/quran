"use client";

import { useEffect, useState } from "react";
import {
  createKnowledgeNote,
  deleteKnowledgeNote,
  fetchAyahKnowledge,
  fetchKnowledgeConcept,
  fetchKnowledgeNotes,
  fetchKnowledgeOverview,
  fetchKnowledgeTheme,
  type AyahKnowledgeResponse,
  type KnowledgeConceptDetailResponse,
  type KnowledgeNote,
  type KnowledgeOverviewResponse,
} from "@/lib/api";

const NODE_POS: Record<string, { x: number; y: number }> = {
  iman: { x: 140, y: 95 },
  taqwa: { x: 340, y: 95 },
  huda: { x: 540, y: 95 },
  ikhlas: { x: 140, y: 220 },
  tawakkul: { x: 280, y: 220 },
  rahmah: { x: 440, y: 220 },
  sabr: { x: 600, y: 220 },
  syukur: { x: 520, y: 315 },
};

export default function KnowledgeExplorerClient() {
  const [tab, setTab] = useState<"network" | "themes" | "tafsir" | "notes">("network");
  const [overview, setOverview] = useState<KnowledgeOverviewResponse | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("taqwa");
  const [conceptDetail, setConceptDetail] = useState<KnowledgeConceptDetailResponse | null>(null);

  const [selectedTheme, setSelectedTheme] = useState("akidah-tauhid");
  const [themeDetail, setThemeDetail] = useState<Awaited<ReturnType<typeof fetchKnowledgeTheme>> | null>(null);

  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(6);
  const [ayahKnowledge, setAyahKnowledge] = useState<AyahKnowledgeResponse | null>(null);

  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [noteConcept, setNoteConcept] = useState("taqwa");

  useEffect(() => {
    fetchKnowledgeOverview().then(setOverview).catch(() => {});
    fetchKnowledgeNotes().then(setNotes).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      fetchKnowledgeConcept(selectedSlug).then(setConceptDetail).catch(() => {});
    }
  }, [selectedSlug]);

  useEffect(() => {
    if (selectedTheme) {
      fetchKnowledgeTheme(selectedTheme).then(setThemeDetail).catch(() => {});
    }
  }, [selectedTheme]);

  useEffect(() => {
    fetchAyahKnowledge(surah, ayah).then(setAyahKnowledge).catch(() => setAyahKnowledge(null));
  }, [surah, ayah]);

  const concepts = overview?.concepts ?? [];
  const links = overview?.links ?? [];
  const themes = overview?.themes ?? [];

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    await createKnowledgeNote({
      title: noteTitle,
      content: noteContent,
      tags: noteTags,
      surah_id: surah,
      ayah_number: ayah,
      concept_slug: noteConcept || undefined,
    });
    setNoteTitle("");
    setNoteContent("");
    setNoteTags("");
    fetchKnowledgeNotes().then(setNotes).catch(() => {});
  }

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "1.25rem 1rem 3rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.55rem" }}>Quran Knowledge Engine</h1>
          <p style={{ margin: "0.2rem 0 0", color: "#57534e", fontSize: "0.88rem" }}>
            Menghubungkan kata, konsep semantik, tema Al-Qur&apos;an, rujukan tafsir, cross-reference ayat, &amp; catatan pribadi.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href="/mushaf" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", textDecoration: "none", color: "#1c1917", fontWeight: 600, fontSize: "0.85rem" }}>
            Mushaf
          </a>
          <a href="/context" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", textDecoration: "none", color: "#1c1917", fontWeight: 600, fontSize: "0.85rem" }}>
            Konteks
          </a>
          <a href="/sarf" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", textDecoration: "none", color: "#1c1917", fontWeight: 600, fontSize: "0.85rem" }}>
            Sarf
          </a>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {[
          { id: "network", label: "Semantic Network & Concept" },
          { id: "themes", label: "Thematic Explorer" },
          { id: "tafsir", label: "Tafsir & Cross-Ref Ayat" },
          { id: "notes", label: `Personal Library (${notes.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as "network" | "themes" | "tafsir" | "notes")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 8,
              border: "1px solid #d6cfc2",
              background: tab === t.id ? "#0f766e" : "#fff",
              color: tab === t.id ? "#fff" : "#292524",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Semantic Network & Concept Explorer */}
      {tab === "network" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "1rem", alignItems: "start" }}>
          <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Jaringan Semantik Konsep Al-Qur&apos;an</h2>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.78rem", color: "#57534e" }}>
              Klik salah satu simpul konsep untuk menelusuri relasi makna dan ayat-ayatnya.
            </p>
            <svg viewBox="0 0 720 365" style={{ width: "100%", height: "auto", background: "#fffdf9", borderRadius: 10, border: "1px solid #f0ece1" }}>
              <defs>
                <marker id="k-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
                </marker>
              </defs>
              {links.map((lk) => {
                const p1 = NODE_POS[lk.source_slug] || { x: 100, y: 100 };
                const p2 = NODE_POS[lk.target_slug] || { x: 200, y: 200 };
                const active = lk.source_slug === selectedSlug || lk.target_slug === selectedSlug;
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                return (
                  <g key={lk.id}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={active ? "#0f766e" : "#cbd5e1"}
                      strokeWidth={active ? 2.2 : 1.3}
                      markerEnd="url(#k-arrow)"
                    />
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize="9.5" fill={active ? "#0f766e" : "#64748b"} fontWeight={active ? 700 : 400}>
                      {lk.relation_type}
                    </text>
                  </g>
                );
              })}
              {concepts.map((c) => {
                const pos = NODE_POS[c.slug] || { x: 80, y: 80 };
                const isSel = c.slug === selectedSlug;
                return (
                  <g key={c.slug} style={{ cursor: "pointer" }} onClick={() => setSelectedSlug(c.slug)}>
                    <rect
                      x={pos.x - 54}
                      y={pos.y - 26}
                      width={108}
                      height={52}
                      rx={12}
                      fill={isSel ? "#0f766e" : "#ffffff"}
                      stroke={isSel ? "#065f46" : "#d6cfc2"}
                      strokeWidth={isSel ? 2.2 : 1.2}
                    />
                    <text x={pos.x} y={pos.y - 2} textAnchor="middle" fontSize="15" fontWeight={700} fill={isSel ? "#ffffff" : "#1c1917"}>
                      {c.name_arabic}
                    </text>
                    <text x={pos.x} y={pos.y + 16} textAnchor="middle" fontSize="10" fill={isSel ? "#d1fae5" : "#57534e"}>
                      {c.name_latin}
                    </text>
                  </g>
                );
              })}
            </svg>
          </section>

          <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
            {conceptDetail ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0f766e", textTransform: "uppercase" }}>
                      {conceptDetail.concept.category}
                    </span>
                    <h2 style={{ margin: "0.15rem 0", fontSize: "1.25rem" }}>
                      {conceptDetail.concept.name_latin} — <span className="arabic-ui" style={{ fontSize: "1.5rem" }}>{conceptDetail.concept.name_arabic}</span>
                    </h2>
                  </div>
                  {conceptDetail.concept.root_text && (
                    <span style={{ fontSize: "0.8rem", background: "#f5f5f4", padding: "0.25rem 0.6rem", borderRadius: 8 }}>
                      Akar: <span className="arabic-ui" style={{ fontSize: "1.05rem" }}>{conceptDetail.concept.root_text}</span>
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.88rem", color: "#292524", lineHeight: 1.5 }}>{conceptDetail.concept.summary}</p>
                <div style={{ fontSize: "0.73rem", color: "#78716c", marginBottom: "0.75rem" }}>
                  Sumber: {conceptDetail.concept.source_attribution}
                </div>

                <h3 style={{ fontSize: "0.9rem", margin: "0.5rem 0" }}>Relasi Konsep</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.85rem" }}>
                  {(conceptDetail.related_concepts ?? []).map((rc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedSlug(rc.slug)}
                      style={{ textAlign: "left", padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid #e7e5e4", background: "#fafaf9", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      <strong>{rc.relation_type}</strong> → {rc.name_latin} (<span className="arabic-ui">{rc.name_arabic}</span>): {rc.description}
                    </button>
                  ))}
                </div>

                <h3 style={{ fontSize: "0.9rem", margin: "0.5rem 0" }}>Contoh Ayat Terkait</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 260, overflowY: "auto" }}>
                  {(conceptDetail.ayahs ?? []).map((ay) => (
                    <div
                      key={ay.ayah_id}
                      onClick={() => { setSurah(ay.surah_id); setAyah(ay.ayah_number); setTab("tafsir"); }}
                      style={{ padding: "0.55rem 0.7rem", borderRadius: 8, border: "1px solid #e7e5e4", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f766e" }}>
                        QS. {ay.surah_name} ({ay.surah_id}:{ay.ayah_number}) ↗
                      </div>
                      <div className="arabic-ui" style={{ fontSize: "1.25rem", textAlign: "right", direction: "rtl" }}>{ay.arabic_text}</div>
                      <div style={{ fontSize: "0.76rem", color: "#57534e" }}>{ay.translation_id}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p>Memuat konsep...</p>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Thematic Quran Explorer */}
      {tab === "themes" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem", alignItems: "start" }}>
          <aside style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {themes.map((th) => (
              <button
                key={th.slug}
                type="button"
                onClick={() => setSelectedTheme(th.slug)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: 10,
                  border: selectedTheme === th.slug ? "1.5px solid #0f766e" : "1px solid #e7e5e4",
                  background: selectedTheme === th.slug ? "#f0fdf4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1c1917" }}>{th.title}</div>
                <div style={{ fontSize: "0.76rem", color: "#57534e", marginTop: "0.2rem" }}>{th.description}</div>
                <div style={{ fontSize: "0.72rem", color: "#0f766e", marginTop: "0.3rem", fontWeight: 600 }}>{th.ayah_count} ayat kunci</div>
              </button>
            ))}
          </aside>
          <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.15rem" }}>{themeDetail?.theme.title}</h2>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.85rem", color: "#57534e" }}>{themeDetail?.theme.description}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {(themeDetail?.ayahs ?? []).map((ay) => (
                <div key={ay.ayah_id} style={{ padding: "0.75rem", borderRadius: 10, border: "1px solid #e7e5e4", background: "#fffdf9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <strong style={{ fontSize: "0.84rem", color: "#0f766e" }}>QS. {ay.surah_name} ({ay.surah_id}:{ay.ayah_number})</strong>
                    <button
                      type="button"
                      onClick={() => { setSurah(ay.surah_id); setAyah(ay.ayah_number); setTab("tafsir"); }}
                      style={{ fontSize: "0.76rem", padding: "0.2rem 0.55rem", borderRadius: 6, border: "1px solid #d6cfc2", background: "#fff", cursor: "pointer" }}
                    >
                      Buka Tafsir &amp; Cross-Ref →
                    </button>
                  </div>
                  <div className="arabic-ui" style={{ fontSize: "1.45rem", textAlign: "right", direction: "rtl", lineHeight: 1.7 }}>{ay.arabic_text}</div>
                  {ay.note && <div style={{ fontSize: "0.8rem", color: "#44403c", marginTop: "0.35rem" }}>📌 {ay.note}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Tafsir Reference Layer & Cross-Reference Ayat */}
      {tab === "tafsir" && (
        <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Surah:</label>
            <input type="number" min={1} max={114} value={surah} onChange={(e) => setSurah(Math.min(114, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 70, padding: "0.35rem 0.5rem", borderRadius: 6, border: "1px solid #d6cfc2" }} />
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Ayat:</label>
            <input type="number" min={1} max={286} value={ayah} onChange={(e) => setAyah(Math.max(1, Number(e.target.value) || 1))} style={{ width: 70, padding: "0.35rem 0.5rem", borderRadius: 6, border: "1px solid #d6cfc2" }} />
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginLeft: "0.5rem" }}>
              {[
                { s: 1, a: 6, l: "1:6" },
                { s: 2, a: 2, l: "2:2" },
                { s: 2, a: 255, l: "2:255 (Kursi)" },
                { s: 103, a: 3, l: "103:3" },
                { s: 112, a: 1, l: "112:1" },
              ].map((p) => (
                <button key={p.l} type="button" onClick={() => { setSurah(p.s); setAyah(p.a); }} style={{ padding: "0.25rem 0.55rem", borderRadius: 999, border: "1px solid #d6cfc2", background: "#fafaf9", fontSize: "0.76rem", cursor: "pointer" }}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          {ayahKnowledge ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ padding: "0.9rem", borderRadius: 10, background: "#fffdf9", border: "1px solid #e7e5e4" }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f766e", marginBottom: "0.4rem" }}>
                  QS. {ayahKnowledge.surah_name} ({ayahKnowledge.surah_id}:{ayahKnowledge.ayah_number})
                </div>
                <div className="arabic-ui" style={{ fontSize: "1.75rem", textAlign: "right", direction: "rtl", lineHeight: 1.8 }}>{ayahKnowledge.arabic_text}</div>
                <div style={{ fontSize: "0.86rem", color: "#44403c", marginTop: "0.4rem" }}>{ayahKnowledge.translation_id}</div>
              </div>

              <div>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>Tafsir Reference Layer</h3>
                {(ayahKnowledge.tafsirs ?? []).length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#78716c" }}>Belum ada ringkasan tafsir terkurasi untuk ayat ini (coba preset 1:6, 2:2, 2:255, atau 112:1).</p>
                ) : (
                  (ayahKnowledge.tafsirs ?? []).map((tf, idx) => (
                    <div key={idx} style={{ padding: "0.8rem", borderRadius: 10, border: "1px solid #d1fae5", background: "#f0fdf4", marginBottom: "0.5rem" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#065f46" }}>{tf.source_name} · {tf.author}</div>
                      <p style={{ margin: "0.35rem 0", fontSize: "0.88rem", color: "#1c1917" }}>{tf.summary_text}</p>
                      {tf.key_points && <div style={{ fontSize: "0.8rem", color: "#047857" }}>💡 Poin kunci: {tf.key_points}</div>}
                    </div>
                  ))
                )}
              </div>

              <div>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>Cross-Reference Ayat (Ayat-ke-Ayat)</h3>
                {(ayahKnowledge.cross_references ?? []).length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#78716c" }}>Belum ada cross-reference eksplisit untuk ayat ini.</p>
                ) : (
                  (ayahKnowledge.cross_references ?? []).map((cr, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setSurah(cr.surah_id); setAyah(cr.ayah_number); }}
                      style={{ padding: "0.75rem", borderRadius: 10, border: "1px solid #e7e5e4", marginBottom: "0.5rem", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "#7c3aed" }}>
                        <span>QS. {cr.surah_name} ({cr.surah_id}:{cr.ayah_number}) →</span>
                        <span>{cr.relation_type} · {cr.source_attribution}</span>
                      </div>
                      <div className="arabic-ui" style={{ fontSize: "1.35rem", textAlign: "right", direction: "rtl", margin: "0.25rem 0" }}>{cr.arabic_text}</div>
                      <div style={{ fontSize: "0.8rem", color: "#44403c" }}>{cr.explanation}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: "#78716c" }}>Ayat tidak ditemukan.</p>
          )}
        </section>
      )}

      {/* TAB 4: Personal Knowledge Library */}
      {tab === "notes" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1rem", alignItems: "start" }}>
          <form onSubmit={handleSaveNote} style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Tambah Catatan Pengetahuan</h2>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Judul catatan (mis. Makna Hidayah di 1:6)"
              style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #d6cfc2" }}
              required
            />
            <textarea
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Tulis refleksi, faedah tafsir, atau hubungan antar ayat..."
              style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #d6cfc2" }}
              required
            />
            <input
              type="text"
              value={noteTags}
              onChange={(e) => setNoteTags(e.target.value)}
              placeholder="Tags (mis. taqwa, tadabbur, al-fatihah)"
              style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #d6cfc2" }}
            />
            <select value={noteConcept} onChange={(e) => setNoteConcept(e.target.value)} style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #d6cfc2" }}>
              <option value="">-- Kaitkan Konsep (Opsional) --</option>
              {concepts.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name_latin} ({c.name_arabic})</option>
              ))}
            </select>
            <div style={{ fontSize: "0.76rem", color: "#78716c" }}>Otomatis tertaut ke ayat aktif: {surah}:{ayah}</div>
            <button type="submit" style={{ padding: "0.55rem", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Simpan ke Personal Library
            </button>
          </form>

          <section style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {notes.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1.5rem", color: "#78716c" }}>
                Belum ada catatan di Personal Knowledge Library. Tambahkan catatan pertama Anda di sebelah kiri.
              </div>
            ) : (
              notes.map((n) => (
                <div key={n.id} style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.96rem" }}>{n.title}</strong>
                    <button
                      type="button"
                      onClick={() => deleteKnowledgeNote(n.id).then(() => fetchKnowledgeNotes().then(setNotes))}
                      style={{ border: "none", background: "transparent", color: "#b91c1c", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      Hapus
                    </button>
                  </div>
                  <p style={{ margin: "0.35rem 0", fontSize: "0.86rem", color: "#292524", whiteSpace: "pre-wrap" }}>{n.content}</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.74rem", color: "#57534e" }}>
                    {n.surah_id && <span>📖 QS. {n.surah_name} ({n.surah_id}:{n.ayah_number})</span>}
                    {n.concept_latin && <span>🔗 Konsep: {n.concept_latin}</span>}
                    {n.tags && <span>🏷 {n.tags}</span>}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </main>
  );
}
