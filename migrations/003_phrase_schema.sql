-- 003_phrase_schema.sql
-- Quran Phrase & Sentence Explorer (constituency / multi-word spans)

BEGIN;

CREATE TABLE irab_phrases (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES irab_analyses(id) ON DELETE CASCADE,
  phrase_type TEXT NOT NULL,         -- 'jar_majrur', 'idhafah', 'jumlah_ismiyah', 'jumlah_filiyah', 'shilah_maushul', 'klausa_syarat'
  phrase_arabic TEXT NOT NULL,       -- e.g. 'جار ومجرور', 'جملة اسمية'
  phrase_latin TEXT NOT NULL,        -- e.g. 'Jar-Majrur (PP)', 'Jumlah Ismiyah (NS)'
  start_word_id BIGINT NOT NULL REFERENCES quran_words(id),
  end_word_id BIGINT NOT NULL REFERENCES quran_words(id),
  mahal_irab TEXT,                   -- e.g. 'في محل رفع خبر', 'لا محل لها من الإعراب'
  explanation TEXT,
  parent_phrase_id BIGINT REFERENCES irab_phrases(id) ON DELETE SET NULL,
  UNIQUE (analysis_id, phrase_type, start_word_id, end_word_id)
);

CREATE INDEX idx_irab_phrases_analysis ON irab_phrases (analysis_id);
CREATE INDEX idx_irab_phrases_span ON irab_phrases (start_word_id, end_word_id);

COMMIT;
