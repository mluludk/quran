"""M1 structural, integrity, and linguistic coverage validator."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import psycopg


def validate(database_url: str) -> dict:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            counts = {}
            for tbl in (
                "surahs",
                "ayahs",
                "quran_words",
                "mushaf_pages",
                "mushaf_lines",
                "mushaf_line_items",
                "roots",
                "lemmas",
                "word_morphology",
                "word_translations",
            ):
                cur.execute(f"SELECT count(*) FROM {tbl}")
                counts[tbl] = cur.fetchone()[0]

            cur.execute("SELECT count(DISTINCT word_id) FROM word_translations WHERE language_code = 'id'")
            words_with_translation_id = cur.fetchone()[0]

            cur.execute("SELECT count(DISTINCT word_id) FROM word_morphology")
            words_with_morphology = cur.fetchone()[0]

            cur.execute("SELECT count(DISTINCT word_id) FROM word_morphology WHERE root_id IS NOT NULL")
            words_with_root = cur.fetchone()[0]

            cur.execute("SELECT count(DISTINCT word_id) FROM word_morphology WHERE lemma_id IS NOT NULL")
            words_with_lemma = cur.fetchone()[0]

            cur.execute(
                """
                SELECT count(*) FROM mushaf_line_items
                WHERE item_type = 'word' AND word_id IS NULL
                """
            )
            orphan_word_items = cur.fetchone()[0]

            cur.execute(
                """
                SELECT count(*) FROM quran_words w
                LEFT JOIN mushaf_line_items li ON li.word_id = w.id
                WHERE li.id IS NULL
                """
            )
            unplaced_words = cur.fetchone()[0]

    errors = []
    if counts["surahs"] != 114:
        errors.append(f"Expected 114 surahs, got {counts['surahs']}")
    if counts["ayahs"] != 6236:
        errors.append(f"Expected 6236 ayahs, got {counts['ayahs']}")
    if counts["mushaf_pages"] != 604:
        errors.append(f"Expected 604 pages, got {counts['mushaf_pages']}")
    if orphan_word_items > 0:
        errors.append(f"Found {orphan_word_items} word line items with NULL word_id")
    if unplaced_words > 0:
        errors.append(f"Found {unplaced_words} quran_words not placed on any Mushaf line")

    total_words = counts["quran_words"] or 1
    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "counts": counts,
        "coverage": {
            "words_with_translation_id": words_with_translation_id,
            "translation_id_pct": round(words_with_translation_id * 100 / total_words, 2),
            "words_with_morphology": words_with_morphology,
            "morphology_pct": round(words_with_morphology * 100 / total_words, 2),
            "words_with_root": words_with_root,
            "words_with_lemma": words_with_lemma,
        },
        "integrity": {
            "orphan_word_items": orphan_word_items,
            "unplaced_words": unplaced_words,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate M1 PostgreSQL database")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--out", type=Path, default=Path("reports/m1_validation_report.json"))
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")

    report = validate(args.database_url)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
