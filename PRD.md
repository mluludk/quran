# PRD — Digital Mushaf & Quran Word Explorer

**Version:** 1.0 (baseline)  
**Status:** Draft for engineering  
**Target:** Web app (Next.js), mobile app (Flutter), backend (Go/Fiber), PostgreSQL, Python ETL

## 1. Product vision

Build an offline-first digital Mushaf for Mushaf Madinah, riwayah Hafs, with a 604-page, 15-line reading experience as close as practical to the printed edition. Readers can select individual words to explore Indonesian translation and linguistic information (root, lemma, part of speech, and morphology).

**Principle:** Reading remains Mushaf-like; learning information should not disrupt reading.

## 2. Goals

- Render the 604-page edition in a fixed page/line layout.
- Preserve page and line composition; no dynamic text wrapping.
- Allow page, surah, and ayah navigation.
- Provide word-level selection and detail.
- Display Indonesian word translation and available root/lemma/POS/morphology information.
- Explore root occurrences.
- Support bookmarks, reading progress, and Arabic search.
- Work offline for core reading and locally bundled data.

## 3. Non-goals for MVP

- AI tutor or AI-generated tafsir.
- Audio streaming and recitation synchronization.
- Social/community features.
- Complex gamification, courses, subscriptions, or content CMS.
- User-generated linguistic annotations.

## 4. Target users

- Quran readers who want a digital page experience consistent with a printed Mushaf.
- Learners who want to study word meanings and morphology without leaving the reading screen.

## 5. MVP scope

### P0 — Core reading and word exploration
- Edition selector (MVP may expose only the target edition).
- 604-page navigation.
- Fixed page and line layout.
- Surah/ayah navigation.
- Word hit-testing/selection.
- Word detail: translation, root, lemma, POS, morphology, source/provenance where available.
- Root explorer and occurrences.

### P1 — Reading utilities & I‘rab Explorer
- Bookmarks.
- Reading progress.
- Search by Arabic word, root, and lemma.
- Offline data bundle and updates.
- **Quran I‘rab Explorer (post-core Word Explorer):** grammatical role (*i‘rab*), *amil*, case/mood status (*rafa‘, nashab, jar, jazm*), *tanda i‘rab*, syntactic relations (*hubungan nahwu*), explanation, and multi-opinion support with source provenance (requires Arabic/nahwu scholar validation).

## 6. User stories

- As a reader, I can open a page and read without text reflow.
- I can jump to a page, surah, or ayah.
- I can tap a word and see its detail while the page remains unchanged.
- I can open a root and browse related occurrences.
- I can bookmark a page or ayah and resume reading.
- I can search normalized Arabic text while the displayed text remains unchanged.

## 7. UX

### Reading screen
- Page header or unobtrusive controls for page, surah, juz (if sourced).
- Page renderer uses fixed geometry.
- Swipe/page navigation and direct page entry.
- Selected word highlighted via overlay.
- Word detail presented in bottom sheet or secondary panel.

### Word detail
- Displayed word and verse context, plus quick summary badges (*role*, *Isim/Fi'il/Harf*, *i‘rab status*).
- Indonesian translation.
- Root and lemma (if available).
- POS and morphology (if sourced).
- **I‘rab (Nahwu) tab/section (when sourced):** grammatical role, status (*marfu‘, mansub, majrur, majzum, mabni*), sign (*tanda i‘rab*), *amil*, syntactic relations (*Hubungan Nahwu*) to other words in the ayah, explanation, and source reference (supporting multiple scholarly opinions).
- **Ayah I‘rab Dependency Diagram:** interactive RTL SVG arc diagram showing word order and syntactic relations across the entire ayah.
- Links to root occurrences.

### Root & Word Family explorer
- Root form (spaced three-letter root, e.g. `ك ت ب`).
- **Word Family view:** derivations grouped by lemma, category (*Fi'il*, *Isim*, *Masdar*), and verb form (*wazan*), with root-letter vs affix (*ziyadah*) highlighting and occurrence counts.
- Occurrence list with verse references and Indonesian word meanings.
- Jump back to Mushaf location.

### Word-by-Word Learning Module (`/learn`)
- Three learning tracks: **High-Frequency Words (80/20)**, **Per Juz (1–30)** (with *new words since Al-Fatihah* option), and **Per Mushaf Page (1–604)**.
- Interactive **Multiple-Choice Quiz (4 options)** and **Flashcard** modes.
- Mastery tracking per normalized Arabic word (`learning_word_progress`) so mastered words carry across all Juz, plus 1-click save to **Vocabulary Notebook**.

### Quran Grammar Learning Mode
- Optional toggle on `/mushaf` and `/tarjim` (preserves standard Mushaf reading when OFF) to highlight words by grammatical function: *Mubtada'*, *Khabar*, *Fa'il*, *Maf'ul Bih*, *Huruf Jar*, *Ism Majrur*, and *Amil*.
- Selecting a highlighted word displays its **Amil** and Indonesian grammatical reasoning in the Word & I‘rab Explorer.

### Quran Vocabulary Frequency (`/frequency`)
- Displays exact word occurrence counts, root occurrence counts, surface form variations, Makkiyah vs Madaniyah distribution, top surahs, and full ayah context comparisons, plus Top Frequent Words & Roots leaderboards.

## 8. Data and architecture principles

- Preserve original source records and identifiers.
- Separate Quran core, Mushaf layout, and linguistic annotations logically.
- Keep source attribution, licensing, and version provenance.
- Make ETL reproducible and auditable.
- Do not assume source datasets or fonts may be redistributed commercially until license review.
- Avoid mixing editorial/linguistic source assertions without provenance.

## 9. Baseline technology

- Web: Next.js / TypeScript (online-first, consumes Go/Fiber API; built first to validate 604-page layout, data accuracy, and Word Explorer UX).
- Mobile: Flutter / Dart (offline-first).
- Backend: Go with Fiber.
- Database: PostgreSQL.
- ETL/data engineering: Python.
- Offline storage (mobile): SQLite (`mushaf_bundle.db` read-only + `user_state.db` read-write).
- Core mobile reading is offline-first; API powers the Next.js web client as well as bundle updates, discovery, and optional sync.

## 10. Proposed API

See `docs/api-specification.md`.

## 11. Success criteria

- Edition data validated against its source and counting conventions.
- Page/line layout integrity verified across all pages.
- Word-to-layout hit-test mapping demonstrated.
- Word details correctly resolve to their verse and linguistic records.
- Offline reader can open pages and select words without network.
- Search, bookmarks, and progress are usable and tested.
- ETL can be rerun deterministically with source-version tracking.

## 12. Roadmap

See `docs/development-roadmap.md`. Begin with M0 source/licensing audit and renderer proof before full implementation.

## 13. Risks

- Dataset or font license prohibits intended distribution.
- Layout dataset lacks sufficient geometry or mapping for precise hit-testing.
- Text/glyph mapping is incomplete or inconsistent.
- Linguistic annotation sources disagree or have limited coverage.
- Arabic shaping and font behavior differ across devices.
- Search normalization causes false matches.
- Dataset updates require migrations and user-data compatibility.

## 14. Decisions requiring verification

- Exact layout dataset and source version.
- Source licenses, attribution, and redistribution permissions.
- Renderer strategy: glyph/page-font rendering, fixed-line composition, or hybrid.
- Local storage and offline bundle format.
- Linguistic-source coverage and Indonesian translation source.
- Whether bookmarks are page-based, ayah-based, or both.
