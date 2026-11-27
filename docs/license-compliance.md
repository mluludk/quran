# License and Compliance Audit

**Status: not cleared for distribution.** This document is a checklist, not legal advice or a statement that any candidate source is licensed for commercial use.

## 1. Audit each asset separately

Review:
- Quran text.
- Word segmentation.
- Page/line layout and mapping.
- Arabic fonts and glyph files.
- Indonesian translations.
- Root, lemma, POS, morphology and other annotations.
- I‘rab (nahwu) books, digitized syntactic analyses, and scholarly commentaries (copyright, edition, digitization permission, and scholar review).
- Source code and ETL libraries.

A repository license may not cover every bundled data file, font, translation, or upstream asset.

## 2. Terms to verify

- Commercial use.
- Redistribution in mobile apps and offline bundles.
- Web hosting, `@font-face` serving, and public JSON API redistribution (for the Next.js web client).
- Modification and derivative works.
- Attribution and notice requirements.
- Share-alike or copyleft requirements.
- Restrictions on extracting or republishing databases.
- Font embedding, subset, or app bundling.
- Whether permission is needed from publisher or contributor.
- Trademark or edition designation usage.

## 3. Candidate-source review queue

- QPC V4 Mushaf Bundle: inspect repository license and individual fonts/data assets.
- QUL layout database: inspect database license and provenance.
- Quranic Arabic Corpus: review corpus terms for commercial use and redistribution; obtain written permission if needed.
- Tanzil: review its text license and attribution/redistribution requirements.
- Word-by-word translation repository: review each translation and annotation source independently.

## 4. Evidence to retain

For each source:
- URL and owner.
- Exact version/commit.
- License file or terms snapshot and date reviewed.
- Permission correspondence, if applicable.
- Asset inventory and checksums.
- Required attribution text.
- Approved uses and restrictions.
- Reviewer and approval date.

## 5. Release gate

Do not ship or redistribute source data, translations, or fonts until the applicable permissions and obligations are confirmed. If a source is not cleared, replace it or obtain permission and document the decision.
