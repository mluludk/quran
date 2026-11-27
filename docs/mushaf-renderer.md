# Mushaf Renderer — Engineering Design

## Objective

Display the target Mushaf Madinah edition as a fixed page/line composition (target 604 pages and 15 lines), with reliable word selection, without text reflow.

## 1. Renderer constraints

- Page aspect and margins must be based on audited source layout.
- Scale the whole page surface; do not reflow words across lines.
- Preserve word order, line order, page breaks, glyphs, and ornaments where source data supports them.
- Selection highlight is an overlay and must not alter layout.
- Support RTL and Arabic shaping where text composition is used.
- Renderer must be tested on multiple device sizes and pixel densities.

## 2. Strategies

### A. Glyph/page-font mapping
Use mapped glyphs and font data if available and licensing permits. Requires a reliable mapping from tap location to word identity.

### B. Fixed-line text composition
Compose each line from data and use appropriate shaping. Validate spacing, alignment, glyph behavior, and line dimensions. Avoid ordinary Flutter text wrapping.

### C. Hybrid
Use fixed source layout and a selection overlay or hit-test map. This is a likely approach if the audited source supports it, but not assumed.

## 3. Hit testing

- Convert touch coordinates to page-local coordinates after scaling.
- Map coordinate to word/layout item via source geometry, calibrated hit regions, or line-specific lookup.
- Return stable `word_id`.
- If geometry is not present, prove a viable hit-test approach in M0 before committing.
- Handle verse markers, punctuation, ornaments, and whitespace as non-word items or nearest appropriate selection behavior.

## 4. Page navigation

- Page index 1–604 (edition-dependent).
- Swipe/scroll behavior defined and tested.
- Jump to page, surah, and ayah.
- Page-to-ayah and ayah-to-page mappings must be data-driven.

## 5. Selection and detail

- Highlight selected word without modifying page layout.
- Open detail sheet with translation and linguistic data.
- Dismiss or navigate while preserving reading position.
- Root occurrence selection returns to the relevant page/ayah.

## 6. Visual QA

Test page 1, page 2, opening surah pages, pages with special layout, mid-page verse transitions, end-of-book pages, and glyph/diacritic edge cases.

## 7. M0 proof of concept (Completed for Next.js Web)

Implemented at `web/src/app/m0-proof/page.tsx` using real QPC V4 fonts (`p1.woff2`–`p3.woff2`, `surah-name-v4.woff2`, `QCF4_Hafs_01_W.woff2`) and `web/src/data/m0-proof-pages.json`:
- **Page 1** (8 lines, 29 words): Al-Fatihah opening layout (`surah_name` + centered `ayah` lines).
- **Page 2** (8 lines, 36 words): Al-Baqarah opening (`surah_name` + `basmallah` + centered `ayah` lines).
- **Page 3** (15 lines, 127 words): Full 15-line justified layout.

**Key M0 renderer findings:**
- Each `word_id` in `qpc_mapping.csv` can map to **one or more space-separated decimal codepoints** (e.g. `64582 64583`).
- `page_lines.csv` provides `is_centered` to distinguish centered opening lines (Pages 1–2) from full-width 15-line pages (Page 3+).
- Next.js DOM-based per-word `<button>` elements achieve exact word hit-testing and non-shifting highlight overlays (`outline`) with 100% alignment to Quran.com Indonesian WBW and `mustafa0x/quran-morphology` segments.
- Flutter renderer parity check remains pending Flutter SDK availability in M3-Mobile.
