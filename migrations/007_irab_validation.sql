-- 007_irab_validation.sql
-- Adds provenance validation status, confidence score, and audit metadata to irab_analyses.

ALTER TABLE irab_analyses
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'auto_validated',
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(4,2) NOT NULL DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_irab_analyses_validation_status
  ON irab_analyses (validation_status);
