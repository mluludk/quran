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

## 7. M0 proof of concept

Render at least three representative pages in Flutter:
- One opening page.
- One dense or complex page.
- One page selected for difficult glyph/line behavior.

Demonstrate page integrity, scaling, word selection, and source-to-word mapping before choosing the renderer.
