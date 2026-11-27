# ETL Pipeline

## Objective

Build repeatable, versioned ingestion pipelines from audited source datasets into PostgreSQL and offline data bundles.

## 1. Pipeline stages

1. Acquire source files into an immutable staging area.
2. Record source metadata, version/commit, license, retrieval timestamp, and checksum.
3. Parse files into normalized staging tables.
4. Normalize identifiers, text, Arabic search forms, and layout records.
5. Crosswalk source IDs to internal entities.
6. Load core, layout, translation, and morphology tables.
7. Run validation checks.
8. Generate validation report and offline bundle.
9. Promote a successful build; preserve rollback artifacts.

## 2. Implemented Python structure

```text
etl/
  README.md
  pyproject.toml
  etl/
    __init__.py
    m0_audit.py       # Source inventory & SHA-256 checksums
    acquire.py        # Immutable raw snapshot downloader (QPC V4, WBW ID, Morphology)
    normalize.py      # Arabic search normalization (display text untouched)
    pipeline.py       # Idempotent PostgreSQL loader (Core, Layout, Morphology, WBW ID)
    irab_masaq.py     # MASAQ v6 I‘rab nodes & intra-ayah relations loader
    validate.py       # Structural, integrity & coverage validator
    build_bundle.py   # Read-only SQLite mushaf_bundle.db + FTS5 + manifest builder
  tests/
    test_normalize.py
  sources/raw/        # Cached immutable snapshots (gitignored)
  reports/            # Validation reports & offline bundle artifacts
```

## 3. Reproducibility

- Pin source version and transform code version.
- Hash source files.
- Make import jobs idempotent.
- Record ETL run ID, timestamps, status, and counts.
- Fail on critical validation errors; warn on reviewed exceptions.
- Avoid silent overwrites of source annotation records.

## 4. Validation outputs

- Counts by entity and source.
- Missing surah/ayah/word mappings.
- Duplicate keys.
- Invalid page/line ordering.
- Unresolved layout-to-word mapping.
- Missing root/lemma/translation coverage.
- Glyph/font mapping anomalies.
- Cross-source segmentation conflicts.

## 5. Offline bundle

Build a read-only SQLite bundle (`mushaf_bundle.db`) containing versioned Quran text, page/line data, fonts if permitted, translations, morphology, and essential search indexes (e.g., FTS5). Keep it strictly separate from the mobile app's `user_state.db` so bundle updates can perform an atomic swap/rollback without risking user bookmarks or reading progress. Provide a JSON manifest with checksums, schema version, and app compatibility rules.

## 6. Safety

Never distribute a dataset or font in an app bundle until license/permission review is completed.
