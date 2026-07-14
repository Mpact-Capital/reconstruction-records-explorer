# Reconstruction Records Explorer

Harvest → store → image+text analysis → index → serve pipeline for digitized
Reconstruction-era federal records (NARA, Library of Congress, DPLA, Census,
Smithsonian). Treats each record's scanned image and its text as linked
objects — see [BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md) for the full spec.

## Status

Vertical slice complete end-to-end on **Library of Congress** (Freedmen's
Bureau materials): harvest → Claude vision analysis (OCR/HTR, captioning,
entity extraction incl. structured financial mentions) → Postgres → FastAPI
→ Next.js dashboard (search, record view, per-person financial profile,
analysis view). ~195 records, ~192 analyzed (a couple hit Anthropic's
content-safety filter or a corrupt source image — expected, not a bug).

**NARA** (the spec's primary RG 105 target) is still blocked on requesting an
API key from Catalog_API@nara.gov (see §1 of `BUILD_INSTRUCTIONS.md`) — swap
it in via a new `harvesters/nara.py` once the key arrives. **DPLA / Census /
Smithsonian** keys are live and probed (see `.env`) but no harvester is built
for them yet. Embeddings / semantic search (Phase 3 cont'd, Phase 4 pgvector)
are not implemented.

## Layout

- `harvesters/` — one module per source, async + resumable (`loc.py` live)
- `analysis/` — Claude vision analysis (`vision.py`); embeddings not yet built
- `scripts/` — `probe_sources.py`, `harvest.py`, `analyze.py`, `load_to_postgres.py`
- `db/schema.sql` — Postgres schema (records/entities/record_tables)
- `api/` — FastAPI service (`/search`, `/record/{id}`, `/person/{name}`, `/aggregate`)
- `web/` — Next.js dashboard
- `docs/` — supporting notes

## Local setup

This machine runs Postgres **natively** (installed via winget), not via
Docker — Docker Desktop hit an unrecoverable stuck-socket bug that needs a
reboot to clear; switch to `docker-compose.yml` after rebooting if preferred.

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in DPLA / Census / Smithsonian / Anthropic / Postgres DSN

# Postgres (native): ensure the postgresql-x64-17 service is running, then:
psql -U rre -h localhost -d rre -f db/schema.sql

python -m scripts.harvest --source loc --query "Freedmen's Bureau" --max 200 --with-images
python -m scripts.analyze --source loc --max 200 --concurrency 4
python -m scripts.load_to_postgres --source loc

uvicorn api.main:app --port 8000          # backend
cd web && npm run dev                     # dashboard at localhost:3000
```

Note: the Postgres Windows service (`postgresql-x64-17`) may need to be
started manually after a reboot (`Start-Service postgresql-x64-17`, as
Administrator) if it doesn't auto-start.
