# Data Source Mapping and Audit

**Status:** M0 source audit completed for primary candidates. Distribution remains gated on [license-compliance.md](./license-compliance.md) clearance for commercial/public deployment.

## 1. Audited sources

| Data | Source | Format & Key Structure | M0 Audit Status |
|---|---|---|---|
| Mushaf layout / glyph mapping | QPC V4 Mushaf Bundle — https://github.com/hussainsajib/qpc-v4-mushaf-bundle | `words.csv` (83,668 rows: `id,location,surah,ayah,word,text` incl. ayah-end markers), `page_lines.csv` (8,624 rows: `page_number,line_number,line_type,is_centered,first_word_id,last_word_id,surah_number`), `qpc_mapping.csv` (`word_id,page_number,code`), 604 `p*.woff2` + `surah-name-v4.woff2` + `QCF4_Hafs_01_W.woff2` | **Verified** (data complete; font license requires KFQPC check) |
| 15-line layout reference | QUL Mushaf layouts — https://github.com/blueheron786/quranic-universal-library-mushaf-layouts | `qpc-v1-15-lines.db.zip`, `qpc-v2-15-lines.db.zip` (SQLite) | **Verified** as secondary reference; QPC V4 bundle already embeds derived `page_lines.csv` |
| Word-by-word dataset (archived candidate) | https://github.com/Mushaf-Learning/quran-word-by-word | Repo directories (`words/`, `morphology/`, `translations/`) contain only `.gitkeep` (empty) | **Rejected** (no data files) |
| Word-by-word Indonesian (`id`) | Quran.com API v4 / QUL (`https://api.quran.com/api/v4`, `language=id`) | JSON per verse/word with `location` (`surah:ayah:word`), `char_type_name`, `translation.text` (`indonesian`) | **Verified** (data & `location` key align with `words.csv`) |
| Morphology (Root, Lemma, POS, Segments) | `mustafa0x/quran-morphology` (fork of Quranic Arabic Corpus v0.4) — https://github.com/mustafa0x/quran-morphology | `quran-morphology.txt` TSV with `surah:ayah:word:segment`, Arabic segment, POS, `ROOT:...`, `LEM:...`, grammatical tags | **Verified** (segment key aligns with `location`; **GNU GPL** upstream) |
| Quran text (reference / fallback) | Tanzil — https://tanzil.net/docs/Text_License | Verified Uthmani/Simple text | **Verified** (CC BY 3.0, verbatim only) |
| I‘rab (Nahwu) | Classical & contemporary works (e.g. Muhyiddin Darwish, Zakariya Da‘as, or open syntactic treebanks) | Grammatical role, status, sign, amil, and syntactic relations (separate from QAC morphology) | Pending (M4) |

## 2. Audit checklist per source

- Repository / publisher / source owner.
- Exact release, commit, or version and retrieval date.
- Source file inventory and format.
- Quran text representation, Unicode and encoding.
- Identifier strategy and cross-reference keys.
- Coverage counts and missing records.
- Page, line, and word mapping coverage.
- Font/glyph dependencies and embedding/distribution restrictions.
- License, attribution, commercial use, modification, redistribution, and derivative-work conditions.
- Whether approval or permission is required.
- Source checksum and archived snapshot.
- ETL transform and validation report.

## 3. Proposed mapping

| Target entity | Source data | Mapping strategy |
|---|---|---|
| `surahs` | Quran metadata | Map by surah number; retain source key |
| `ayahs` | Quran text metadata | Map by surah/ayah with counting scheme verified |
| `quran_words` | Word segmentation source | Preserve source segmentation; create stable internal IDs |
| `mushaf_pages` | Layout source | Map by edition and page |
| `mushaf_lines` | Layout source | Preserve source line sequence |
| `mushaf_line_items` | Layout/glyph mapping | Resolve layout items (`word`, `ayah_end`, `surah_header`, `basmala`, `ornament`) to word/surah/ayah IDs; preserve glyph codes |
| `roots` / `lemmas` | Corpus annotations | Normalize entity records, retain source identifiers |
| `word_morphology` | Corpus annotations | Preserve tag and analysis payload with provenance |
| `word_translations` | Translation dataset | Preserve translation source and language |

## 4. Integration risks

Different datasets may use different word segmentation, identifiers, spelling, or counting conventions. Do not merge on Arabic string alone. Build explicit crosswalk tables and review ambiguous matches.

## 5. M0 deliverable

A source audit report documenting selected sources, licensing decision, coverage, crosswalks, missing records, and sample page/word mapping evidence.
