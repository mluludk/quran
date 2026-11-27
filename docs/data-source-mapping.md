# Data Source Mapping and Audit

**Status:** Candidates only. None of the sources listed below is approved until contents, provenance, license, and coverage are audited.

## 1. Candidate sources

| Data | Candidate | Purpose | Audit status |
|---|---|---|---|
| Mushaf layout / glyph mapping | QPC V4 Mushaf Bundle — https://github.com/hussainsajib/qpc-v4-mushaf-bundle | Candidate page, line, glyph/word mapping and font data | Pending |
| 15-line layout database | QUL Mushaf layouts — https://github.com/blueheron786/quranic-universal-library-mushaf-layouts | Candidate SQLite 15-line layout | Pending |
| Word-by-word dataset | https://github.com/Mushaf-Learning/quran-word-by-word | Candidate translations and linguistic links (verify Indonesian `id` coverage; prepare fallback e.g. QUL / Quran.com v4 Indonesian WBW) | Pending |
| Morphology | Quranic Arabic Corpus — https://corpus.quran.com/ | Root, lemma, POS, morphology | Pending licensing and coverage review |
| Quran text | Tanzil — https://tanzil.net/docs/Text_License | Candidate text and source metadata | Pending |
| I‘rab (Nahwu) | Classical & contemporary works (e.g. Muhyiddin Darwish, Zakariya Da‘as, or open syntactic treebanks) | Grammatical role, status, sign, amil, and syntactic relations (separate from QAC morphology) | Pending |

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
