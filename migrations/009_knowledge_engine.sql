-- 009_knowledge_engine.sql
-- Quran Knowledge Engine: Semantic Network, Concepts, Themes, Tafsir References, Cross-References & Personal Notes

BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_concepts (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_arabic TEXT NOT NULL,
  name_latin TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_attribution TEXT NOT NULL DEFAULT 'Editorial Digital Mushaf (berbasis korpus akar kata & tafsir ringkas)',
  root_text TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_concept_links (
  id BIGSERIAL PRIMARY KEY,
  source_concept_id BIGINT NOT NULL REFERENCES knowledge_concepts(id) ON DELETE CASCADE,
  target_concept_id BIGINT NOT NULL REFERENCES knowledge_concepts(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE (source_concept_id, target_concept_id, relation_type)
);

CREATE TABLE IF NOT EXISTS knowledge_themes (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_theme_ayahs (
  id BIGSERIAL PRIMARY KEY,
  theme_id BIGINT NOT NULL REFERENCES knowledge_themes(id) ON DELETE CASCADE,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  concept_id BIGINT REFERENCES knowledge_concepts(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (theme_id, ayah_id)
);

CREATE TABLE IF NOT EXISTS ayah_cross_references (
  id BIGSERIAL PRIMARY KEY,
  source_ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  target_ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  explanation TEXT NOT NULL,
  source_attribution TEXT NOT NULL DEFAULT 'Tafsir al-Qur''an bil-Qur''an',
  UNIQUE (source_ayah_id, target_ayah_id, relation_type)
);

CREATE TABLE IF NOT EXISTS tafsir_sources (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  language_code TEXT NOT NULL DEFAULT 'id',
  license_note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ayah_tafsirs (
  id BIGSERIAL PRIMARY KEY,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES tafsir_sources(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  key_points TEXT NOT NULL DEFAULT '',
  UNIQUE (ayah_id, source_id)
);

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  ayah_id BIGINT REFERENCES ayahs(id) ON DELETE SET NULL,
  concept_id BIGINT REFERENCES knowledge_concepts(id) ON DELETE SET NULL,
  theme_id BIGINT REFERENCES knowledge_themes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Curated Concepts
INSERT INTO knowledge_concepts (slug, name_arabic, name_latin, category, summary, root_text) VALUES
  ('iman', 'إيمان', 'Iman', 'Akidah', 'Pembenaran hati, ikrar lisan, dan pembuktian amal terhadap Allah, malaikat, kitab, rasul, hari akhir, dan takdir.', 'أمن'),
  ('taqwa', 'تقوى', 'Taqwa', 'Akhlak & Ibadah', 'Menjaga diri dari murka Allah dengan melaksanakan perintah-Nya dan menjauhi larangan-Nya.', 'وقي'),
  ('huda', 'هدى', 'Huda (Petunjuk)', 'Wahyu', 'Bimbingan ilahi yang mengarahkan manusia menuju jalan yang lurus (ash-shirath al-mustaqim).', 'هدي'),
  ('sabr', 'صبر', 'Shabr (Kesabaran)', 'Akhlak', 'Keteguhan hati dalam ketaatan, menahan diri dari maksiat, dan ridha saat menghadapi ujian.', 'صبر'),
  ('rahmah', 'رحمة', 'Rahmah (Kasih Sayang)', 'Sifat Allah & Akhlak', 'Curahan kasih sayang Allah kepada seluruh makhluk-Nya serta kelembutan antar-sesama.', 'رحم'),
  ('syukur', 'شكر', 'Syukur', 'Ibadah & Akhlak', 'Mengakui nikmat Allah dengan hati, memuji dengan lisan, dan menggunakannya dalam ketaatan.', 'شكر'),
  ('tawakkul', 'توكل', 'Tawakkul', 'Akidah & Hati', 'Menyandarkan hasil sepenuhnya kepada Allah setelah menempuh ikhtiar yang disyariatkan.', 'وكل'),
  ('ikhlas', 'إخلاص', 'Ikhlas', 'Ibadah', 'Memurnikan niat ibadah semata-mata mengharap wajah dan ridha Allah.', 'خلص')
ON CONFLICT (slug) DO NOTHING;

-- Seed Semantic Network Edges
INSERT INTO knowledge_concept_links (source_concept_id, target_concept_id, relation_type, description)
SELECT c1.id, c2.id, v.rel, v.descr
FROM (VALUES
  ('iman', 'taqwa', 'melahirkan', 'Iman yang benar melahirkan sikap taqwa dalam kehidupan.'),
  ('iman', 'tawakkul', 'melahirkan', 'Kesempurnaan iman menuntut tawakkul hanya kepada Allah (QS. 5:23).'),
  ('huda', 'taqwa', 'khusus_untuk', 'Al-Qur''an adalah petunjuk (huda) khususnya bagi orang-orang bertaqwa (QS. 2:2).'),
  ('taqwa', 'rahmah', 'mendatangkan', 'Ketaqwaan dan ketaatan membuka pintu rahmat Allah (QS. 7:156).'),
  ('sabr', 'huda', 'mengantarkan', 'Kesabaran dan keyakinan melahirkan kepemimpinan & petunjuk (QS. 32:24).'),
  ('sabr', 'syukur', 'berpasangan', 'Dua sayap mukmin: bersabar saat diuji dan bersyukur saat diberi nikmat (QS. 14:5).'),
  ('ikhlas', 'iman', 'memurnikan', 'Ikhlas memurnikan ibadah dan tauhid dari syirik dan riya'' (QS. 98:5).'),
  ('rahmah', 'syukur', 'mendorong', 'Merenungi luasnya rahmat Allah mendorong hamba untuk bersyukur.')
) AS v(s1, s2, rel, descr)
JOIN knowledge_concepts c1 ON c1.slug = v.s1
JOIN knowledge_concepts c2 ON c2.slug = v.s2
ON CONFLICT DO NOTHING;

-- Seed Themes
INSERT INTO knowledge_themes (slug, title, description) VALUES
  ('akidah-tauhid', 'Akidah & Tauhid', 'Ke-Esaan Allah, sifat-sifat-Nya, dan fondasi keimanan.'),
  ('ibadah-doa', 'Ibadah & Doa', 'Shalat, dzikir, keikhlasan beribadah, dan doa-doa inti Al-Qur''an.'),
  ('akhlak-jiwa', 'Akhlak & Penyucian Jiwa', 'Sabar, syukur, taqwa, jujur, dan menjaga amanah.'),
  ('hari-akhir', 'Hari Akhir & Balasan', 'Gambaran kiamat, hisab, surga, dan peringatan bagi yang lalai.')
ON CONFLICT (slug) DO NOTHING;

-- Seed Theme -> Ayah mappings
INSERT INTO knowledge_theme_ayahs (theme_id, ayah_id, concept_id, note)
SELECT th.id, a.id, c.id, v.note
FROM (VALUES
  ('akidah-tauhid', 112, 1, 'iman', 'Penegasan tauhid murni: Allah Maha Esa.'),
  ('akidah-tauhid', 2, 255, 'iman', 'Ayat Kursi: keagungan ilmu dan kekuasaan Allah.'),
  ('ibadah-doa', 1, 5, 'ikhlas', 'Ikrar ibadah dan permohonan pertolongan hanya kepada Allah.'),
  ('ibadah-doa', 1, 6, 'huda', 'Doa memohon petunjuk jalan yang lurus.'),
  ('akhlak-jiwa', 2, 2, 'taqwa', 'Al-Qur''an sebagai petunjuk bagi orang-orang bertaqwa.'),
  ('akhlak-jiwa', 2, 153, 'sabr', 'Perintah menjadikan sabar dan shalat sebagai penolong.'),
  ('akhlak-jiwa', 103, 3, 'sabr', 'Saling menasihati dalam kebenaran dan kesabaran.'),
  ('hari-akhir', 99, 7, 'taqwa', 'Setiap amal kebaikan dan keburukan sekecil dzarrah akan diperlihatkan.')
) AS v(tslug, sid, anum, cslug, note)
JOIN knowledge_themes th ON th.slug = v.tslug
JOIN ayahs a ON a.surah_id = v.sid AND a.ayah_number = v.anum
LEFT JOIN knowledge_concepts c ON c.slug = v.cslug
ON CONFLICT DO NOTHING;

-- Seed Cross-References (Tafsir al-Qur'an bil-Qur'an)
INSERT INTO ayah_cross_references (source_ayah_id, target_ayah_id, relation_type, explanation)
SELECT a1.id, a2.id, v.rel, v.expl
FROM (VALUES
  (1, 6, 1, 7, 'tafsir_ayat', 'Jalan yang lurus (ayat 6) ditafsirkan langsung pada ayat 7 sebagai jalan orang-orang yang diberi nikmat.'),
  (1, 6, 2, 2, 'penjelas_hidayah', 'Permohonan hidayah pada Al-Fatihah dijawab di awal Al-Baqarah bahwa Al-Qur''an adalah petunjuk (hudan lil-muttaqin).'),
  (2, 2, 1, 6, 'penjelas_hidayah', 'Al-Kitab sebagai petunjuk bagi muttaqin melengkapi doa ihdinash-shirathal mustaqim.'),
  (112, 1, 2, 255, 'tauhid_paralel', 'Penegasan keesaan Allah (Ahad) sejalan dengan La ilaha illa Huwa Al-Hayyu Al-Qayyum pada Ayat Kursi.'),
  (103, 3, 2, 153, 'tema_sabar', 'Wasiat kesabaran pada Surah Al-''Asr diperkuat dengan perintah meminta pertolongan melalui sabar dan shalat.')
) AS v(s1, n1, s2, n2, rel, expl)
JOIN ayahs a1 ON a1.surah_id = v.s1 AND a1.ayah_number = v.n1
JOIN ayahs a2 ON a2.surah_id = v.s2 AND a2.ayah_number = v.n2
ON CONFLICT DO NOTHING;

-- Seed Tafsir Reference Layer
INSERT INTO tafsir_sources (slug, name, author, language_code, license_note) VALUES
  ('ringkas-editorial', 'Ringkasan Rujukan Tafsir (Kemenag / Al-Muyassar)', 'Tim Kurasi Digital Mushaf', 'id', 'Rujukan ringkas tematik untuk pembelajaran; merujuk Tafsir Kemenag RI & Tafsir Al-Muyassar')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ayah_tafsirs (ayah_id, source_id, summary_text, key_points)
SELECT a.id, ts.id, v.summary_text, v.key_points
FROM (VALUES
  (1, 1, 'Memulai setiap urusan dengan menyebut nama Allah Yang Maha Pengasih lagi Maha Penyayang untuk mengharap keberkahan dan pertolongan-Nya.', 'Ar-Rahman: rahmat umum bagi seluruh makhluk; Ar-Rahim: rahmat khusus bagi orang beriman.'),
  (1, 2, 'Segala pujian sempurna hanya milik Allah, Tuhan yang memelihara, mendidik, dan mengatur seluruh alam semesta.', 'Makna Rabb mencakup Pencipta, Pemilik, dan Pengatur alam.'),
  (1, 5, 'Ikrar tauhid uluhiyah: hanya kepada-Mu kami beribadah dengan ikhlas dan hanya kepada-Mu kami memohon pertolongan dalam segala urusan.', 'Mendahulukan iyyaka menunjukkan pembatasan (ikhtishash) ibadah hanya bagi Allah.'),
  (1, 6, 'Doa paling agung seorang mukmin: memohon bimbingan agar tetap teguh di atas jalan Islam yang lurus.', 'Hidayah mencakup ilmu yang benar dan taufik untuk mengamalkannya.'),
  (2, 2, 'Al-Qur''an adalah kitab agung yang tidak ada keraguan sedikit pun di dalamnya, berfungsi sebagai petunjuk hidup bagi orang-orang yang bertaqwa.', 'Syarat mengambil manfaat petunjuk Al-Qur''an adalah hati yang bertaqwa.'),
  (2, 255, 'Ayat Kursi: Allah Maha Hidup, Maha Berdiri Sendiri, tidak mengantuk, pemilik langit dan bumi, dan ilmu-Nya meliputi segala sesuatu.', 'Ayat paling agung dalam Al-Qur''an tentang keesaan dan kesempurnaan sifat Allah.'),
  (112, 1, 'Katakanlah (wahai Muhammad): Dialah Allah, Tuhan Yang Maha Esa, tidak ada sekutu bagi-Nya.', 'Menetapkan keesaan Dzat, sifat, dan ibadah hanya untuk Allah.')
) AS v(sid, anum, summary_text, key_points)
JOIN ayahs a ON a.surah_id = v.sid AND a.ayah_number = v.anum
CROSS JOIN tafsir_sources ts
WHERE ts.slug = 'ringkas-editorial'
ON CONFLICT DO NOTHING;

COMMIT;
