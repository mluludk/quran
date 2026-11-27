# API Specification (Draft)

Base path: `/api/v1`. JSON. Authentication requirements for user-state endpoints depend on the selected auth implementation.

## 1. Quran and edition

| Method | Endpoint | Description |
|---|---|---|
| GET | `/surahs` | List surahs |
| GET | `/surahs/{id}` | Surah metadata |
| GET | `/surahs/{id}/ayahs` | Ayah list |
| GET | `/ayahs/{surah}/{ayah}` | Ayah with words |
| GET | `/editions` | Available Mushaf editions |
| GET | `/pages/{page}?edition={code}` | Page and line layout |
| GET | `/pages/{page}/lines?edition={code}` | Page line structure |

## 2. Word and linguistics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/words/{id}` | Word and verse context |
| GET | `/words/{id}/translation` | Word translation |
| GET | `/words/{id}/morphology` | Root, lemma, POS, morphology |
| GET | `/words/{id}/irab` | I‘rab (nahwu) role, status, sign, amil & syntactic relations |
| GET | `/words/{id}/occurrences` | Occurrences for word/lemma as supported |
| GET | `/ayahs/{surah}/{ayah}/irab` | Full ayah i‘rab analyses (supports multiple opinions) and word relations |
| GET | `/roots/{id}` | Root detail |
| GET | `/roots/{id}/family` | Root word family grouped by lemma, POS, and morphological pattern |
| GET | `/roots/{id}/words` | Word forms related to root |
| GET | `/roots/{id}/occurrences` | Root occurrence list |
| GET | `/search/arabic?q=` | Search Arabic text |
| GET | `/search/roots?q=` | Search root |
| GET | `/search/lemmas?q=` | Search lemma |

## 3. Offline bundles

| Method | Endpoint | Description |
|---|---|---|
| GET | `/bundles/latest?edition={code}` | Latest compatible offline bundle metadata & checksum |
| GET | `/bundles/{version}/manifest` | Bundle manifest, file list, and schema version |

## 4. User state

| Method | Endpoint | Description |
|---|---|---|
| GET | `/bookmarks` | List bookmarks |
| POST | `/bookmarks` | Create bookmark |
| DELETE | `/bookmarks/{id}` | Remove bookmark |
| GET | `/reading-progress` | Get progress |
| PUT | `/reading-progress` | Update progress |
| GET | `/vocab/collections` | List vocabulary themes/collections |
| POST | `/vocab/collections` | Create vocabulary theme |
| GET | `/vocab/items` | List saved words/ayahs with notes & mastery |
| POST | `/vocab/items` | Save word or ayah to notebook |
| PATCH | `/vocab/items/{id}` | Update note, theme, or flashcard mastery |
| DELETE | `/vocab/items/{id}` | Remove saved item |
| GET | `/vocab/progress` | Vocabulary learning progress summary |
| GET | `/learn/summary` | Global & per-Juz word mastery summary |
| GET | `/learn/deck` | Practice deck (`mode=frequency\|juz\|page`) with quiz choices |
| POST | `/learn/answer` | Record quiz/flashcard answer and update word mastery |
| GET | `/words/{id}/frequency` | Word frequency, variations, Makkiyah/Madaniyah & ayah context |
| GET | `/frequency/top` | Top most-frequent words and roots across the Quran |

## 5. Example page response

```json
{
  "edition": "madinah-hafs-604",
  "page_number": 1,
  "juz_number": 1,
  "hizb_number": 1,
  "font_asset_key": "p1",
  "surahs_on_page": [
    { "id": 1, "name_arabic": "الفاتحة", "first_ayah": 1, "last_ayah": 7 }
  ],
  "lines": [
    {
      "line_number": 1,
      "line_type": "surah_header",
      "items": [
        {
          "item_type": "surah_header",
          "position": 1,
          "surah_id": 1,
          "display_text": "سورة الفاتحة"
        }
      ]
    },
    {
      "line_number": 2,
      "line_type": "ayah",
      "items": [
        {
          "item_type": "word",
          "word_id": 1,
          "ayah_id": 1,
          "position": 1,
          "arabic_text": "بِسْمِ",
          "source_glyph_code": "..."
        },
        {
          "item_type": "ayah_end",
          "ayah_id": 1,
          "position": 5,
          "display_text": "١"
        }
      ]
    }
  ]
}
```

Response includes layout/glyph identifiers, non-word layout items (`surah_header`, `basmala`, `ayah_end`, `ornament`), and selection metadata as supported by source data.

## 6. API design notes

- Pagination for occurrence and search endpoints using `limit` (default 20, max 100) and `offset` (or cursor), returning `{ "data": [...], "pagination": { "total", "limit", "offset" } }`.
- Standard error envelope: `{ "error": { "code": "...", "message": "..." } }`.
- Configure CORS for the Next.js web origin and add HTTP caching (`ETag` / `Cache-Control`) on immutable dataset endpoints (`/surahs`, `/pages/*`, `/words/*`, `/roots/*`).
- Stable internal IDs.
- API schema and examples to be formalized (OpenAPI).
- Version endpoints and offline bundle separately.
- Return source/provenance fields for linguistic records where useful.
- Authentication and sync conflicts need a defined policy before cloud user-state implementation.
