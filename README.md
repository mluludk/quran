# Digital Mushaf & Quran Word Explorer

Offline-first (mobile) and web-first (Next.js) Digital Mushaf for **Mushaf Madinah (Hafs, 604 pages, 15 lines)** with word-level selection, Indonesian word-by-word translation, and linguistic morphology (root, lemma, POS).

## Repository Structure

```text
.
├── PRD.md                    # Product Requirements Document
├── docs/                     # Architecture, schema, API, ETL, QA & licensing docs
├── migrations/               # PostgreSQL migrations
├── etl/                      # Python ETL & M0 dataset audit scripts
├── api/                      # Go / Fiber REST API (/api/v1)
├── web/                      # Next.js (TypeScript) web reader & Word Explorer
├── app/                      # Flutter mobile app (M3-Mobile)
└── docker-compose.yml        # Local PostgreSQL
```

## Quickstart (Local Dev)

1. Copy `.env.example` to `.env` and start PostgreSQL:
   ```bash
   cp .env.example .env
   docker compose up -d
   ```
2. Apply initial schema:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_initial_schema.sql
   ```
3. Run Go API:
   ```bash
   cd api && go run ./cmd/server
   ```
4. Run Next.js Web:
   ```bash
   cd web && npm install && npm run dev
   ```

## Documentation

Start with [PRD.md](./PRD.md) and [docs/development-roadmap.md](./docs/development-roadmap.md).
Note: **M0 (Source Audit & Licensing)** is a required gate before redistributing any dataset or font.
