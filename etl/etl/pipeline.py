"""Idempotent M1 ETL pipeline: loads Core, Mushaf Layout, Linguistics & Indonesian WBW."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from pathlib import Path

import psycopg

from etl.normalize import normalize_arabic_search

_AYAH_END_RE = re.compile(r"^[٠-٩]+$")
_ROOT_RE = re.compile(r"ROOT:([^|]+)")
_LEM_RE = re.compile(r"LEM:([^|]+)")


def _register_sources(cur: psycopg.Cursor) -> dict[str, int]:
    sources = [
        ("qpc-v4-mushaf-bundle", "2026-08", "KFQPC (fonts) / QUL derived metadata", "https://github.com/hussainsajib/qpc-v4-mushaf-bundle"),
        ("quran-com-v4-wbw-id", "v4", "Open Islamic data (verify upstream attribution)", "https://api.quran.com/api/v4"),
        ("mustafa0x-quran-morphology", "0.4-fork", "GNU GPL (Quranic Arabic Corpus fork)", "https://github.com/mustafa0x/quran-morphology"),
    ]
    ids: dict[str, int] = {}
    for name, version, lic, url in sources:
        cur.execute(
            """
            INSERT INTO annotation_sources (name, version, license_reference, source_url)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (name, version) DO UPDATE
              SET license_reference = EXCLUDED.license_reference,
                  source_url = EXCLUDED.source_url
            RETURNING id
            """,
            (name, version, lic, url),
        )
        ids[name] = cur.fetchone()[0]
    return ids


def run_etl(raw_dir: Path, database_url: str) -> dict[str, int]:
    chapters = json.loads((raw_dir / "chapters_id.json").read_text(encoding="utf-8"))["chapters"]

    # Read WBW pages JSONL: extract ayah juz/hizb & word Indonesian translations
    ayah_meta: dict[tuple[int, int], tuple[int | None, int | None]] = {}
    wbw_translations: dict[str, str] = {}
    with (raw_dir / "wbw_id_pages.jsonl").open("r", encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            for verse in rec["payload"].get("verses", []):
                s_id, a_num = map(int, verse["verse_key"].split(":"))
                ayah_meta[(s_id, a_num)] = (verse.get("juz_number"), verse.get("hizb_number"))
                for w in verse.get("words", []):
                    loc = w.get("location")
                    if loc and w.get("char_type_name") == "word":
                        tr = (w.get("translation") or {}).get("text")
                        if tr:
                            wbw_translations[loc] = tr

    # Read words.csv
    word_rows: list[dict] = []
    with (raw_dir / "words.csv").open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            word_rows.append(
                {
                    "id": int(row["id"]),
                    "location": row["location"],
                    "surah": int(row["surah"]),
                    "ayah": int(row["ayah"]),
                    "word": int(row["word"]),
                    "text": row["text"],
                    "is_end": bool(_AYAH_END_RE.fullmatch(row["text"])),
                }
            )
    word_by_id = {r["id"]: r for r in word_rows}

    # Read qpc_mapping.csv
    glyph_by_word: dict[int, str] = {}
    with (raw_dir / "qpc_mapping.csv").open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            wid = int(row["word_id"])
            code = row["code"].strip()
            glyph_by_word[wid] = f"{glyph_by_word[wid]} {code}".strip() if wid in glyph_by_word else code

    # Read page_lines.csv
    page_lines: list[dict] = []
    with (raw_dir / "page_lines.csv").open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            page_lines.append(
                {
                    "page": int(row["page_number"]),
                    "line": int(row["line_number"]),
                    "line_type": row["line_type"],
                    "is_centered": row["is_centered"] == "1",
                    "first_word_id": int(row["first_word_id"]) if row["first_word_id"] else None,
                    "last_word_id": int(row["last_word_id"]) if row["last_word_id"] else None,
                    "surah_number": int(row["surah_number"]) if row["surah_number"] else None,
                }
            )

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            src_ids = _register_sources(cur)

            # 1. Surahs
            cur.executemany(
                """
                INSERT INTO surahs (id, name_arabic, name_transliteration, name_translation, revelation_type, ayah_count)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                  SET name_arabic = EXCLUDED.name_arabic,
                      name_transliteration = EXCLUDED.name_transliteration,
                      name_translation = EXCLUDED.name_translation,
                      revelation_type = EXCLUDED.revelation_type,
                      ayah_count = EXCLUDED.ayah_count
                """,
                [
                    (
                        ch["id"],
                        ch["name_arabic"],
                        ch.get("name_simple"),
                        (ch.get("translated_name") or {}).get("name"),
                        ch.get("revelation_place"),
                        ch["verses_count"],
                    )
                    for ch in chapters
                ],
            )

            # 2. Ayahs (ordered deterministically)
            ayah_keys = sorted({(r["surah"], r["ayah"]) for r in word_rows})
            ayah_id_map: dict[tuple[int, int], int] = {}
            ayah_params = []
            for idx, (s_id, a_num) in enumerate(ayah_keys, start=1):
                ayah_id_map[(s_id, a_num)] = idx
                juz, hizb = ayah_meta.get((s_id, a_num), (None, None))
                ayah_params.append((idx, s_id, a_num, juz, hizb))

            cur.executemany(
                """
                INSERT INTO ayahs (id, surah_id, ayah_number, juz_number, hizb_number)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                  SET juz_number = EXCLUDED.juz_number,
                      hizb_number = EXCLUDED.hizb_number
                """,
                ayah_params,
            )

            # 3. Quran words (exclude ayah-end markers from quran_words)
            quran_word_params = []
            loc_to_word_id: dict[str, int] = {}
            crosswalk_params = []
            for r in word_rows:
                if r["is_end"]:
                    continue
                aid = ayah_id_map[(r["surah"], r["ayah"])]
                loc_to_word_id[r["location"]] = r["id"]
                quran_word_params.append(
                    (
                        r["id"],
                        aid,
                        r["word"],
                        r["text"],
                        normalize_arabic_search(r["text"]),
                    )
                )
                crosswalk_params.append(
                    (src_ids["qpc-v4-mushaf-bundle"], "word", r["location"], r["id"])
                )

            cur.executemany(
                """
                INSERT INTO quran_words (id, ayah_id, word_number, arabic_text, normalized_search_text)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                  SET arabic_text = EXCLUDED.arabic_text,
                      normalized_search_text = EXCLUDED.normalized_search_text
                """,
                quran_word_params,
            )

            cur.executemany(
                """
                INSERT INTO source_crosswalks (source_id, entity_type, source_key, internal_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (source_id, entity_type, source_key) DO UPDATE
                  SET internal_id = EXCLUDED.internal_id
                """,
                crosswalk_params,
            )

            # 4. Mushaf Edition, Pages, Lines, Line Items
            cur.execute(
                """
                INSERT INTO mushaf_editions (code, name, riwayah, page_count, target_lines_per_page, source_version)
                VALUES ('madinah-hafs-604', 'Mushaf Madinah (Hafs)', 'hafs', 604, 15, 'qpc-v4-2026-08')
                ON CONFLICT (code) DO UPDATE
                  SET source_version = EXCLUDED.source_version
                RETURNING id
                """
            )
            edition_id = cur.fetchone()[0]

            # Derive juz/hizb per page from first word on page
            page_first_ayah: dict[int, tuple[int, int]] = {}
            for pl in page_lines:
                if pl["page"] not in page_first_ayah and pl["first_word_id"]:
                    w = word_by_id[pl["first_word_id"]]
                    page_first_ayah[pl["page"]] = (w["surah"], w["ayah"])

            page_id_map: dict[int, int] = {}
            for p in range(1, 605):
                juz, hizb = ayah_meta.get(page_first_ayah.get(p, (1, 1)), (None, None))
                cur.execute(
                    """
                    INSERT INTO mushaf_pages (edition_id, page_number, juz_number, hizb_number, font_asset_key)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (edition_id, page_number) DO UPDATE
                      SET juz_number = EXCLUDED.juz_number,
                          hizb_number = EXCLUDED.hizb_number,
                          font_asset_key = EXCLUDED.font_asset_key
                    RETURNING id
                    """,
                    (edition_id, p, juz, hizb, f"p{p}"),
                )
                page_id_map[p] = cur.fetchone()[0]

            line_id_map: dict[tuple[int, int], int] = {}
            for pl in page_lines:
                cur.execute(
                    """
                    INSERT INTO mushaf_lines (page_id, line_number, line_type, is_centered)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (page_id, line_number) DO UPDATE
                      SET line_type = EXCLUDED.line_type,
                          is_centered = EXCLUDED.is_centered
                    RETURNING id
                    """,
                    (page_id_map[pl["page"]], pl["line"], pl["line_type"], pl["is_centered"]),
                )
                line_id_map[(pl["page"], pl["line"])] = cur.fetchone()[0]

            line_item_params = []
            for pl in page_lines:
                lid = line_id_map[(pl["page"], pl["line"])]
                if pl["line_type"] == "surah_name":
                    s_num = pl["surah_number"]
                    line_item_params.append(
                        (lid, "surah_header", None, s_num, None, 1, None, f"57344 {57344 + s_num}")
                    )
                elif pl["line_type"] == "basmallah":
                    line_item_params.append(
                        (lid, "basmala", None, None, None, 1, "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "63709")
                    )
                elif pl["first_word_id"] and pl["last_word_id"]:
                    pos = 1
                    for wid in range(pl["first_word_id"], pl["last_word_id"] + 1):
                        w = word_by_id[wid]
                        aid = ayah_id_map[(w["surah"], w["ayah"])]
                        if w["is_end"]:
                            line_item_params.append(
                                (lid, "ayah_end", None, w["surah"], aid, pos, w["text"], glyph_by_word.get(wid))
                            )
                        else:
                            line_item_params.append(
                                (lid, "word", wid, w["surah"], aid, pos, w["text"], glyph_by_word.get(wid))
                            )
                        pos += 1

            cur.executemany(
                """
                INSERT INTO mushaf_line_items
                  (line_id, item_type, word_id, surah_id, ayah_id, position_in_line, display_text, source_glyph_code)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (line_id, position_in_line) DO UPDATE
                  SET item_type = EXCLUDED.item_type,
                      word_id = EXCLUDED.word_id,
                      surah_id = EXCLUDED.surah_id,
                      ayah_id = EXCLUDED.ayah_id,
                      display_text = EXCLUDED.display_text,
                      source_glyph_code = EXCLUDED.source_glyph_code
                """,
                line_item_params,
            )

            # 5. Word translations (Indonesian)
            wbw_src_id = src_ids["quran-com-v4-wbw-id"]
            tr_params = [
                (loc_to_word_id[loc], "id", text, wbw_src_id)
                for loc, text in wbw_translations.items()
                if loc in loc_to_word_id
            ]
            cur.executemany(
                """
                INSERT INTO word_translations (word_id, language_code, translation, source_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (word_id, language_code, source_id) DO UPDATE
                  SET translation = EXCLUDED.translation
                """,
                tr_params,
            )

            # 6. Roots, Lemmas, Word Morphology (per segment)
            morph_src_id = src_ids["mustafa0x-quran-morphology"]
            morph_rows = []
            roots_set: set[str] = set()
            lemmas_set: set[str] = set()
            with (raw_dir / "quran-morphology.txt").open("r", encoding="utf-8") as fh:
                for line in fh:
                    if not line.strip():
                        continue
                    parts = line.rstrip("\n").split("\t")
                    if len(parts) < 4:
                        continue
                    seg_loc, seg_ar, pos, tags = parts[0], parts[1], parts[2], parts[3]
                    loc = ":".join(seg_loc.split(":")[:3])
                    wid = loc_to_word_id.get(loc)
                    if wid is None:
                        continue
                    seg_num = int(seg_loc.split(":")[3])
                    rm = _ROOT_RE.search(tags)
                    lm = _LEM_RE.search(tags)
                    root_txt = rm.group(1) if rm else None
                    lem_txt = lm.group(1) if lm else None
                    if root_txt:
                        roots_set.add(root_txt)
                    if lem_txt:
                        lemmas_set.add(lem_txt)
                    morph_rows.append((wid, seg_num, seg_ar, root_txt, lem_txt, pos, tags))

            cur.executemany(
                "INSERT INTO roots (arabic_text) VALUES (%s) ON CONFLICT (arabic_text) DO NOTHING",
                [(r,) for r in sorted(roots_set)],
            )
            cur.executemany(
                "INSERT INTO lemmas (arabic_text) VALUES (%s) ON CONFLICT (arabic_text) DO NOTHING",
                [(l,) for l in sorted(lemmas_set)],
            )

            cur.execute("SELECT arabic_text, id FROM roots")
            root_id_map = dict(cur.fetchall())
            cur.execute("SELECT arabic_text, id FROM lemmas")
            lemma_id_map = dict(cur.fetchall())

            cur.executemany(
                """
                INSERT INTO word_morphology
                  (word_id, segment_number, segment_arabic, root_id, lemma_id, pos, morphology_data, source_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (word_id, segment_number, source_id) DO UPDATE
                  SET segment_arabic = EXCLUDED.segment_arabic,
                      root_id = EXCLUDED.root_id,
                      lemma_id = EXCLUDED.lemma_id,
                      pos = EXCLUDED.pos,
                      morphology_data = EXCLUDED.morphology_data
                """,
                [
                    (
                        wid,
                        seg_num,
                        seg_ar,
                        root_id_map.get(r_txt) if r_txt else None,
                        lemma_id_map.get(l_txt) if l_txt else None,
                        pos,
                        json.dumps({"tags": tags}),
                        morph_src_id,
                    )
                    for wid, seg_num, seg_ar, r_txt, l_txt, pos, tags in morph_rows
                ],
            )

        conn.commit()

    return {
        "surahs": len(chapters),
        "ayahs": len(ayah_params),
        "quran_words": len(quran_word_params),
        "mushaf_pages": 604,
        "mushaf_lines": len(page_lines),
        "mushaf_line_items": len(line_item_params),
        "word_translations_id": len(tr_params),
        "morphology_segments": len(morph_rows),
        "roots": len(roots_set),
        "lemmas": len(lemmas_set),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run M1 PostgreSQL ETL")
    parser.add_argument("--raw-dir", type=Path, default=Path("sources/raw"))
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    summary = run_etl(args.raw_dir, args.database_url)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
