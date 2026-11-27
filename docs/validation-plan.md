# Validation Plan

## 1. Structural validation

- Surah count: 114.
- Ayah count: validate against the selected source and counting convention; 6,236 is the commonly used baseline but must be source-verified.
- Edition pages: target 604.
- Layout line structure: validate source-specific rules; target 15-line layout does not imply every page contains exactly 15 content lines.
- Word count and segmentation: source-specific reconciliation.

## 2. Integrity checks

- Unique source and internal IDs.
- Every word resolves to an ayah.
- Every layout reference resolves or is explicitly classified as non-word item.
- Page and line sequences valid.
- Duplicate or missing positions reported.
- Root/lemma/translation references resolve.
- Source provenance is present for imported annotations.

## 3. Linguistic & I‘rab coverage

Report:
- words with Indonesian translation (`77,429 / 77,432` — 100.0% in M1 baseline),
- words with root (`50,268`) and lemma (`76,572`),
- words with POS and morphology (`77,429` words / `130,030` segments — 100.0%),
- words with MASAQ v6 i‘rab nodes (`77,410` words / `157,673` nodes across `6,236` ayahs),
- intra-ayah syntactic relations (`24,882` records in `irab_relations`),
- ambiguous or multiple analyses,
- records with conflicting source assertions.

## 4. Visual QA

Compare representative page renderings to reference pages from the licensed target source:
- opening pages,
- pages containing special headers or basmala,
- page/ayah boundaries,
- pages with dense text,
- final pages,
- diacritics, glyphs, waqf markers, and verse markers.

## 5. Interaction QA

- Tap target resolves to correct word.
- Highlight overlay is accurate and does not shift layout.
- Word detail links to correct ayah and annotations.
- Root explorer occurrences navigate to the correct location.
- Page, surah, ayah navigation is correct.
- Search handles normalized variants without altering display text.

## 6. Offline QA

- App opens and reads pages with airplane mode.
- Word detail is available for bundled data.
- Bookmarks/progress persist locally.
- Bundle updates are atomic and recover from interruption.

## 7. ETL QA

- Repeat import produces same results (or documented deterministic deltas).
- Source checksum/version logged.
- Validation report emitted.
- Critical failures prevent promotion.
- Rollback tested.
