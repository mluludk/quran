-- 005_word_first_occurrence_idx.sql
-- Fast B-tree index to determine first occurrence of normalized Arabic words since Al-Fatihah

BEGIN;

CREATE INDEX IF NOT EXISTS idx_quran_words_norm_id
  ON quran_words (normalized_search_text, id);

COMMIT;
