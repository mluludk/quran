"""Idempotent ETL loader for MASAQ v6 into 002_irab_schema.sql."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
from pathlib import Path

import psycopg

MASAQ_META_URL = "https://data.mendeley.com/public-api/datasets/9yvrzxktmr"

ROLE_ARABIC_MAP = {
    "PREP": "حرف جر",
    "PREP_OBJ": "اسم مجرور",
    "GEN_CONS": "مضاف إليه",
    "ADJ": "نعت / صفة",
    "PRED": "خبر",
    "SBJ": "مبتدأ / فاعل",
    "SUBJ": "فاعل",
    "OBJ": "مفعول به",
    "CONJ": "معطوف / عطف",
    "VOC": "منادى",
    "ADV": "ظرف / حال",
    "CIRC": "حال",
    "COND": "شرط",
    "RES": "جواب / استئناف",
    "SPEC": "تمييز",
    "EXP": "مستثنى",
    "REL": "صلة الموصول",
    "APP": "بدل",
    "EMPH": "توكيد",
    "NEG": "نفي",
}

CASE_STATUS_MAP = {
    "NOMINATIVE": "marfu'",
    "ACCUSATIVE": "mansub",
    "GENITIVE": "majrur",
    "JUSSIVE": "majzum",
    "INVARIABLE": "mabni",
}

SIGN_ARABIC_MAP = {
    "DAMMA": "الضمة",
    "FATHA": "الفتحة",
    "KASRA": "الكسرة",
    "SUKUN": "السكون",
    "WAW": "الواو",
    "YA": "الياء",
    "ALIF": "الألف",
    "NUN": "ثبوت النون",
    "NO_NUN": "حذف النون",
}


def download_masaq_csv(dest: Path, force: bool = False) -> None:
    if dest.exists() and not force:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    meta_raw = subprocess.check_output(["curl", "-sL", MASAQ_META_URL]).decode("utf-8")
    meta = json.loads(meta_raw)
    url = None
    for f in meta.get("files", []):
        if f.get("filename") == "MASAQ.csv":
            url = (f.get("content_details") or {}).get("download_url")
            break
    if not url:
        raise RuntimeError("Could not locate MASAQ.csv download_url in Mendeley API")
    subprocess.check_call(["curl", "-sL", url, "-o", str(dest)])


def run_masaq_etl(csv_path: Path, database_url: str) -> dict[str, int]:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # 1. Register MASAQ source
            cur.execute(
                """
                INSERT INTO irab_sources (name, author, edition, version, license_reference, source_url)
                VALUES (
                  'masaq-v6',
                  'Majdi Sawalha et al.',
                  'MASAQ: Morphologically-Analyzed and Syntactically-Annotated Quran Dataset',
                  '6',
                  'Creative Commons (DOI 10.17632/9yvrzxktmr.6)',
                  'https://data.mendeley.com/datasets/9yvrzxktmr'
                )
                ON CONFLICT (name, version) DO UPDATE
                  SET license_reference = EXCLUDED.license_reference,
                      source_url = EXCLUDED.source_url
                RETURNING id
                """
            )
            source_id = cur.fetchone()[0]

            # 2. Load lookup maps from DB
            cur.execute(
                """
                SELECT w.id, w.ayah_id, a.surah_id, a.ayah_number, w.word_number
                FROM quran_words w
                JOIN ayahs a ON a.id = w.ayah_id
                """
            )
            word_lookup: dict[tuple[int, int, int], tuple[int, int]] = {}
            ayah_ids: set[int] = set()
            for wid, aid, sid, anum, wnum in cur.fetchall():
                word_lookup[(sid, anum, wnum)] = (wid, aid)
                ayah_ids.add(aid)

            # 3. Create irab_analyses for all ayahs
            cur.executemany(
                """
                INSERT INTO irab_analyses (ayah_id, source_id, opinion_label, summary)
                VALUES (%s, %s, 'masaq-primary', 'MASAQ v6 traditional syntactic role & case-mood annotation')
                ON CONFLICT (ayah_id, source_id, opinion_label) DO NOTHING
                """,
                [(aid, source_id) for aid in sorted(ayah_ids)],
            )
            cur.execute(
                "SELECT ayah_id, id FROM irab_analyses WHERE source_id = %s AND opinion_label = 'masaq-primary'",
                (source_id,),
            )
            analysis_by_ayah = dict(cur.fetchall())

            # 4. Parse MASAQ.csv and insert irab_word_nodes
            nodes: list[tuple] = []
            seq_by_analysis: dict[int, int] = {}
            skipped = 0
            with csv_path.open("r", encoding="utf-8-sig") as fh:
                for row in csv.DictReader(fh):
                    sura = int(row["Sura_No"])
                    verse = int(row["Verse_No"])
                    word_no = int(row["Word_No"])
                    seg_no = int(row["Segment_No"])
                    match = word_lookup.get((sura, verse, word_no))
                    if not match:
                        skipped += 1
                        continue
                    wid, aid = match
                    analysis_id = analysis_by_ayah[aid]
                    seq = seq_by_analysis.get(analysis_id, 0) + 1
                    seq_by_analysis[analysis_id] = seq

                    syn_role = (row.get("Syntactic_Role") or "").strip()
                    morph_tag = (row.get("Morph_Tag") or "").strip()
                    role_key = syn_role or morph_tag or "TOKEN"
                    role_arabic = ROLE_ARABIC_MAP.get(role_key, role_key)
                    case_mood = (row.get("Case_Mood") or "").strip()
                    case_marker = (row.get("Case_Mood_Marker") or "").strip()
                    irab_status = CASE_STATUS_MAP.get(case_mood, case_mood.lower() if case_mood else None)
                    irab_sign = SIGN_ARABIC_MAP.get(case_marker, case_marker or None)

                    notes = []
                    if row.get("Segmented_Word"):
                        notes.append(f"Segmen: {row['Segmented_Word']}")
                    if row.get("Invariable_Declinable"):
                        notes.append(f"Declinability: {row['Invariable_Declinable']}")
                    if row.get("Possessive_Construct") and row["Possessive_Construct"] != "NOT_CONSTRUCT":
                        notes.append(f"Construct: {row['Possessive_Construct']}")
                    if row.get("Phrasal_Function"):
                        notes.append(f"Phrasal: {row['Phrasal_Function']}")

                    nodes.append(
                        (
                            analysis_id,
                            wid,
                            seg_no,
                            seq,
                            role_arabic,
                            role_key,
                            irab_status,
                            irab_sign,
                            None,
                            " | ".join(notes) if notes else None,
                        )
                    )

            cur.executemany(
                """
                INSERT INTO irab_word_nodes
                  (analysis_id, word_id, segment_number, sequence_order, role_arabic, role_latin, irab_status, irab_sign, amil, explanation)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (analysis_id, word_id, segment_number) DO UPDATE
                  SET sequence_order = EXCLUDED.sequence_order,
                      role_arabic = EXCLUDED.role_arabic,
                      role_latin = EXCLUDED.role_latin,
                      irab_status = EXCLUDED.irab_status,
                      irab_sign = EXCLUDED.irab_sign,
                      explanation = EXCLUDED.explanation
                """,
                nodes,
            )

            cur.execute("SELECT count(DISTINCT word_id) FROM irab_word_nodes")
            covered_words = cur.fetchone()[0]

        conn.commit()

    return {
        "irab_analyses": len(analysis_by_ayah),
        "irab_word_nodes": len(nodes),
        "covered_words": covered_words,
        "skipped_rows": skipped,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Download and import MASAQ v6 into PostgreSQL")
    parser.add_argument("--csv-path", type=Path, default=Path("sources/raw/MASAQ.csv"))
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--force-download", action="store_true")
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")

    download_masaq_csv(args.csv_path, force=args.force_download)
    summary = run_masaq_etl(args.csv_path, args.database_url)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
