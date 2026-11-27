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

## 3. M0 audit findings (candidate sources)

| Asset / Source | License / Terms | Web (`@font-face` / API) & Mobile Impact | Action Required |
|---|---|---|---|
| **QPC V4 Mushaf Bundle** (`hussainsajib/qpc-v4-mushaf-bundle`) | Bundle metadata derived from QUL/fonts; **fonts (`p1..p604.woff2`, `surah-name-v4.woff2`, `QCF4_Hafs_01_W.woff2`) are copyright King Fahd Complex (KFQPC)** | KFQPC terms may restrict commercial redistribution or modification | Verify/obtain KFQPC permission before commercial launch; retain attribution |
| **QUL Mushaf Layouts** (`blueheron786/...`) | No `LICENSE` file in GitHub mirror; upstream is QUL / Tarteel AI | Unclear redistribution terms on mirror repo | Prefer QUL official provenance or `qpc-v4-mushaf-bundle` derived CSVs |
| **Quranic Arabic Corpus / `mustafa0x/quran-morphology`** | **GNU GPL** (verbatim copy/attribution required; strong copyleft) | Distributing GPL dataset inside a closed-source app or bundling may trigger GPL obligations | Either open-source the app/dataset integration under GPL-compatible terms, obtain commercial permission, or replace with non-GPL morphology source |
| **Tanzil Quran Text** (`tanzil.net`) | **CC BY 3.0** (verbatim text only, no alterations) | Allowed for web & mobile with attribution + link to `tanzil.net` | Add mandatory copyright notice & link in app/web footer |
| **Quran.com API v4 / QUL Indonesian WBW** | Platform-hosted open Islamic data; some individual resources lack explicit license tags | Check specific Indonesian WBW resource attribution on QUL | Confirm upstream Indonesian WBW author/attribution before bundling |
| **MASAQ v6** (`10.17632/9yvrzxktmr.6`) | Creative Commons (described as CC for ethical use; Mendeley `data_license` field is `None` in public API) | Strong candidate for I‘rab (`Syntactic_Role`, `Case_Mood`, `Case_Mood_Marker`) | Confirm exact CC BY 3.0 / CC BY-NC terms on Mendeley dataset page before commercial release |
| **NoorBayan/Quranic** (`github.com/NoorBayan/Quranic`) | **MIT License** | Permissive for web & mobile | Retain MIT copyright notice if treebank is used |
| **Mushaf-Learning/quran-word-by-word** | MIT (empty repo, `.gitkeep` only) | Not usable (no data) | Dropped |

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
