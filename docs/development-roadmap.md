# Development Roadmap

Indicative estimate for one experienced developer; dataset licensing, layout quality, and renderer proof may change this estimate.

## M0 — Source audit and renderer proof (1–2 weeks)

- Audit candidate layout, linguistic, and translation sources.
- Review licensing and redistribution terms (both mobile bundle and web `@font-face` / API serving).
- Inspect file formats, mappings, segmentation, and fonts.
- Build a minimal proof with three representative pages and word hit-testing (web DOM proof + Flutter renderer parity check).
- Decide renderer approach.

**Gate:** renderer and data sources are viable and legally cleared for the target platforms.

## M1 — Database and ETL (1–2 weeks)

- Finalize schema based on source mapping.
- Implement source versioning and staging.
- Import Quran core, layout, and linguistics.
- Build validation reports, crosswalks, and offline SQLite bundle generator.

## M2 — Backend API (about 1 week)

- Go/Fiber endpoints for edition/page, ayah, word detail, roots, search, and bundle manifest.
- CORS configuration and HTTP caching headers (`ETag` / `Cache-Control`) for Next.js web client.
- API schema and integration tests.

## M3-Web — Next.js reader & Word Explorer (1–2 weeks)

- Fixed 604-page renderer with web fonts and DOM word hit-testing.
- Page/surah/ayah navigation and shareable URLs.
- Word detail panel (Indonesian translation, root, lemma, POS, morphology).
- Root explorer and Arabic/root/lemma search.
- End-to-end validation of dataset accuracy and UX before mobile build.

## M3-Mobile — Flutter offline-first reader (2–3 weeks)

- Fixed page renderer and native hit-testing/selection highlight.
- Page/surah/ayah navigation.
- Dual SQLite local storage (`mushaf_bundle.db` + `user_state.db`) and atomic bundle updates.
- Word Explorer, search, bookmarks, and reading progress offline.
- Device layout and accessibility checks.

## M4 — Sync, polish & cross-platform parity (1 week)

- Optional user-state sync (bookmarks and reading progress) between web and mobile.
- Visual parity checks between Next.js and Flutter across representative pages.

## M5 — QA and release preparation (1–2 weeks)

- Visual, functional, offline, and data QA.
- License compliance and attribution (web + mobile).
- Release packaging, telemetry/privacy review, and backups.
- Pilot release.

**Indicative total:** 8–14 weeks, contingent on dataset and renderer viability.
