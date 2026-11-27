"""Idempotent ETL extractor for Quran Phrase & Sentence Explorer (irab_phrases)."""

from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path

import psycopg

VERB_ROLES = {"PV", "PV_PASS", "IV", "IV_PASS", "CV", "IV_COP", "CV_COP", "UNINFLECTED_VERB"}
CLAUSE_BREAK_ROLES = {"CONJ", "SUBOR_CONJ", "PART_CONDITION", "REL", "REL_PRON"}


def extract_phrases(csv_path: Path, database_url: str) -> dict[str, int]:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM irab_sources WHERE name = 'masaq-v6' AND version = '6'")
            row = cur.fetchone()
            if not row:
                raise RuntimeError("masaq-v6 source not found; run etl.irab_masaq first")
            source_id = row[0]

            cur.execute(
                """
                SELECT w.id, w.ayah_id, a.surah_id, a.ayah_number, w.word_number
                FROM quran_words w
                JOIN ayahs a ON a.id = w.ayah_id
                """
            )
            word_lookup: dict[tuple[int, int, int], tuple[int, int]] = {}
            for wid, aid, sid, anum, wnum in cur.fetchall():
                word_lookup[(sid, anum, wnum)] = (wid, aid)

            cur.execute(
                "SELECT ayah_id, id FROM irab_analyses WHERE source_id = %s AND opinion_label = 'masaq-primary'",
                (source_id,),
            )
            analysis_by_ayah = dict(cur.fetchall())

            # Group MASAQ segments per ayah -> word sequence
            words_by_analysis: dict[int, list[dict]] = {}
            with csv_path.open("r", encoding="utf-8-sig") as fh:
                for r in csv.DictReader(fh):
                    match = word_lookup.get((int(r["Sura_No"]), int(r["Verse_No"]), int(r["Word_No"])))
                    if not match:
                        continue
                    wid, aid = match
                    analysis_id = analysis_by_ayah.get(aid)
                    if not analysis_id:
                        continue
                    roles_list = words_by_analysis.setdefault(analysis_id, [])
                    if not roles_list or roles_list[-1]["word_id"] != wid:
                        roles_list.append(
                            {
                                "word_id": wid,
                                "roles": set(),
                                "morphs": set(),
                                "construct": False,
                                "phrasal_pred": False,
                            }
                        )
                    entry = roles_list[-1]
                    sr = (r.get("Syntactic_Role") or "").strip()
                    mt = (r.get("Morph_Tag") or "").strip()
                    if sr:
                        entry["roles"].add(sr)
                    if mt:
                        entry["morphs"].add(mt)
                    if r.get("Possessive_Construct") == "CONSTRUCT":
                        entry["construct"] = True
                    if r.get("Phrasal_Function") == "PRED":
                        entry["phrasal_pred"] = True

            phrases: list[tuple] = []
            counts_by_type: dict[str, int] = {}

            def add_phrase(
                aid: int,
                ptype: str,
                ar: str,
                lat: str,
                swid: int,
                ewid: int,
                mahal: str | None,
                expl: str,
            ) -> None:
                phrases.append((aid, ptype, ar, lat, swid, ewid, mahal, expl))
                counts_by_type[ptype] = counts_by_type.get(ptype, 0) + 1

            for aid, wlist in words_by_analysis.items():
                n = len(wlist)
                for i, w in enumerate(wlist):
                    roles = w["roles"] | w["morphs"]

                    # 1. Jar-Majrur (PP)
                    if "PREP" in roles:
                        if "PREP_OBJ" in roles:
                            mahal = "في محل رفع خبر" if w["phrasal_pred"] else "متعلق بفعل أو خبر"
                            add_phrase(
                                aid,
                                "jar_majrur",
                                "جار ومجرور",
                                "Jar-Majrur (PP)",
                                w["word_id"],
                                w["word_id"],
                                mahal,
                                "Frasa huruf jar dan isim majrur dalam satu kata (prefiks).",
                            )
                        elif i + 1 < n and "PREP_OBJ" in (wlist[i + 1]["roles"] | wlist[i + 1]["morphs"]):
                            mahal = "في محل رفع خبر" if w["phrasal_pred"] else "متعلق بفعل أو خبر"
                            add_phrase(
                                aid,
                                "jar_majrur",
                                "جار ومجرور",
                                "Jar-Majrur (PP)",
                                w["word_id"],
                                wlist[i + 1]["word_id"],
                                mahal,
                                "Frasa preposisi yang terdiri dari huruf jar dan isim majrur.",
                            )

                    # 2. Idhafah (Construct + Mudhaf Ilaih)
                    if w["construct"] and i + 1 < n and "GEN_CONS" in wlist[i + 1]["roles"]:
                        add_phrase(
                            aid,
                            "idhafah",
                            "إضافة",
                            "Idhafah (NP)",
                            w["word_id"],
                            wlist[i + 1]["word_id"],
                            "حسب موقعه في الجملة",
                            "Susunan penyandaran kata (mudhaf dan mudhaf ilaih).",
                        )

                    # 3. Jumlah Ismiyah (SUBJ -> PRED or phrasal PRED)
                    if "SUBJ" in roles or "SBJ" in roles:
                        for j in range(i + 1, min(n, i + 6)):
                            if "PRED" in wlist[j]["roles"] or wlist[j]["phrasal_pred"]:
                                add_phrase(
                                    aid,
                                    "jumlah_ismiyah",
                                    "جملة اسمية",
                                    "Jumlah Ismiyah (NS)",
                                    w["word_id"],
                                    wlist[j]["word_id"],
                                    "جملة اسمية (مبتدأ + خبر)",
                                    "Klausa nominal yang tersusun dari mubtada' dan khabar.",
                                )
                                break

                    # 4. Jumlah Fi'liyah (Verb -> following arguments)
                    if roles & VERB_ROLES:
                        end_idx = i
                        for j in range(i + 1, min(n, i + 5)):
                            nxt = wlist[j]["roles"]
                            if nxt & CLAUSE_BREAK_ROLES or nxt & VERB_ROLES:
                                break
                            if nxt & {"SUBJ", "PASS_SUBJ", "AGNT", "OBJ", "PREP_OBJ", "ADV_TIME", "ADV_PLCE"}:
                                end_idx = j
                        if end_idx > i:
                            add_phrase(
                                aid,
                                "jumlah_filiyah",
                                "جملة فعلية",
                                "Jumlah Fi'liyah (VS)",
                                w["word_id"],
                                wlist[end_idx]["word_id"],
                                "جملة فعلية (فعل + فاعل/مفعول)",
                                "Klausa verbal yang diawali kata kerja (fi'il) beserta pelaku/objeknya.",
                            )

                    # 5. Shilah Maushul (REL / REL_PRON -> following clause)
                    if roles & {"REL", "REL_PRON"} and i + 1 < n:
                        end_idx = min(n - 1, i + 3)
                        for j in range(i + 1, min(n, i + 5)):
                            if j > i + 1 and (wlist[j]["roles"] & {"CONJ", "PART_CONDITION"}):
                                break
                            end_idx = j
                        add_phrase(
                            aid,
                            "shilah_maushul",
                            "صلة الموصول",
                            "Shilah Maushul",
                            w["word_id"],
                            wlist[end_idx]["word_id"],
                            "لا محل لها من الإعراب",
                            "Klausa penjelas setelah isim maushul (الذي/التي/ما/من).",
                        )

                    # 6. Klausa Syarat (PART_CONDITION -> conditional clause)
                    if "PART_CONDITION" in roles and i + 1 < n:
                        end_idx = min(n - 1, i + 3)
                        for j in range(i + 1, min(n, i + 5)):
                            if j > i + 1 and (wlist[j]["roles"] & {"CONJ", "RES"}):
                                break
                            end_idx = j
                        add_phrase(
                            aid,
                            "klausa_syarat",
                            "جملة الشرط",
                            "Klausa Syarat",
                            w["word_id"],
                            wlist[end_idx]["word_id"],
                            "في محل جزم / جملة شرطية",
                            "Klausa syarat yang diawali partikel syarat (إنْ، إذا، مَنْ، ما).",
                        )

            cur.executemany(
                """
                INSERT INTO irab_phrases
                  (analysis_id, phrase_type, phrase_arabic, phrase_latin, start_word_id, end_word_id, mahal_irab, explanation)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (analysis_id, phrase_type, start_word_id, end_word_id) DO UPDATE
                  SET phrase_arabic = EXCLUDED.phrase_arabic,
                      phrase_latin = EXCLUDED.phrase_latin,
                      mahal_irab = EXCLUDED.mahal_irab,
                      explanation = EXCLUDED.explanation
                """,
                phrases,
            )
            cur.execute("SELECT count(*) FROM irab_phrases")
            total = cur.fetchone()[0]
        conn.commit()

    return {"total_phrases": total, "by_type": counts_by_type}


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract phrase/clause spans into irab_phrases")
    parser.add_argument("--csv-path", type=Path, default=Path("sources/raw/MASAQ.csv"))
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    summary = extract_phrases(args.csv_path, args.database_url)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
