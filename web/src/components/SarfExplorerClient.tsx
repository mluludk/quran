"use client";

import { useEffect, useState } from "react";
import {
  fetchIrabValidationSummary,
  fetchSarfExplore,
  type IrabValidationSummaryResponse,
  type SarfExploreResponse,
} from "@/lib/api";

const WAZAN_LABELS: Record<string, string> = {
  "VF:1": "Form I (فَعَلَ)",
  "VF:2": "Form II (فَعَّلَ)",
  "VF:3": "Form III (فَاعَلَ)",
  "VF:4": "Form IV (أَفْعَلَ)",
  "VF:5": "Form V (تَفَعَّلَ)",
  "VF:6": "Form VI (تَفَاعَلَ)",
  "VF:7": "Form VII (انْفَعَلَ)",
  "VF:8": "Form VIII (افْتَعَلَ)",
  "VF:9": "Form IX (افْعَلَّ)",
  "VF:10": "Form X (اسْتَفْعَلَ)",
};

const QUICK_TAGS = [
  { key: "", label: "Semua Bentuk" },
  { key: "PERF", label: "Fi'il Madhi (PERF)" },
  { key: "IMPF", label: "Fi'il Mudhari' (IMPF)" },
  { key: "IMPV", label: "Fi'il Amr (IMPV)" },
  { key: "PASS", label: "Majhul / Pasif (PASS)" },
  { key: "PCPL", label: "Isim Fa'il / Maf'ul (PCPL)" },
  { key: "VN", label: "Masdar (VN)" },
  { key: "ADJ", label: "Sifat / Musyabbahah (ADJ)" },
];

function isArabicBaseLetter(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  // Exclude Arabic combining marks / harakat (064B..065F, 0670, 06D6..06ED)
  if ((cp >= 0x064b && cp <= 0x065f) || cp === 0x0670 || (cp >= 0x06d6 && cp <= 0x06ed)) {
    return false;
  }
  return cp >= 0x0621 && cp <= 0x064a || cp === 0x0671;
}

function countBaseLetters(s: string): number {
  let n = 0;
  for (const ch of s) {
    if (isArabicBaseLetter(ch)) n++;
  }
  return n;
}

function renderHighlightedArabic(arabicText: string, segmentNumber?: number, allSegments?: string) {
  if (!segmentNumber || !allSegments) {
    return <span style={{ color: "#dc2626" }}>{arabicText}</span>;
  }
  const segs = allSegments.split("|");
  if (segs.length <= 1 || segmentNumber < 1 || segmentNumber > segs.length) {
    return <span style={{ color: "#dc2626" }}>{arabicText}</span>;
  }

  let skipBase = 0;
  for (let i = 0; i < segmentNumber - 1; i++) {
    skipBase += countBaseLetters(segs[i]);
  }
  const targetBase = countBaseLetters(segs[segmentNumber - 1]);
  if (targetBase === 0) {
    return <span style={{ color: "#dc2626" }}>{arabicText}</span>;
  }

  const chars = Array.from(arabicText);
  let baseSeen = 0;
  let startIdx = chars.length;
  let endIdx = chars.length;

  for (let idx = 0; idx < chars.length; idx++) {
    if (isArabicBaseLetter(chars[idx])) {
      if (baseSeen === skipBase && startIdx === chars.length) {
        startIdx = idx;
      }
      baseSeen++;
      if (baseSeen === skipBase + targetBase) {
        // Include trailing harakat attached to the last base letter of this segment
        let j = idx + 1;
        while (j < chars.length && !isArabicBaseLetter(chars[j])) {
          j++;
        }
        endIdx = j;
        break;
      }
    }
  }

  // If this is the last segment, extend to the end of word
  if (segmentNumber === segs.length) {
    endIdx = chars.length;
  }

  const before = chars.slice(0, startIdx).join("");
  const mid = chars.slice(startIdx, endIdx).join("");
  const after = chars.slice(endIdx).join("");

  return (
    <>
      {before && <span style={{ color: "#1c1917" }}>{before}</span>}
      {mid && <span style={{ color: "#dc2626" }}>{mid}</span>}
      {after && <span style={{ color: "#1c1917" }}>{after}</span>}
    </>
  );
}

export default function SarfExplorerClient() {
  const [pos, setPos] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<SarfExploreResponse | null>(null);
  const [valSummary, setValSummary] = useState<IrabValidationSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIrabValidationSummary().then(setValSummary).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSarfExplore({ pos, tag, q, limit: 24, offset })
      .then(setData)
      .finally(() => setLoading(false));
  }, [pos, tag, q, offset]);

  const posCounts = data?.summary?.pos_counts ?? [];
  const vfCounts = data?.summary?.verb_form_counts ?? [];
  const items = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "1.25rem 1rem 3rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Sarf &amp; Linguistic Engine Explorer</h1>
          <p style={{ margin: "0.2rem 0 0", color: "#57534e", fontSize: "0.9rem" }}>
            Telusuri wazan fi‘il (Form I–X), bentuk tashrif, akar kata, serta status validasi i‘rab Al-Qur&apos;an.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href="/mushaf" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", textDecoration: "none", color: "#1c1917", fontWeight: 600, fontSize: "0.85rem" }}>
            Mushaf
          </a>
          <a href="/frequency" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", textDecoration: "none", color: "#1c1917", fontWeight: 600, fontSize: "0.85rem" }}>
            Frekuensi
          </a>
          <a href="/context" style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fff", textDecoration: "none", color: "#1c1917", fontWeight: 600, fontSize: "0.85rem" }}>
            Konteks
          </a>
        </div>
      </header>

      {valSummary && (
        <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "0.92rem", color: "#065f46" }}>Status Validasi &amp; Provenance I‘rab</strong>
              <div style={{ fontSize: "0.8rem", color: "#57534e" }}>
                Total {valSummary.total_analyses.toLocaleString()} analisis · Rata-rata confidence{" "}
                <strong>{Math.round(valSummary.avg_confidence * 100)}%</strong> · {valSummary.alternative_opinions} pendapat alternatif
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(valSummary.by_status ?? []).map((st) => (
                <span
                  key={st.status}
                  style={{
                    fontSize: "0.78rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: 999,
                    fontWeight: 600,
                    background: st.status === "verified" ? "#dcfce7" : st.status === "needs_review" ? "#fef3c7" : "#e0f2fe",
                    color: st.status === "verified" ? "#166534" : st.status === "needs_review" ? "#92400e" : "#075985",
                  }}
                >
                  {st.status}: {st.count.toLocaleString()}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Search & Filters */}
      <section style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="Cari akar kata / lemma / kata Arab (mis. رحم, كتب, علم)..."
            style={{ flex: 1, minWidth: 240, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid #d6cfc2", fontSize: "0.9rem" }}
          />
          <button
            type="button"
            onClick={() => {
              setPos("");
              setTag("");
              setQ("");
              setOffset(0);
            }}
            style={{ padding: "0.5rem 0.9rem", borderRadius: 8, border: "1px solid #d6cfc2", background: "#fafaf9", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
          >
            Reset Filter
          </button>
        </div>

        {/* POS Chips */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "#57534e", fontWeight: 600 }}>Kelas Kata (POS):</span>
          <button
            type="button"
            onClick={() => { setPos(""); setOffset(0); }}
            style={{ padding: "0.22rem 0.55rem", borderRadius: 999, border: "1px solid #d6cfc2", background: pos === "" ? "#0f766e" : "#fff", color: pos === "" ? "#fff" : "#292524", fontSize: "0.76rem", cursor: "pointer" }}
          >
            Semua
          </button>
          {posCounts.map((p) => (
            <button
              key={p.pos}
              type="button"
              onClick={() => { setPos(p.pos); setOffset(0); }}
              style={{ padding: "0.22rem 0.55rem", borderRadius: 999, border: "1px solid #d6cfc2", background: pos === p.pos ? "#0f766e" : "#fff", color: pos === p.pos ? "#fff" : "#292524", fontSize: "0.76rem", cursor: "pointer" }}
            >
              {p.pos} ({p.count.toLocaleString()})
            </button>
          ))}
        </div>

        {/* Wazan / Verb Form Chips */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "#57534e", fontWeight: 600 }}>Wazan (Verb Form):</span>
          {vfCounts.map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => { setTag(tag === v.tag ? "" : v.tag); setOffset(0); }}
              style={{ padding: "0.22rem 0.55rem", borderRadius: 999, border: "1px solid #d6cfc2", background: tag === v.tag ? "#7c3aed" : "#fff", color: tag === v.tag ? "#fff" : "#292524", fontSize: "0.76rem", cursor: "pointer" }}
            >
              {WAZAN_LABELS[v.tag] || v.tag} ({v.count.toLocaleString()})
            </button>
          ))}
        </div>

        {/* Tashrif Feature Chips */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "#57534e", fontWeight: 600 }}>Bentuk Tashrif:</span>
          {QUICK_TAGS.map((qt) => (
            <button
              key={qt.key || "all"}
              type="button"
              onClick={() => { setTag(qt.key); setOffset(0); }}
              style={{ padding: "0.22rem 0.55rem", borderRadius: 999, border: "1px solid #d6cfc2", background: tag === qt.key ? "#b45309" : "#fff", color: tag === qt.key ? "#fff" : "#292524", fontSize: "0.76rem", cursor: "pointer" }}
            >
              {qt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Results Grid */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#57534e" }}>
            {loading ? "Memuat data Sarf..." : `Menampilkan ${items.length} dari ${total.toLocaleString()} segmen kata`}
          </span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 24))}
              style={{ padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid #d6cfc2", background: "#fff", cursor: offset === 0 ? "not-allowed" : "pointer" }}
            >
              ← Sebelumnya
            </button>
            <button
              type="button"
              disabled={offset + 24 >= total}
              onClick={() => setOffset(offset + 24)}
              style={{ padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid #d6cfc2", background: "#fff", cursor: offset + 24 >= total ? "not-allowed" : "pointer" }}
            >
              Berikutnya →
            </button>
          </div>
        </div>

        <div dir="rtl" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
          {items.map((it, idx) => (
            <div key={`${it.word_id}-${idx}`} dir="ltr" style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 10, padding: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 6, background: "#f5f5f4", color: "#44403c" }}>
                  {it.pos}
                </span>
                <span dir="rtl" className="arabic-ui" style={{ fontSize: "1.65rem", lineHeight: 1.4, color: "#1c1917", unicodeBidi: "embed" }}>
                  {renderHighlightedArabic(it.arabic_text, it.segment_number, it.all_segments)}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#065f46", marginTop: "0.25rem" }}>
                {it.translation_id || "—"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#57534e", marginTop: "0.3rem" }}>
                Lemma: <span className="arabic-ui" style={{ fontSize: "1rem" }}>{it.lemma || "-"}</span> · Akar:{" "}
                <span className="arabic-ui" style={{ fontSize: "1rem" }}>{it.root || "-"}</span>
              </div>
              <div style={{ fontSize: "0.7rem", color: "#78716c", marginTop: "0.3rem", wordBreak: "break-all" }}>
                {it.tags}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#78716c", marginTop: "0.4rem", borderTop: "1px dashed #e7e5e4", paddingTop: "0.35rem" }}>
                QS. {it.surah_name} ({it.surah_id}:{it.ayah_number})
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
