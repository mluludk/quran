export default function HomePage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1>Digital Mushaf &amp; Quran Word Explorer</h1>
      <p>
        Starter web shell (M3-Web). Backend API target:{" "}
        <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1"}</code>
      </p>
      <ul>
        <li>Mushaf Madinah (Hafs) — 604 halaman, fixed 15-line layout</li>
        <li>Word-level selection &amp; Indonesian translation</li>
        <li>Root, lemma, POS &amp; morphology explorer</li>
      </ul>
      <p>
        <a href="/m0-proof" style={{ fontWeight: 600, color: "#7c5c32" }}>
          → Buka M0 Renderer &amp; Hit-Test Proof (Halaman 1–3)
        </a>
      </p>
    </main>
  );
}
