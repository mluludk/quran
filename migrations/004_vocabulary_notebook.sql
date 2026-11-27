-- 004_vocabulary_notebook.sql
-- Quran Vocabulary Notebook: collections (themes), saved words/ayahs, notes, progress & flashcards

BEGIN;

CREATE TABLE vocab_collections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vocab_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  collection_id BIGINT REFERENCES vocab_collections(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('word', 'ayah')),
  word_id BIGINT REFERENCES quran_words(id) ON DELETE CASCADE,
  ayah_id BIGINT REFERENCES ayahs(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  mastery_level SMALLINT NOT NULL DEFAULT 0, -- 0: Baru, 1: Belajar, 2: Dikuasai
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_vocab_items_collection ON vocab_items (collection_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vocab_items_mastery ON vocab_items (mastery_level) WHERE deleted_at IS NULL;

INSERT INTO vocab_collections (name, description)
VALUES ('Kosakata Harian', 'Kumpulan kata dan ayat Al-Qur''an yang sedang dipelajari')
ON CONFLICT DO NOTHING;

COMMIT;
