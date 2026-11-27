-- 006_learning_module.sql
-- Word-by-word translation memorization progress tracked by normalized_word

BEGIN;

CREATE TABLE learning_word_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  normalized_word TEXT NOT NULL,
  mastery_level SMALLINT NOT NULL DEFAULT 0, -- 0: Baru, 1: Belajar, 2: Hafal
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_word)
);

CREATE INDEX idx_learning_progress_mastery ON learning_word_progress (user_id, mastery_level);

COMMIT;
