"""Build read-only mushaf_bundle.db SQLite artifact + manifest.json from PostgreSQL."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
from pathlib import Path

import psycopg


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build_bundle(database_url: str, out_dir: Path, version: str) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "mushaf_bundle.db"
    if db_path.exists():
        db_path.unlink()

    with psycopg.connect(database_url) as pg, sqlite3.connect(db_path) as sq:
        sq.executescript(
            """
            CREATE TABLE surahs (
              id INTEGER PRIMARY KEY,
              name_arabic TEXT NOT NULL,
              name_transliteration TEXT,
              name_translation TEXT,
              revelation_type TEXT,
              ayah_count INTEGER NOT NULL
            );
            CREATE TABLE ayahs (
              id INTEGER PRIMARY KEY,
              surah_id INTEGER NOT NULL,
              ayah_number INTEGER NOT NULL,
              juz_number INTEGER,
              hizb_number INTEGER
            );
            CREATE TABLE quran_words (
              id INTEGER PRIMARY KEY,
              ayah_id INTEGER NOT NULL,
              word_number INTEGER NOT NULL,
              arabic_text TEXT NOT NULL,
              normalized_search_text TEXT
            );
            CREATE TABLE mushaf_pages (
              id INTEGER PRIMARY KEY,
              page_number INTEGER NOT NULL UNIQUE,
              juz_number INTEGER,
              hizb_number INTEGER,
              font_asset_key TEXT
            );
            CREATE TABLE mushaf_lines (
              id INTEGER PRIMARY KEY,
              page_id INTEGER NOT NULL,
              line_number INTEGER NOT NULL,
              line_type TEXT,
              is_centered INTEGER NOT NULL
            );
            CREATE TABLE mushaf_line_items (
              id INTEGER PRIMARY KEY,
              line_id INTEGER NOT NULL,
              item_type TEXT NOT NULL,
              word_id INTEGER,
              surah_id INTEGER,
              ayah_id INTEGER,
              position_in_line INTEGER NOT NULL,
              display_text TEXT,
              source_glyph_code TEXT
            );
            CREATE TABLE roots (id INTEGER PRIMARY KEY, arabic_text TEXT NOT NULL);
            CREATE TABLE lemmas (id INTEGER PRIMARY KEY, arabic_text TEXT NOT NULL);
            CREATE TABLE word_morphology (
              id INTEGER PRIMARY KEY,
              word_id INTEGER NOT NULL,
              segment_number INTEGER NOT NULL,
              segment_arabic TEXT,
              root_id INTEGER,
              lemma_id INTEGER,
              pos TEXT,
              tags TEXT
            );
            CREATE TABLE word_translations (
              id INTEGER PRIMARY KEY,
              word_id INTEGER NOT NULL,
              language_code TEXT NOT NULL,
              translation TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE words_fts USING fts5(
              normalized_search_text,
              content='quran_words',
              content_rowid='id'
            );
            """
        )

        with pg.cursor() as cur:
            cur.execute("SELECT id, name_arabic, name_transliteration, name_translation, revelation_type, ayah_count FROM surahs")
            sq.executemany("INSERT INTO surahs VALUES (?,?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, surah_id, ayah_number, juz_number, hizb_number FROM ayahs")
            sq.executemany("INSERT INTO ayahs VALUES (?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, ayah_id, word_number, arabic_text, normalized_search_text FROM quran_words")
            sq.executemany("INSERT INTO quran_words VALUES (?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, page_number, juz_number, hizb_number, font_asset_key FROM mushaf_pages")
            sq.executemany("INSERT INTO mushaf_pages VALUES (?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, page_id, line_number, line_type, CASE WHEN is_centered THEN 1 ELSE 0 END FROM mushaf_lines")
            sq.executemany("INSERT INTO mushaf_lines VALUES (?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, line_id, item_type, word_id, surah_id, ayah_id, position_in_line, display_text, source_glyph_code FROM mushaf_line_items")
            sq.executemany("INSERT INTO mushaf_line_items VALUES (?,?,?,?,?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, arabic_text FROM roots")
            sq.executemany("INSERT INTO roots VALUES (?,?)", cur.fetchall())

            cur.execute("SELECT id, arabic_text FROM lemmas")
            sq.executemany("INSERT INTO lemmas VALUES (?,?)", cur.fetchall())

            cur.execute("SELECT id, word_id, segment_number, segment_arabic, root_id, lemma_id, pos, morphology_data->>'tags' FROM word_morphology")
            sq.executemany("INSERT INTO word_morphology VALUES (?,?,?,?,?,?,?,?)", cur.fetchall())

            cur.execute("SELECT id, word_id, language_code, translation FROM word_translations")
            sq.executemany("INSERT INTO word_translations VALUES (?,?,?,?)", cur.fetchall())

        sq.executescript(
            """
            INSERT INTO words_fts(words_fts) VALUES ('rebuild');
            CREATE INDEX idx_sq_ayahs_surah ON ayahs (surah_id, ayah_number);
            CREATE INDEX idx_sq_words_ayah ON quran_words (ayah_id, word_number);
            CREATE INDEX idx_sq_lines_page ON mushaf_lines (page_id, line_number);
            CREATE INDEX idx_sq_items_line ON mushaf_line_items (line_id, position_in_line);
            CREATE INDEX idx_sq_morph_word ON word_morphology (word_id, segment_number);
            CREATE INDEX idx_sq_morph_root ON word_morphology (root_id);
            CREATE INDEX idx_sq_tr_word ON word_translations (word_id, language_code);
            """
        )
        sq.commit()

    manifest = {
        "edition": "madinah-hafs-604",
        "version": version,
        "schema_version": 1,
        "file": db_path.name,
        "size_bytes": db_path.stat().st_size,
        "sha256": _sha256(db_path),
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Build offline SQLite bundle")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--out-dir", type=Path, default=Path("reports/bundle"))
    parser.add_argument("--version", default="2026.11.1")
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    manifest = build_bundle(args.database_url, args.out_dir, args.version)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
