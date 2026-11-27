# Database Schema (Draft)

PostgreSQL schema proposal. Names and constraints are illustrative; finalize after source audit and import proof.

## 1. Core

```sql
CREATE TABLE surahs (
  id SMALLINT PRIMARY KEY,
  name_arabic TEXT NOT NULL,
  name_transliteration TEXT,
  name_translation TEXT,
  revelation_type TEXT,
  ayah_count SMALLINT NOT NULL
);

CREATE TABLE ayahs (
  id BIGINT PRIMARY KEY,
  surah_id SMALLINT NOT NULL REFERENCES surahs(id),
  ayah_number SMALLINT NOT NULL,
  juz_number SMALLINT,
  hizb_number SMALLINT,
  UNIQUE (surah_id, ayah_number)
);

CREATE TABLE quran_words (
  id BIGINT PRIMARY KEY,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id),
  word_number SMALLINT NOT NULL,
  arabic_text TEXT NOT NULL,
  normalized_search_text TEXT,
  UNIQUE (ayah_id, word_number)
);
```

## 2. Edition and layout

```sql
CREATE TABLE mushaf_editions (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  riwayah TEXT NOT NULL,
  page_count SMALLINT NOT NULL,
  target_lines_per_page SMALLINT,
  source_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mushaf_pages (
  id BIGSERIAL PRIMARY KEY,
  edition_id BIGINT NOT NULL REFERENCES mushaf_editions(id),
  page_number SMALLINT NOT NULL,
  juz_number SMALLINT,
  hizb_number SMALLINT,
  font_asset_key TEXT,
  UNIQUE (edition_id, page_number)
);

CREATE TABLE mushaf_lines (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES mushaf_pages(id),
  line_number SMALLINT NOT NULL,
  line_type TEXT,
  is_centered BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (page_id, line_number)
);

CREATE TABLE mushaf_line_items (
  id BIGSERIAL PRIMARY KEY,
  line_id BIGINT NOT NULL REFERENCES mushaf_lines(id),
  item_type TEXT NOT NULL, -- 'word', 'ayah_end', 'surah_header', 'basmala', 'ornament'
  word_id BIGINT REFERENCES quran_words(id),
  surah_id SMALLINT REFERENCES surahs(id),
  ayah_id BIGINT REFERENCES ayahs(id),
  position_in_line SMALLINT NOT NULL,
  display_text TEXT,
  source_glyph_code TEXT,
  geometry JSONB,
  UNIQUE (line_id, position_in_line)
);
```

`geometry` is optional and should only be populated if the source supplies reliable geometry or it is derived and validated. Using `mushaf_line_items` with `item_type` allows non-word glyphs (ornaments, verse markers, surah headers, basmala) to live cleanly in the line sequence without forcing them into `quran_words`. `font_asset_key` supports editions that use per-page glyph fonts (such as QPC V4).

## 3. Linguistic data

```sql
CREATE TABLE roots (
  id BIGSERIAL PRIMARY KEY,
  arabic_text TEXT NOT NULL UNIQUE
);

CREATE TABLE lemmas (
  id BIGSERIAL PRIMARY KEY,
  arabic_text TEXT NOT NULL UNIQUE
);

CREATE TABLE annotation_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  license_reference TEXT,
  source_url TEXT,
  UNIQUE (name, version)
);

CREATE TABLE word_morphology (
  id BIGSERIAL PRIMARY KEY,
  word_id BIGINT NOT NULL REFERENCES quran_words(id),
  segment_number SMALLINT NOT NULL DEFAULT 1,
  segment_arabic TEXT,
  root_id BIGINT REFERENCES roots(id),
  lemma_id BIGINT REFERENCES lemmas(id),
  pos TEXT,
  morphology_data JSONB,
  source_id BIGINT NOT NULL REFERENCES annotation_sources(id),
  UNIQUE (word_id, segment_number, source_id)
);

CREATE TABLE word_translations (
  id BIGSERIAL PRIMARY KEY,
  word_id BIGINT NOT NULL REFERENCES quran_words(id),
  language_code TEXT NOT NULL,
  translation TEXT NOT NULL,
  source_id BIGINT NOT NULL REFERENCES annotation_sources(id),
  UNIQUE (word_id, language_code, source_id)
);

CREATE TABLE source_crosswalks (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES annotation_sources(id),
  entity_type TEXT NOT NULL, -- 'surah', 'ayah', 'word', 'layout_item'
  source_key TEXT NOT NULL,
  internal_id BIGINT NOT NULL,
  UNIQUE (source_id, entity_type, source_key)
);
```

`word_morphology` models `segment_number` explicitly because linguistic corpora (e.g., Quranic Arabic Corpus) decompose words into morpheme segments (prefix, stem, suffix), each with its own POS and morphological features. Unique constraints across linguistic and crosswalk tables ensure ETL imports are idempotent.

## 3b. I‘rab (Nahwu) & syntactic relations

```sql
CREATE TABLE irab_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  author TEXT,
  edition TEXT,
  version TEXT NOT NULL DEFAULT '',
  license_reference TEXT,
  source_url TEXT,
  UNIQUE (name, version)
);

CREATE TABLE irab_analyses (
  id BIGSERIAL PRIMARY KEY,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id),
  source_id BIGINT NOT NULL REFERENCES irab_sources(id),
  opinion_label TEXT NOT NULL DEFAULT 'primary', -- supports multiple scholarly opinions per ayah
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ayah_id, source_id, opinion_label)
);

CREATE TABLE irab_word_nodes (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES irab_analyses(id) ON DELETE CASCADE,
  word_id BIGINT NOT NULL REFERENCES quran_words(id),
  segment_number SMALLINT NOT NULL DEFAULT 1,
  sequence_order SMALLINT NOT NULL,
  role_arabic TEXT NOT NULL,        -- e.g. مبتدأ، خبر، مضاف إليه
  role_latin TEXT,                  -- e.g. Mubtada', Khabar
  irab_status TEXT,                 -- e.g. marfu', mansub, majrur, majzum, mabni
  irab_sign TEXT,                   -- e.g. الضمة الظاهرة
  amil TEXT,                        -- governing factor
  explanation TEXT,
  UNIQUE (analysis_id, word_id, segment_number)
);

CREATE TABLE irab_relations (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES irab_analyses(id) ON DELETE CASCADE,
  source_node_id BIGINT NOT NULL REFERENCES irab_word_nodes(id) ON DELETE CASCADE,
  target_node_id BIGINT NOT NULL REFERENCES irab_word_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,      -- e.g. khabar_of, naat_of, mudhaf_ilaih_of, mutaalliq_bi
  description TEXT,
  UNIQUE (analysis_id, source_node_id, target_node_id, relation_type)
);

CREATE TABLE irab_phrases (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES irab_analyses(id) ON DELETE CASCADE,
  phrase_type TEXT NOT NULL,        -- 'jar_majrur', 'idhafah', 'jumlah_ismiyah', 'jumlah_filiyah', 'shilah_maushul', 'klausa_syarat'
  phrase_arabic TEXT NOT NULL,
  phrase_latin TEXT NOT NULL,
  start_word_id BIGINT NOT NULL REFERENCES quran_words(id),
  end_word_id BIGINT NOT NULL REFERENCES quran_words(id),
  mahal_irab TEXT,
  explanation TEXT,
  parent_phrase_id BIGINT REFERENCES irab_phrases(id) ON DELETE SET NULL,
  UNIQUE (analysis_id, phrase_type, start_word_id, end_word_id)
);
```

Separating `word_morphology` (Sharaf) from `irab_word_nodes` / `irab_relations` (Nahwu) allows a single ayah to store multiple valid scholarly i‘rab opinions without polluting word-level morphological records.

## 4. User state

```sql
CREATE TABLE bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID, -- nullable for local/offline-only mode before auth
  edition_id BIGINT REFERENCES mushaf_editions(id),
  page_number SMALLINT,
  ayah_id BIGINT REFERENCES ayahs(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE reading_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  edition_id BIGINT REFERENCES mushaf_editions(id),
  page_number SMALLINT NOT NULL,
  ayah_id BIGINT REFERENCES ayahs(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, edition_id)
);
```

## 5. Search indexes and constraints

- Add indexes for `ayahs(surah_id, ayah_number)`, `quran_words(ayah_id, word_number)`, root/lemma links, layout page and line keys.
- Use a normalized Arabic search representation separate from the display text.
- Use trigram or carefully designed text indexes for search after profiling.
- Validate edition page count and source-specific layout rules via ETL reports; avoid hard-coding 15 physical lines for exceptional pages unless the audited source requires it.
- Consider source-mapping tables for cross-dataset IDs and source provenance.
- Keep imported source data versioned and immutable where practical.
