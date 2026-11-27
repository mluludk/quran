# Python ETL & M0 Dataset Audit

See `../docs/etl-pipeline.md` and `../docs/data-source-mapping.md`.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## M0 Audit Helper

Compute SHA-256 checksums and inspect candidate source files placed in `sources/`:

```bash
python3 -m etl.m0_audit --sources-dir sources
```
