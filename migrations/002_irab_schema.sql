-- 002_irab_schema.sql
-- Quran I'rab Explorer (Nahwu & syntactic relations)

BEGIN;

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
  opinion_label TEXT NOT NULL DEFAULT 'primary',
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
  role_arabic TEXT NOT NULL,
  role_latin TEXT,
  irab_status TEXT,
  irab_sign TEXT,
  amil TEXT,
  explanation TEXT,
  UNIQUE (analysis_id, word_id, segment_number)
);

CREATE TABLE irab_relations (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES irab_analyses(id) ON DELETE CASCADE,
  source_node_id BIGINT NOT NULL REFERENCES irab_word_nodes(id) ON DELETE CASCADE,
  target_node_id BIGINT NOT NULL REFERENCES irab_word_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  description TEXT,
  UNIQUE (analysis_id, source_node_id, target_node_id, relation_type)
);

CREATE INDEX idx_irab_analyses_ayah ON irab_analyses (ayah_id);
CREATE INDEX idx_irab_word_nodes_word ON irab_word_nodes (word_id);
CREATE INDEX idx_irab_word_nodes_analysis ON irab_word_nodes (analysis_id, sequence_order);
CREATE INDEX idx_irab_relations_source ON irab_relations (source_node_id);
CREATE INDEX idx_irab_relations_target ON irab_relations (target_node_id);

COMMIT;
