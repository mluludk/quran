# Product & Engineering Backlog

Backlog ini diturunkan dari [PRD.md](../PRD.md) dan [development-roadmap.md](./development-roadmap.md).

## Milestones

| Milestone | Fokus | Gate / Target |
|---|---|---|
| **M0: Source Audit & Proof** | Audit sumber data, lisensi web & mobile, dan proof renderer 3 halaman | Sumber & lisensi tervalidasi |
| **M1: Database & ETL** | Finalisasi schema PostgreSQL, ETL core/layout/linguistik, validator, SQLite bundle | Data 604 halaman & crosswalk terverifikasi |
| **M2: Go/Fiber API** | Endpoint `/api/v1`, caching, OpenAPI, integration tests | API siap dikonsumsi web & mobile |
| **M3-Web: Next.js Reader** | Fixed 604-page renderer, word hit-testing, Word Explorer, Search | End-to-end UX & data tervalidasi di web |
| **M3-Mobile: Flutter Offline** | Dual SQLite, fixed renderer, hit-testing, offline Word Explorer & bookmarks | Aplikasi offline-first berjalan di perangkat |
| **M4: Sync & Parity** | Sinkronisasi user state & paritas visual web ↔ mobile | Konsistensi lintas platform |
| **M5: QA & Release** | Visual QA, offline QA, audit atribusi lisensi final | Siap rilis pilot |

---

## Backlog Items

### M0: Source Audit & Proof
1. **[M0] Audit kandidat sumber data & segmentasi kata** (`area:data`, `P0`)
   - Verifikasi QPC V4, QUL 15-line layout, Quranic Arabic Corpus, Tanzil, dan dataset WBW bahasa Indonesia (`id`).
   - Dokumentasikan versi/commit, checksum, jumlah surah/ayat/kata, dan konflik segmentasi di `docs/data-source-mapping.md`.
2. **[M0] Audit lisensi & redistribusi aset (web & mobile)** (`area:legal`, `P0`)
   - Cek izin komersial, redistribusi bundle mobile, `@font-face` web hosting, dan redistribusi API JSON publik di `docs/license-compliance.md`.
3. **[M0] Technical proof 3 halaman di Next.js & cek paritas renderer Flutter** (`area:web`, `area:mobile`, `P0`)
   - Render 3 halaman representatif (pembuka, padat/kompleks, kasus khusus), buktikan fixed layout tanpa reflow dan word hit-testing.

### M1: Database & ETL
4. **[M1] Finalisasi schema PostgreSQL & migrasi lanjutan** (`area:data`, `P0`) — *Dep: #1*
   - Sesuaikan `migrations/001_initial_schema.sql` dengan temuan M0 (kolom font, item non-kata, crosswalk).
5. **[M1] Implementasi ETL ingestion & source crosswalk (Core & Layout)** (`area:etl`, `P0`) — *Dep: #4*
   - Impor idempotent untuk `surahs`, `ayahs`, `quran_words`, `mushaf_pages`, `mushaf_lines`, `mushaf_line_items`, `source_crosswalks`.
6. **[M1] Implementasi ETL linguistik & terjemahan Indonesia** (`area:etl`, `P0`) — *Dep: #5*
   - Impor `roots`, `lemmas`, `word_morphology` (per segmen), dan `word_translations` (`id`) dengan provenance.
7. **[M1] Implementasi validator integritas data & laporan cakupan ETL** (`area:etl`, `P0`) — *Dep: #6*
   - Cek 114 surah, 604 halaman, tidak ada layout item yatim, laporan cakupan root/lemma/POS/terjemahan.
8. **[M1] Implementasi builder offline SQLite bundle** (`area:etl`, `P1`) — *Dep: #7*
   - Bangun `mushaf_bundle.db` (read-only + FTS5) dan manifest JSON ber-checksum.

### M2: Go/Fiber API
9. **[M2] Endpoint Quran Core & Mushaf Page** (`area:api`, `P0`) — *Dep: #5*
   - Implementasi `/surahs`, `/surahs/{id}/ayahs`, `/ayahs/{surah}/{ayah}`, `/editions`, `/pages/{page}`.
10. **[M2] Endpoint Word Explorer & Search** (`area:api`, `P0`) — *Dep: #6*
    - Implementasi `/words/{id}`, `/words/{id}/translation`, `/words/{id}/morphology`, `/roots/{id}/*`, `/search/*` dengan pagination.
11. **[M2] Endpoint Offline Bundle & User State** (`area:api`, `P1`) — *Dep: #8*
    - Implementasi `/bundles/latest`, `/bundles/{version}/manifest`, `/bookmarks`, `/reading-progress`.
12. **[M2] HTTP Caching, OpenAPI spec, dan integration tests** (`area:api`, `P1`) — *Dep: #9, #10*
    - Tambah `ETag`/`Cache-Control` pada endpoint imutabel, dokumen OpenAPI, dan integration test.

### M3-Web: Next.js Reader
13. **[M3-Web] Fixed 604-page Mushaf renderer & navigasi** (`area:web`, `P0`) — *Dep: #3, #9*
    - Render halaman 1–604 tanpa reflow, header halaman (juz/hizb/surah), navigasi page/surah/ayah, shareable URL.
14. **[M3-Web] Word hit-testing, highlight overlay, dan Word Detail panel** (`area:web`, `P0`) — *Dep: #10, #13*
    - Klik kata tanpa menggeser layout, tampilkan terjemahan Indonesia, root, lemma, POS, dan morfologi per segmen.
15. **[M3-Web] Root Explorer & Arabic/Root/Lemma Search** (`area:web`, `P0`) — *Dep: #10, #14*
    - Halaman/panel daftar kemunculan akar kata dengan lompat balik ke halaman Mushaf, serta pencarian teks Arab ternormalisasi.

### M3-Mobile: Flutter Offline
16. **[M3-Mobile] Inisialisasi Flutter & dual SQLite** (`area:mobile`, `P0`) — *Dep: #8*
    - Setup project di `app/`, integrasi `mushaf_bundle.db` (read-only) dan `user_state.db` (read-write).
17. **[M3-Mobile] Fixed page renderer, hit-testing, & Word Explorer offline** (`area:mobile`, `P0`) — *Dep: #3, #16*
    - Render 604 halaman offline, seleksi kata dengan highlight overlay, detail kata, root explorer, dan search lokal.
18. **[M3-Mobile] Atomic bundle update, bookmarks, & reading progress** (`area:mobile`, `P1`) — *Dep: #11, #17*
    - Mekanisme atomic swap/rollback `mushaf_bundle.db` dan persistensi bookmark/progress di `user_state.db`.

### M4: Sync & Parity
19. **[M4] Sinkronisasi user state & paritas visual web ↔ mobile** (`area:api`, `area:web`, `area:mobile`, `P2`) — *Dep: #11, #15, #18*
    - Kebijakan resolusi konflik sync bookmark/progress dan uji paritas visual halaman representatif.
21. **[M4] Audit sumber kitab/dataset I‘rab & izin digitalisasi** (`area:data`, `area:legal`, `P1`) — *Dep: #1, #2*
    - Evaluasi hak cipta, edisi, dan cakupan kitab i‘rab (mis. Muhyiddin Darwish, Zakariya Da‘as, atau treebank sintaksis terbuka) serta rencana validasi ahli nahwu.
22. **[M4] ETL & API Quran I‘rab Explorer** (`area:etl`, `area:api`, `P1`) — *Dep: #21*
    - Terapkan `migrations/002_irab_schema.sql`, pipeline ETL i‘rab (mendukung multi-pendapat per ayat), serta endpoint `/words/{id}/irab` dan `/ayahs/{surah}/{ayah}/irab`.
23. **[M4] UI Quran I‘rab Explorer & Relasi Nahwu (Web & Mobile)** (`area:web`, `area:mobile`, `P1`) — *Dep: #14, #17, #22*
    - Integrasikan tab I‘rab (kedudukan, status, tanda i‘rab, amil, hubungan nahwu, penjelasan, referensi sumber) ke Word Explorer di Next.js dan Flutter.
24. **[M4] Mapping lengkap tag MASAQ v6 & kamus penjelasan Nahwu ID** (`area:etl`, `area:data`, `P1`) — *Dep: #22*
    - Petakan seluruh tag `Syntactic_Role`, `Case_Mood`, dan `Case_Mood_Marker` MASAQ ke istilah Arab/Latin serta template penjelasan gramatikal bahasa Indonesia.
25. **[M4] ETL relasi nahwu (`irab_relations`) & API relasi kata** (`area:etl`, `area:api`, `P1`) — *Dep: #22*
    - Impor relasi sintaksis antarkata (dari `NoorBayan/Quranic` / sumber treebank) ke `irab_relations` dan ekspos di `GET /words/{id}` serta `GET /ayahs/{surah}/{ayah}/irab`.
26. **[M3-Web] Redesign Word & I‘rab Explorer UI sesuai mockup** (`area:web`, `P1`) — *Dep: #24, #25*
    - Tampilkan 3 badge ringkas (`Kedudukan`, `Jenis Kata`, `Status I‘rab`), format root berspasi (`ح م د`), penjelasan nahwu, dan diagram panah Hubungan Nahwu.
27. **[M4] Ekspos `words` & `irab_relations` di `GET /ayahs/{surah}/{ayah}/irab`** (`area:api`, `P1`) — *Dep: #25*
    - Sertakan daftar kata ayat beserta graf `nodes` dan `relations` pada endpoint i‘rab per-ayat untuk kebutuhan visualisasi diagram sintaksis.
28. **[M3-Web] Komponen SVG Dependency Arc Diagram I‘rab per-ayat** (`area:web`, `P1`) — *Dep: #27*
    - Render diagram lengkungan sintaksis RTL berbasis SVG (urutan kata kanan-ke-kiri, label peran, dan kurva Bezier relasi nahwu) yang dapat dibuka dari Word Explorer.
29. **[M2] Endpoint `GET /roots/{id}/family` untuk keluarga kata** (`area:api`, `P1`) — *Dep: #10*
    - Kelompokkan derivasi dari satu akar berdasarkan lemma, kategori (`Fi'il`, `Isim`, `Masdar`), wazan, jumlah kemunculan, arti Indonesia, dan lokasi ayat/halaman.
30. **[M3-Web] Root & Word Family Explorer UI** (`area:web`, `P1`) — *Dep: #29*
    - Perbarui `RootExplorerModal.tsx` dengan tab Keluarga Kata, filter `Fi'il / Isim / Masdar`, dan pewarnaan huruf akar vs huruf imbuhan (ziyadah).
31. **[M4] Schema & ETL Frasa/Klausa (`irab_phrases`)** (`area:data`, `area:etl`, `P1`) — *Dep: #22*
    - Terapkan `migrations/003_phrase_schema.sql` dan ekstrak frasa/klausa (*Jar-Majrur*, *Idhafah*, *Jumlah Ismiyah*, *Jumlah Fi'liyah*, *Shilah Maushul*, *Klausa Syarat*) dari MASAQ v6.
32. **[M2] Ekspos `phrases` di `GET /ayahs/{surah}/{ayah}/irab`** (`area:api`, `P1`) — *Dep: #31*
    - Sertakan daftar `phrases` (rentang kata, jenis frasa, dan *mahal i‘rab*) pada endpoint i‘rab per-ayat.
33. **[M3-Web] UI Quran Phrase & Sentence Explorer di Diagram Ayat** (`area:web`, `P1`) — *Dep: #32*
    - Render garis rentang frasa/klausa (`PP`, `NS`, `VS`, `Idhafah`, `Shilah`, `Syarth`) pada diagram SVG RTL dan daftar penjelasan frasa di bawah diagram.
34. **[M4] Schema & Migrasi Quran Vocabulary Notebook (`004_vocabulary_notebook.sql`)** (`area:data`, `P1`)
    - Tambah tabel `vocab_collections` (tema) dan `vocab_items` (simpan kata/ayat, catatan, `mastery_level`, `review_count`).
35. **[M2] API Vocabulary Notebook, Progress & Flashcard** (`area:api`, `P1`) — *Dep: #34*
    - Implementasi `/vocab/collections`, `/vocab/items`, `/vocab/progress` untuk simpan kata/ayat, catatan, tema, dan review flashcard.
36. **[M3-Web] UI Vocabulary Notebook, Tema, Progress & Flashcard** (`area:web`, `P1`) — *Dep: #35*
    - Tombol simpan kata/ayat dari Word Explorer, manajemen tema & catatan pribadi, progress bar, dan mode Flashcard interaktif.
37. **[M4] Schema & Migrasi Modul Pembelajaran Hafalan Kata (`006_learning_module.sql`)** (`area:data`, `P1`)
    - Tambah tabel `learning_word_progress` untuk melacak penguasaan per kata ternormalisasi (`mastery_level`, `correct_count`, `wrong_count`).
38. **[M2] API Modul Pembelajaran (`/learn/summary`, `/learn/deck`, `/learn/answer`)** (`area:api`, `P1`) — *Dep: #37*
    - Sajikan dek latihan berdasarkan frekuensi, Juz (1–30), atau halaman Mushaf beserta 4 opsi pilihan ganda.
39. **[M3-Web] Halaman `/learn` (Kuis Pilihan Ganda, Flashcard & Progress Per Juz)** (`area:web`, `P1`) — *Dep: #38*
    - Bangun antarmuka `/learn` dengan dashboard progress Juz 1–30, kuis interaktif, flashcard, dan integrasi simpan ke Vocabulary Notebook.
40. **[M4] ETL Pemisahan Mubtada'/Fa'il, Amil & Alasan Kedudukan Nahwu** (`area:etl`, `P1`) — *Dep: #24*
    - Perbarui `irab_masaq.py` untuk membedakan `Mubtada'` vs `Fa'il`, mengisi kolom `amil`, dan memperkaya kalimat alasan kedudukan.
41. **[M2] Ekspos `grammar_roles` pada `GET /pages/{page}`** (`area:api`, `P1`) — *Dep: #40*
    - Sertakan `grammar_roles` per kata pada endpoint halaman agar UI dapat mewarnai fungsi nahwu tanpa request tambahan.
42. **[M3-Web] Quran Grammar Learning Mode UI di `/mushaf` & `/tarjim`** (`area:web`, `P1`) — *Dep: #41*
    - Tambah toggle Mode Belajar Nahwu, *color legend* filter (`Mubtada'`, `Khabar`, `Fa'il`, `Maf'ul`, `Huruf Jar`, `Ism Majrur`, `Amil`), dan tampilan `Amil` di Word Explorer.
43. **[M2] API Vocabulary Frequency (`/words/{id}/frequency` & `/frequency/top`)** (`area:api`, `P1`) — *Dep: #10*
    - Sajikan frekuensi kata, variasi bentuk, frekuensi root, distribusi Makkiyah/Madaniyah, daftar konteks ayat, dan top kata/root terbanyak.
44. **[M3-Web] Halaman `/frequency` & Perbandingan Konteks Ayat** (`area:web`, `P1`) — *Dep: #43*
    - Bangun halaman `/frequency` dengan leaderboard kata/root terbanyak, statistik variasi bentuk, dan perbandingan penggunaan dalam konteks ayat.
45. **[M3-Web] Integrasi tombol Frekuensi & Konteks di WordExplorerPanel** (`area:web`, `P1`) — *Dep: #44*
    - Tambah tombol **Frekuensi & Konteks ↗** pada panel Word & I‘rab Explorer menuju `/frequency?wordId=...`.
46. **[M2] API Context & Collocation Explorer (`/words/{id}/context`)** (`area:api`, `P1`) — *Dep: #10*
    - Hitung akar kata yang sering berpasangan (*co-occurrence*), variasi nuansa terjemahan kontekstual, dan filter ayat berdasarkan pasangan kata/makna.
47. **[M3-Web] Halaman `/context` (Semantic & Context Explorer)** (`area:web`, `P1`) — *Dep: #46*
    - Bangun antarmuka `/context` dengan preset (`تقوى`, `إيمان`, `صبر`, `رحمة`, `هدى`), filter pasangan kata, dan perbandingan ayat.
48. **[M4] Schema & Kurasi Editorial Semantic Concepts (Tahap 2)** (`area:data`, `area:legal`, `P2`) — *Dep: #47*
    - Rancang tabel konsep tematik terkurasi beserta `source_id` dan review editorial ahli tafsir/bahasa Arab.
49. **[M4] Schema, Migrasi & Audit Validasi I'rab (`007_irab_validation.sql`)** (`area:data`, `area:etl`, `P1`) — *Dep: #24*
    - Tambah kolom `validation_status`, `confidence_score`, `validation_notes`, `validated_at` pada `irab_analyses`, jalankan audit seluruh 6.236 ayat, serta tambahkan contoh alternatif analisis i'rab (`opinion_label = 'alternative'`).
50. **[M2] API Linguistic Engine: Validasi I'rab, Multi-Opini & Sarf Explorer** (`area:api`, `P1`) — *Dep: #49*
    - Ekspos `validation_status`, `confidence_score`, `parent_phrase_id`, dan multi-opini pada endpoint i'rab, serta tambah `GET /irab/validation-summary` dan `GET /sarf/explore`.
51. **[M3-Web] Syntax Tree, Badge Validasi & Switcher Alternatif I'rab** (`area:web`, `P1`) — *Dep: #50*
    - Perbarui `AyahIrabDiagramModal.tsx` dengan tab **Grammar / Syntax Tree**, badge **Source, Confidence & Validation Status**, serta switcher **Alternatif Analisis I'rab**.
52. **[M3-Web] Halaman `/sarf` (Sarf Explorer)** (`area:web`, `P1`) — *Dep: #50*
    - Bangun antarmuka `/sarf` untuk menelusuri bentuk kata/wazan (`VF:1..12`), POS, fitur morfologi, akar kata, dan contoh penggunaannya dalam Al-Qur'an.
53. **[M4] Schema & Migrasi Quran Learning Engine (`008_learning_engine.sql`)** (`area:data`, `P1`) — *Dep: #37*
    - Tambah kolom SM-2 Spaced Repetition (`interval_days`, `ease_factor`, `next_review_at`) pada `learning_word_progress`, serta tabel `learning_user_goals` dan `learning_daily_logs`.
54. **[M2] API SRS, Adaptive Deck, Learning Path & Daily Goals** (`area:api`, `P1`) — *Dep: #53*
    - Perbarui `/learn/summary`, `/learn/deck`, dan `/learn/answer` dengan SM-2, mode `due`/`adaptive`, tahap Learning Path Tadrij, serta tambah `GET/PUT /learn/goals`.
55. **[M2] API Quiz Nahwu & Sharaf (`/learn/grammar-quiz`)** (`area:api`, `P1`) — *Dep: #53*
    - Sajikan soal pilihan ganda interaktif untuk kedudukan nahwu/amil dan wazan/akar kata sharaf dari data tervalidasi.
56. **[M3-Web] UI Learning Engine di `/learn` (SRS, Goals, Path & Quiz Nahwu/Sharaf)** (`area:web`, `P1`) — *Dep: #54, #55*
    - Lengkapi halaman `/learn` dengan target harian & streak, mode Due/Adaptive, kartu Learning Path bertahap, serta tab Kuis Nahwu dan Kuis Sharaf.
57. **[M4] Schema & Seed Quran Knowledge Engine (`009_knowledge_engine.sql`)** (`area:data`, `area:legal`, `P1`) — *Dep: #48*
    - Tambah tabel `knowledge_concepts`, `knowledge_concept_links`, `knowledge_themes`, `knowledge_theme_ayahs`, `ayah_cross_references`, `tafsir_sources`, `ayah_tafsirs`, dan `knowledge_notes` beserta data awal terkurasi.
58. **[M2] API Knowledge Engine (Semantic Network, Tafsir, Cross-Ref & Notes)** (`area:api`, `P1`) — *Dep: #57*
    - Implementasi `/knowledge/overview`, `/knowledge/concepts/{slug}`, `/knowledge/themes/{slug}`, `/ayahs/{surah}/{ayah}/knowledge`, serta CRUD `/knowledge/notes`.
59. **[M3-Web] Halaman `/knowledge` (Semantic Network, Concept & Thematic Explorer)** (`area:web`, `P1`) — *Dep: #58*
    - Bangun visualisasi SVG Semantic Network, Concept Explorer, dan Thematic Quran Explorer di `/knowledge`.
60. **[M3-Web] Tafsir Reference Layer, Cross-Ref Ayat & Personal Knowledge Library** (`area:web`, `P1`) — *Dep: #58, #59*
    - Bangun penjelajah rujukan tafsir, relasi ayat-ke-ayat, dan catatan pengetahuan bertag di `/knowledge`.

### M5: QA & Release
20. **[M5] Visual QA, offline QA, dan verifikasi atribusi lisensi final** (`area:data`, `area:legal`, `P0`) — *Dep: #15, #18*
    - Jalankan seluruh checklist di `docs/validation-plan.md` dan `docs/license-compliance.md` sebelum rilis pilot.
