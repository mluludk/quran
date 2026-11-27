"""Idempotent ETL loader for MASAQ v6 into 002_irab_schema.sql (nodes + intra-ayah relations)."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
from pathlib import Path

import psycopg

MASAQ_META_URL = "https://data.mendeley.com/public-api/datasets/9yvrzxktmr"

# (role_arabic, role_latin, indonesian_explanation)
ROLE_INFO_MAP: dict[str, tuple[str, str, str]] = {
    "PREP": ("حرف جر", "Harf Jar", "Huruf jar yang menjarkan isim setelahnya."),
    "PREP_OBJ": ("اسم مجرور", "Ism Majrur", "Isim yang berstatus jar karena didahului huruf jar."),
    "GEN_CONS": ("مضاف إليه", "Mudhaf Ilaih", "Isim yang disandarkan kepada mudhaf (susunan idhafah)."),
    "ADJ": ("نعت / صفة", "Na'at", "Kata sifat yang mengikuti i‘rab kata sebelumnya."),
    "PRED": ("خبر", "Khabar", "Predikat yang menyempurnakan makna mubtada'."),
    "SUBJ": ("مبتدأ / فاعل", "Mubtada' / Fa'il", "Subjek kalimat (pokok kalimat nominal atau pelaku fi'il)."),
    "SBJ": ("مبتدأ / فاعل", "Mubtada' / Fa'il", "Subjek kalimat."),
    "OBJ": ("مفعول به", "Maf'ul Bih", "Objek penderita yang dikenai pekerjaan fi'il."),
    "AGNT": ("فاعل / ضمير متصل", "Fa'il / Dhamir", "Pelaku (fa'il) atau kata ganti yang terhubung dengan kata kerja/isim."),
    "CONJ": ("حرف عطف", "Harf 'Athf", "Huruf penghubung (athaf) antar kata atau klausa."),
    "CONJ_N": ("معطوف", "Ma'thuf", "Kata yang dihubungkan dengan huruf athaf dan mengikuti i‘rab kata sebelumnya."),
    "IV": ("فعل مضارع", "Fi'il Mudhari'", "Kata kerja bentuk sedang/akan datang."),
    "IV_PASS": ("فعل مضارع مبني للمجهول", "Fi'il Mudhari' Majhul", "Kata kerja mudhari' bentuk pasif."),
    "IV_COP": ("فعل مضارع ناقص", "Fi'il Naqish", "Kata kerja mudhari' dari kelompok kana dan saudarinya."),
    "CV": ("فعل أمر", "Fi'il Amr", "Kata kerja perintah (mabni)."),
    "CV_PREF": ("سابقة أمر", "Sabikah Amr", "Huruf awalan pada kata kerja perintah."),
    "PV": ("فعل ماض", "Fi'il Madhi", "Kata kerja bentuk lampau (mabni)."),
    "NON_INFLECT": ("كلمة مبنية", "Mabni", "Kata yang harakat akhirnya tetap (tidak berubah oleh amil)."),
    "PASS_SUBJ": ("نائب فاعل", "Na'ibul Fa'il", "Pengganti pelaku pada kalimat pasif (majhul)."),
    "SUBJ_COP_PART": ("اسم إنّ / ناسخ", "Ism Inna", "Isim yang dinashabkan oleh partikel penegas/nasikh (inna dkk.)."),
    "PART_COP_PRED": ("خبر إنّ / ناسخ", "Khabar Inna", "Khabar yang dirafa'kan untuk partikel nasikh (inna dkk.)."),
    "SUBJ_COP_V": ("اسم كان", "Ism Kana", "Isim yang dirafa'kan oleh fi'il naqish (kana dkk.)."),
    "V_COP_PRED": ("خبر كان", "Khabar Kana", "Khabar yang dinashabkan oleh fi'il naqish (kana dkk.)."),
    "ANNUL_PART": ("حرف ناسخ", "Harf Nasikh", "Huruf yang mengubah hukum mubtada' dan khabar (seperti إنّ)."),
    "ADV_TIME": ("ظرف زمان", "Zharaf Zaman", "Keterangan waktu (mansub)."),
    "ADV_PLCE": ("ظرف مكان", "Zharaf Makan", "Keterangan tempat (mansub)."),
    "CIRCUM": ("حال", "Hal", "Keterangan keadaan pelaku atau objek saat peristiwa terjadi."),
    "APPOS": ("بدل", "Badal", "Pengganti/penjelas yang mengikuti i‘rab kata sebelumnya."),
    "COGN": ("مفعول مطلق", "Maf'ul Muthlaq", "Mashdar penegas atau penjelas jenis/jumlah perbuatan."),
    "ACC_SPECIF": ("تمييز", "Tamyiz", "Isim nakirah penjelas kesamaran kata/bilangan sebelumnya."),
    "VOC": ("منادى", "Munada", "Kata yang dipanggil setelah huruf nida'."),
    "VOC_PART": ("حرف نداء", "Harf Nida'", "Huruf panggilan (seperti يا)."),
    "PART_CONDITION": ("أداة شرط", "Adat Syarth", "Kata/huruf syarat dalam kalimat kondisional."),
    "PART_JUSSIVE": ("حرف جزم", "Harf Jazm", "Huruf yang menjazamkan fi'il mudhari'."),
    "PART_INTERROG": ("حرف استفهام", "Harf Istifham", "Kata/huruf tanya."),
    "SUBJUNC_PART": ("حرف نصب", "Harf Nashb", "Huruf yang menashabkan fi'il mudhari' (seperti أنْ، لَنْ)."),
    "SUBOR_CONJ": ("حرف مصدري / ربط", "Harf Mashdari", "Huruf penghubung anak kalimat."),
    "SUBOR_ANN_CONJ": ("حرف مصدري ناسخ", "Harf Mashdari Nasikh", "Huruf penghubung sekaligus nasikh (seperti أنّ)."),
    "CERT_PART": ("حرف تحقيق", "Harf Tahqiq", "Huruf penegas kepastian (seperti قَدْ / لَقَدْ)."),
    "DET": ("أل التعريف", "Al-Ta'rif", "Awalan penentu (ma'rifah)."),
    "EMPH": ("توكيد", "Taukid", "Unsur penegas makna."),
    "EXCP": ("مستثنى", "Mustatsna", "Kata yang dikecualikan setelah adat istitsna'."),
    "PART_EXCEPT": ("أداة استثناء", "Adat Istitsna'", "Partikel pengecualian (seperti إلا)."),
    "NEG_CAT": ("خبر لا النافية للجنس", "La Nafiyah lil-Jins", "Unsur negasi jenis."),
    "SUBJ_NEG_CAT": ("اسم لا النافية للجنس", "Ism La", "Isim dari la nafiyah lil-jins."),
    "SUBJ_DELA": ("اسم مؤخر / مبتدأ مؤخر", "Mubtada' Mu'akhkhar", "Subjek yang diletakkan setelah khabar."),
    "COMPL": ("مكمل / متعلق", "Muta'alliq", "Unsur pelengkap frasa atau klausa."),
    "EXPLET": ("حرف زائدة / صلة", "Harf Shilah", "Huruf tambahan untuk penguatan atau keindahan bahasa."),
    "PART_PREV": ("كافة", "Kaffah", "Partikel pencegah amal huruf sebelumnya."),
    "REL": ("اسم موصول", "Ism Maushul", "Kata sambung (yang)."),
    "DEM": ("اسم إشارة", "Ism Isyarah", "Kata tunjuk."),
    "IMPERF_PREF": ("سابقة المضارعة", "Huruf Mudhara'ah", "Huruf awalan fi'il mudhari' (أ، ن، ي، ت)."),
    "NSUFF_FEM_SG": ("تاء التأنيث المربوطة", "Akhiran Muannats", "Penanda isim muannats (perempuan) tunggal."),
    "NSUFF_FEM_PL": ("علامة جمع المؤنث السالم", "Akhiran Jamak Muannats", "Penanda jamak muannats salim (ات)."),
    "PV_PASS": ("فعل ماض مبني للمجهول", "Fi'il Madhi Majhul", "Kata kerja lampau bentuk pasif."),
    "UNINFLECTED_VERB": ("فعل جامد", "Fi'il Jamid", "Kata kerja yang tidak berubah bentuk (jamid)."),
    "NEG_MAA": ("ما النافية", "Ma Nafiyah", "Partikel negasi (tidak)."),
    "NEG_PART": ("حرف نفي", "Harf Nafi", "Partikel negasi / penyangkalan."),
    "NEG": ("حرف نفي", "Harf Nafi", "Partikel negasi / penyangkalan."),
    "INTENCIF": ("لام التوكيد", "Lam Taukid", "Huruf lam penegas makna."),
    "RELATIVE_YA": ("ياء النسب", "Ya' Nisbah", "Huruf ya' penanda nisbah / keterkaitan."),
    "PURP": ("لام التعليل", "Lam Ta'lil", "Huruf lam yang menyatakan tujuan/sebab."),
    "POSS_PRON": ("ضمير متصل (مضاف إليه)", "Dhamir Mudhaf Ilaih", "Kata ganti kepemilikan yang disandarkan pada isim."),
    "EMPHATIC_NUN": ("نون التوكيد", "Nun Taukid", "Huruf nun penegas pada kata kerja."),
    "SUBJ_PRON": ("ضمير متصل (فاعل)", "Dhamir Fa'il", "Kata ganti bersambung sebagai pelaku."),
    "OBJ_PRON": ("ضمير متصل (مفعول به)", "Dhamir Maf'ul Bih", "Kata ganti bersambung sebagai objek."),
    "SUFF_FEM_TA": ("تاء التأنيث الساكنة", "Ta' Ta'nits", "Huruf ta' penanda subjek muannats pada fi'il madhi."),
    "GERUND": ("مصدر", "Mashdar", "Kata benda bentukan dari kata kerja (verbal noun)."),
    "REL_PRON": ("اسم موصول", "Ism Maushul", "Kata sambung (yang)."),
    "CV_COP": ("فعل أمر ناقص", "Fi'il Amr Naqish", "Kata kerja perintah dari kelompok kana."),
    "ACRON": ("حروف مقطعة", "Huruf Muqaththa'ah", "Huruf pembuka surah."),
    "PROTECT_NUN": ("نون الوقاية", "Nun Wiqayah", "Huruf nun pelindung sebelum ya' mutakallim."),
    "SUBS_COG_ACC": ("نائب عن المفعول المطلق", "Na'ib 'anil Maf'ul Muthlaq", "Pengganti maf'ul muthlaq."),
    "COMIT": ("واو المعية", "Waw Ma'iyyah", "Huruf waw yang bermakna kebersamaan."),
    "INTERJ_CV": ("اسم فعل أمر", "Ism Fi'il Amr", "Isim yang bermakna kata kerja perintah."),
    "INTERJ_PV": ("اسم فعل ماض", "Ism Fi'il Madhi", "Isim yang bermakna kata kerja lampau."),
    "INTERROG_PART": ("حرف استفهام", "Harf Istifham", "Kata/huruf tanya."),
    "PRON": ("ضمير", "Dhamir", "Kata ganti."),
    "None": ("جزء صرفي", "Unsur Morfem", "Bagian/imbuhan kata dalam struktur bahasa Arab."),
    "OTHER": ("جزء صرفي", "Unsur Morfem", "Bagian/imbuhan kata dalam struktur bahasa Arab."),
    "PART": ("حرف", "Harf", "Partikel / huruf."),
    "SUFF": ("لاحقة صرفية", "Akhiran Kata", "Akhiran morfem pada kata."),
}


def resolve_role_info(role_key: str) -> tuple[str, str, str]:
    if role_key in ROLE_INFO_MAP:
        return ROLE_INFO_MAP[role_key]
    if role_key.startswith("NSUFF_MASC_PL"):
        return ("علامة جمع المذكر السالم", "Akhiran Jamak Mudzakkar", "Penanda jamak mudzakkar salim (ون / ين).")
    if role_key.startswith(("NSUFF_MASC_DU", "NSUFF_FEM_DU")):
        return ("علامة المثنى", "Akhiran Mutsanna", "Penanda bentuk ganda / dual (ان / ين).")
    if role_key.startswith("CASE_"):
        return ("علامة إعراب / تنوين", "Tanda I‘rab / Tanwin", "Akhiran penanda harakat kasus atau tanwin pada isim.")
    if role_key.startswith("PVSUFF_SUBJ"):
        return ("ضمير متصل (فاعل)", "Dhamir Fa'il", "Kata ganti bersambung sebagai pelaku pada fi'il madhi.")
    if role_key.startswith("IV") and len(role_key) <= 6:
        return ("سابقة المضارعة", "Huruf Mudhara'ah", "Awalan penanda subjek pada fi'il mudhari'.")
    if role_key.startswith("NOUN"):
        return ("اسم", "Isim", "Kata benda (isim).")
    if role_key.startswith("ADJ"):
        return ("نعت / صفة", "Na'at / Shifah", "Kata sifat.")
    return ("عنصر نحوي", role_key, "")

CASE_STATUS_MAP = {
    "NOMINATIVE": "marfu'",
    "ACCUSATIVE": "mansub",
    "GENITIVE": "majrur",
    "JUSSIVE": "majzum",
    "INVARIABLE": "mabni",
}

SIGN_ARABIC_MAP = {
    "DHAMMA": "الضمة الظاهرة",
    "DAMMA": "الضمة الظاهرة",
    "IMP_DHAMMA": "الضمة المقدرة",
    "FATHA": "الفتحة الظاهرة",
    "IMP_FATHA": "الفتحة المقدرة",
    "FATHA_DIPTOTE": "الفتحة نيابة عن الكسرة",
    "KASRA": "الكسرة الظاهرة",
    "IMP_KASRA": "الكسرة المقدرة",
    "SUKUN": "السكون",
    "WAW": "الواو",
    "YAA": "الياء",
    "YA": "الياء",
    "ALIF": "الألف",
    "NUN": "ثبوت النون",
    "DEL_NUN": "حذف النون",
    "DEL_VOWEL": "حذف حرف العلة",
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

            nodes: list[tuple] = []
            node_meta_by_analysis: dict[int, list[dict]] = {}
            seq_by_analysis: dict[int, int] = {}
            last_verb_by_analysis: dict[int, str] = {}
            last_prep_by_analysis: dict[int, str] = {}
            last_construct_by_analysis: dict[int, str] = {}
            last_nasikh_by_analysis: dict[int, str] = {}
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
                    word_surface = (row.get("Word") or row.get("Segmented_Word") or "").strip()

                    # Split SUBJ/SBJ into Mubtada' vs Fa'il based on preceding verb in clause
                    if role_key in ("SUBJ", "SBJ"):
                        if analysis_id in last_verb_by_analysis:
                            role_arabic, role_latin, base_expl = (
                                "فاعل",
                                "Fa'il",
                                "Pelaku (fa'il) yang melakukan perbuatan dari fi'il sebelumnya.",
                            )
                        else:
                            role_arabic, role_latin, base_expl = (
                                "مبتدأ",
                                "Mubtada'",
                                "Isim di awal kalimat nominal yang menjadi pokok pembicaraan (mubtada').",
                            )
                    else:
                        role_arabic, role_latin, base_expl = resolve_role_info(role_key)

                    case_mood = (row.get("Case_Mood") or "").strip()
                    case_marker = (row.get("Case_Mood_Marker") or "").strip()
                    irab_status = CASE_STATUS_MAP.get(case_mood, case_mood.lower() if case_mood else None)
                    irab_sign = SIGN_ARABIC_MAP.get(case_marker, case_marker or None)

                    # Derive Amil & track clause context
                    amil_txt: str | None = None
                    if role_key == "PREP":
                        last_prep_by_analysis[analysis_id] = word_surface
                    elif role_key in ("PV", "PV_PASS", "IV", "IV_PASS", "CV", "IV_COP", "CV_COP", "UNINFLECTED_VERB"):
                        last_verb_by_analysis[analysis_id] = word_surface
                        if role_key in ("IV_COP", "CV_COP"):
                            last_nasikh_by_analysis[analysis_id] = word_surface
                    elif role_key == "ANNUL_PART":
                        last_nasikh_by_analysis[analysis_id] = word_surface
                    elif role_key in ("CONJ", "SUBOR_CONJ", "PART_CONDITION"):
                        last_verb_by_analysis.pop(analysis_id, None)

                    if role_key == "PREP_OBJ" and analysis_id in last_prep_by_analysis:
                        amil_txt = f"حرف الجر ({last_prep_by_analysis[analysis_id]})"
                    elif role_key in ("OBJ", "AGNT", "PASS_SUBJ") or role_latin == "Fa'il":
                        if analysis_id in last_verb_by_analysis:
                            amil_txt = f"الفعل ({last_verb_by_analysis[analysis_id]})"
                    elif role_latin == "Mubtada'":
                        amil_txt = "الابتداء (عامل معنوي)"
                    elif role_key == "GEN_CONS" and analysis_id in last_construct_by_analysis:
                        amil_txt = f"المضاف ({last_construct_by_analysis[analysis_id]})"
                    elif role_key in ("SUBJ_COP_PART", "PART_COP_PRED", "SUBJ_COP_V", "V_COP_PRED") and analysis_id in last_nasikh_by_analysis:
                        amil_txt = f"الناسخ ({last_nasikh_by_analysis[analysis_id]})"

                    if row.get("Possessive_Construct") == "CONSTRUCT":
                        last_construct_by_analysis[analysis_id] = word_surface

                    notes = [base_expl] if base_expl else []
                    if amil_txt and irab_status:
                        notes.append(f"Berstatus {irab_status} karena dipengaruhi amil {amil_txt}.")
                    if row.get("Possessive_Construct") == "CONSTRUCT":
                        notes.append("Berposisi sebagai mudhaf (disandarkan pada kata berikutnya).")
                    if row.get("Phrasal_Function") == "PRED":
                        notes.append("Frasa berfungsi sebagai khabar / predikat.")
                    if row.get("Segmented_Word"):
                        notes.append(f"Segmen: {row['Segmented_Word']}")

                    nodes.append(
                        (
                            analysis_id,
                            wid,
                            seg_no,
                            seq,
                            role_arabic,
                            role_latin,
                            irab_status,
                            irab_sign,
                            amil_txt,
                            " ".join(notes) if notes else None,
                        )
                    )
                    node_meta_by_analysis.setdefault(analysis_id, []).append(
                        {
                            "word_id": wid,
                            "seg_no": seg_no,
                            "role_key": role_key,
                            "construct": (row.get("Possessive_Construct") or "").strip(),
                            "morph_type": (row.get("Morph_Type") or "").strip(),
                            "morph_tag": morph_tag,
                        }
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
                      amil = EXCLUDED.amil,
                      explanation = EXCLUDED.explanation
                """,
                nodes,
            )

            # Build deterministic intra-ayah syntactic relations from MASAQ sequence
            cur.execute(
                "SELECT analysis_id, word_id, segment_number, id FROM irab_word_nodes WHERE analysis_id = ANY(%s)",
                (list(analysis_by_ayah.values()),),
            )
            node_id_map: dict[tuple[int, int, int], int] = {
                (aid, wid, seg): nid for aid, wid, seg, nid in cur.fetchall()
            }

            relations: list[tuple] = []
            for aid, items in node_meta_by_analysis.items():
                last_noun_nid: int | None = None
                last_subj_nid: int | None = None
                last_prep_nid: int | None = None
                last_construct_nid: int | None = None

                for it in items:
                    nid = node_id_map.get((aid, it["word_id"], it["seg_no"]))
                    if not nid:
                        continue
                    rk = it["role_key"]

                    if rk == "PREP":
                        last_prep_nid = nid
                    elif rk == "PREP_OBJ" and last_prep_nid:
                        relations.append((aid, last_prep_nid, nid, "jar_majrur", "حرف جر + اسم مجرور"))
                        last_prep_nid = None

                    if rk == "GEN_CONS" and last_construct_nid:
                        relations.append((aid, last_construct_nid, nid, "mudhaf_ilaih", "مضاف ومضاف إليه"))
                        last_construct_nid = None

                    if it["construct"] == "CONSTRUCT":
                        last_construct_nid = nid

                    if rk in ("SUBJ", "SBJ"):
                        last_subj_nid = nid
                    elif rk == "PRED" and last_subj_nid:
                        relations.append((aid, last_subj_nid, nid, "khabar", "خبر للمبتدأ"))
                        last_subj_nid = None

                    if rk == "ADJ" and last_noun_nid:
                        relations.append((aid, last_noun_nid, nid, "naat", "نعت / صفة"))

                    if "NOUN" in it["morph_tag"] or rk in ("SUBJ", "SBJ", "PREP_OBJ", "GEN_CONS", "OBJ", "PRED"):
                        last_noun_nid = nid

            cur.executemany(
                """
                INSERT INTO irab_relations
                  (analysis_id, source_node_id, target_node_id, relation_type, description)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (analysis_id, source_node_id, target_node_id, relation_type) DO UPDATE
                  SET description = EXCLUDED.description
                """,
                relations,
            )

            cur.execute("SELECT count(DISTINCT word_id) FROM irab_word_nodes")
            covered_words = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM irab_relations")
            total_relations = cur.fetchone()[0]

        conn.commit()

    return {
        "irab_analyses": len(analysis_by_ayah),
        "irab_word_nodes": len(nodes),
        "covered_words": covered_words,
        "irab_relations": total_relations,
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
