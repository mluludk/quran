-- 008_learning_engine.sql
-- Adds SM-2 Spaced Repetition columns, daily learning goals, and daily study logs.

BEGIN;

ALTER TABLE learning_word_progress
  ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_learning_progress_due
  ON learning_word_progress (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS learning_user_goals (
  user_id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  daily_target INTEGER NOT NULL DEFAULT 15,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_daily_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, study_date)
);

INSERT INTO learning_user_goals (user_id, daily_target)
VALUES ('00000000-0000-0000-0000-000000000001', 15)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
