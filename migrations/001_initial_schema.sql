-- 001_initial_schema.sql
-- Baseline schema aligned with docs/database-schema.md

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Core Quran entities
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

-- 2. Edition & Mushaf layout
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

-- 3. Linguistic data & provenance
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

-- 4. User state (offline-first friendly)
CREATE TABLE bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
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

-- 5. Indexes
CREATE INDEX idx_ayahs_surah_ayah ON ayahs (surah_id, ayah_number);
CREATE INDEX idx_quran_words_ayah_word ON quran_words (ayah_id, word_number);
CREATE INDEX idx_quran_words_search_trgm ON quran_words USING gin (normalized_search_text gin_trgm_ops);
CREATE INDEX idx_mushaf_line_items_word ON mushaf_line_items (word_id) WHERE word_id IS NOT NULL;
CREATE INDEX idx_word_morphology_root ON word_morphology (root_id) WHERE root_id IS NOT NULL;
CREATE INDEX idx_word_morphology_lemma ON word_morphology (lemma_id) WHERE lemma_id IS NOT NULL;
CREATE INDEX idx_word_translations_word_lang ON word_translations (word_id, language_code);

COMMIT;
