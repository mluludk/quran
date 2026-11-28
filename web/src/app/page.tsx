const PILLARS = [
  {
    code: "READ",
    title: "Membaca mushaf dengan nyaman.",
    accent: "#7c5c32",
    bg: "#fffdf7",
    links: [{ href: "/mushaf", label: "Mushaf Reader (604 Hal.) →" }],
  },
  {
    code: "UNDERSTAND",
    title: "Memahami kata, struktur dan makna.",
    accent: "#0f766e",
    bg: "#f0fdfa",
    links: [
      { href: "/tarjim", label: "Tarjim Per Kata →" },
      { href: "/mushaf", label: "Mode Nahwu & I‘rab →" },
    ],
  },
  {
    code: "EXPLORE",
    title: "Menelusuri root, konsep dan konteks.",
    accent: "#6d28d9",
    bg: "#f5f3ff",
    links: [
      { href: "/context", label: "Context Explorer →" },
      { href: "/knowledge", label: "Knowledge Engine →" },
    ],
  },
  {
    code: "LEARN",
    title: "Belajar melalui latihan terstruktur.",
    accent: "#166534",
    bg: "#f0fdf4",
    links: [{ href: "/learn", label: "Learning Engine (/learn) →" }],
  },
  {
    code: "RETAIN",
    title: "Mempertahankan pengetahuan melalui review.",
    accent: "#b45309",
    bg: "#fffbeb",
    links: [
      { href: "/learn", label: "Due Review & SRS →" },
      { href: "/knowledge", label: "Personal Library →" },
    ],
  },
  {
    code: "RESEARCH",
    title: "Menggunakan corpus untuk eksplorasi.",
    accent: "#1e40af",
    bg: "#eff6ff",
    links: [
      { href: "/frequency", label: "Frekuensi Kata →" },
      { href: "/sarf", label: "Sarf Explorer →" },
    ],
  },
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "2.25rem 1.25rem 3rem" }}>
      <header
        style={{
          background: "#fff",
          border: "1px solid #e7e5e4",
          borderRadius: 16,
          padding: "1.75rem 1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: "0.74rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#7c5c32",
            marginBottom: "0.45rem",
          }}
        >
          Digital Mushaf &amp; Tadrij
        </div>
        <h1 style={{ margin: "0 0 0.6rem", fontSize: "2rem", lineHeight: 1.2, color: "#1c1917" }}>
          Quran Linguistic &amp; Learning Platform
        </h1>
        <p style={{ margin: "0 0 1.25rem", fontSize: "1.02rem", lineHeight: 1.6, color: "#44403c", maxWidth: 760 }}>
          Platform untuk mempelajari Al-Qur&apos;an melalui keterhubungan teks, kosakata, morfologi, nahwu, i&apos;rab,
          semantik, dan konteks ayat.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href="/mushaf"
            style={{
              padding: "0.6rem 1.15rem",
              borderRadius: 8,
              background: "#7c5c32",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.92rem",
            }}
          >
            Buka Mushaf Reader (604 Halaman) →
          </a>
          <a
            href="/learn"
            style={{
              padding: "0.6rem 1.15rem",
              borderRadius: 8,
              background: "#0f766e",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.92rem",
            }}
          >
            Mulai Belajar (/learn) →
          </a>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        {PILLARS.map((p) => (
          <div
            key={p.code}
            style={{
              background: "#fff",
              border: "1px solid #e7e5e4",
              borderTop: `4px solid ${p.accent}`,
              borderRadius: 12,
              padding: "1.1rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "0.85rem",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: p.accent,
                  background: p.bg,
                  padding: "0.2rem 0.55rem",
                  borderRadius: 6,
                  marginBottom: "0.55rem",
                }}
              >
                {p.code}
              </div>
              <p style={{ margin: 0, fontSize: "0.98rem", fontWeight: 600, color: "#1c1917", lineHeight: 1.45 }}>
                {p.title}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {p.links.map((lk) => (
                <a
                  key={lk.label}
                  href={lk.href}
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: p.accent,
                    textDecoration: "none",
                    padding: "0.3rem 0.6rem",
                    borderRadius: 6,
                    background: p.bg,
                    border: `1px solid ${p.accent}33`,
                  }}
                >
                  {lk.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.8rem", color: "#78716c", borderTop: "1px solid #e7e5e4", paddingTop: "1rem" }}>
        <span>
          Backend API: <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1"}</code>
        </span>
        <a href="/m0-proof" style={{ fontWeight: 600, color: "#7c5c32", textDecoration: "none" }}>
          M0 Renderer Proof (Halaman 1–3) →
        </a>
      </footer>
    </main>
  );
}
