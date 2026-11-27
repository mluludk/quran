# Development Roadmap

Indicative estimate for one experienced developer; dataset licensing, layout quality, and renderer proof may change this estimate.

## M0 — Source audit and renderer proof (**Completed for Web**)

- Audited QPC V4, QUL, `mustafa0x/quran-morphology`, Quran.com API v4 Indonesian WBW, Tanzil, MASAQ v6, and NoorBayan/Quranic.
- Documented licensing and redistribution terms in `docs/license-compliance.md`.
- Built Next.js `/m0-proof` (3 representative pages with QPC V4 fonts and word hit-testing).
- Flutter renderer parity check deferred to M3-Mobile.

## M1 — Database and ETL (**Completed**)

- Applied `migrations/001_initial_schema.sql` and `migrations/002_irab_schema.sql` on PostgreSQL 16.
- Implemented `acquire.py`, `normalize.py`, `pipeline.py`, `irab_masaq.py`, `validate.py`, and `build_bundle.py`.
- Loaded 114 surahs, 6,236 ayahs, 77,432 words, 604 pages, 130,030 morphology segments, 77,429 Indonesian translations, 157,673 MASAQ v6 i‘rab nodes, and 24,882 syntactic relations, plus `mushaf_bundle.db`.

## M2 — Backend API (**Completed**)

- Go/Fiber `/api/v1` endpoints for surahs, ayahs, editions, pages, words (with morphology, i‘rab & relations), ayah i‘rab graph, root detail, root word family (`/roots/:id/family`), root occurrences, search, bundles, bookmarks, and reading progress.
- CORS, `Cache-Control` headers, and live PostgreSQL integration tests (`go test -v ./...`).

## M3-Web — Next.js reader, Word, I‘rab & Root Family Explorer (**Completed**)

- Fixed 604-page renderer (`/mushaf`) with dynamic per-page QPC V4 `@font-face` (`p1`–`p604.woff2`) and `Scheherazade New` Arabic UI font.
- Word hit-testing, highlight overlay, and redesigned Word & I‘rab Explorer panel (badges, spaced root, Indonesian translation, Sharaf segments, MASAQ I‘rab, and Hubungan Nahwu).
- Interactive SVG RTL Ayah I‘rab Dependency Arc Diagram (`AyahIrabDiagramModal.tsx`).
- Root & Word Family Explorer (`RootExplorerModal.tsx` with Fi'il/Isim/Masdar filters and root-letter vs affix highlighting), Arabic/Root search, bookmarks, and reading progress.

## M3-Mobile — Flutter offline-first reader (2–3 weeks)

- Fixed page renderer and native hit-testing/selection highlight.
- Page/surah/ayah navigation.
- Dual SQLite local storage (`mushaf_bundle.db` + `user_state.db`) and atomic bundle updates.
- Word Explorer, search, bookmarks, and reading progress offline.
- Device layout and accessibility checks.

## M4 — Sync, I‘rab Explorer & cross-platform parity (2–3 weeks)

- **Quran I‘rab Explorer:**
  - Source, copyright, and digitization audit for i‘rab datasets/works.
  - ETL ingestion for `irab_sources`, `irab_analyses`, `irab_word_nodes`, `irab_relations` + Arabic/nahwu scholar validation.
  - API endpoints (`/words/{id}/irab`, `/ayahs/{surah}/{ayah}/irab`).
  - Integrated I‘rab & syntactic relation UI in Next.js and Flutter Word Explorer.
- Optional user-state sync (bookmarks and reading progress) between web and mobile.
- Visual parity checks between Next.js and Flutter across representative pages.

## M5 — QA and release preparation (1–2 weeks)

- Visual, functional, offline, and data QA.
- License compliance and attribution (web + mobile).
- Release packaging, telemetry/privacy review, and backups.
- Pilot release.

**Indicative total:** 9–16 weeks, contingent on dataset, i‘rab source clearance, and renderer viability.
