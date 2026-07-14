# Build Spec — Reconstruction Records Explorer

Instructions for Claude Code. Hand this file to Claude Code (`claude` in the
project directory, or paste as the initial prompt). It describes a data pipeline
+ interactive dashboard for searching and analyzing digitized Reconstruction-era
federal records — **treating the scanned images and their text as equal, linked
objects of analysis.**

---

## 0. Read this first — scope reality check

There is **no single .gov endpoint** that returns these records as clean
structured data. The records exist but are:
- spread across several institutions (NARA, Library of Congress, DPLA, Census),
- mostly **scanned page images with sparse metadata**, not full-text databases,
- subject to **rate limits** and, in some cases, **API keys**.

Therefore this is a **harvest → store → image+text analysis → index → serve**
pipeline, not a thin UI over one API. Build it in the phases below, incrementally,
with every stage resumable.

**Core goal:** the images are not just something to display or OCR and discard.
For each record the system should hold, link, and analyze **both** the page/photo
**image** and its **digital text** together — a handwritten Bureau ledger page,
a Freedman's Bank signature register, a newspaper scan, a photograph — so a user
can search text, inspect the source image, and run analysis that draws on both.

---

## 1. Data sources (verify each before coding)

| Source | Endpoint | Auth | Gives you |
|---|---|---|---|
| **NARA Catalog API** | `https://catalog.archives.gov/api/v2/records/search` | none | Freedmen's Bureau & Freedman's Bank (RG 105) images + metadata |
| **Library of Congress** | `https://www.loc.gov/search/?fo=json` ; Chronicling America `https://chroniclingamerica.loc.gov/search/pages/results/?format=json` | none | Historical newspapers, full-text OCR already available |
| **DPLA** | `https://api.dp.la/v2/items` | free key | Federated NARA+LoC+university collections in one schema |
| **Census / IPUMS** | `https://api.census.gov/data` ; IPUMS USA extracts | free key | Structured tenure/demographic data (land ownership, farm tenure) |
| **Smithsonian Open Access** | `https://api.si.edu/openaccess/api/v1.0/search` | free key | NMAAHC objects/images |

> **First task for Claude Code:** write `scripts/probe_sources.py` that hits each
> endpoint with a 1-record query and prints the response schema + rate-limit
> headers. Confirm the contract before building harvesters. Endpoints and field
> names change — do not trust this table blindly, verify.

Respect each source's terms of service and `robots.txt`. Chronicling America
already provides OCR text, so prefer it over re-OCRing newspaper images.

---

## 2. Architecture

```
sources ──> harvester (async, rate-limited, resumable)
                │
                ▼
        raw store (object storage / local FS: images + JSON metadata)
                │
                ▼
        analysis workers (run per record, results linked to it):
          • text: use native text if present, else OCR/HTR the image
          • image: caption, classify, detect layout/tables, extract
            entities, transcribe handwriting, describe photographs
          • cross-modal: reconcile text against image; flag mismatches
                │
                ▼
        search index (OpenSearch/Elasticsearch OR Postgres + pgvector)
          text embeddings + image embeddings, both linked to the record
                │
                ├──> REST/GraphQL API (FastAPI)
                │
                ▼
        dashboard (Next.js/React) — search, facets, image+text viewer, analysis
```

**Stack recommendation** (adjust to your environment):
- Harvest: **Python** (`httpx` async, `tenacity` retries).
- Text from images: **OCR** for print (`tesseract`/`ocrmypdf`); for **handwritten**
  Bureau/Bank records use a **handwriting/vision model** — Tesseract will not read cursive.
- Image analysis: a **vision-language model** for captioning, layout/table detection,
  photograph description, and entity extraction; store structured results per record.
- Store: local FS or S3-compatible object storage; metadata + analysis in **Postgres**.
- Index: **OpenSearch** for full-text; **pgvector** or an OpenSearch k-NN field for
  **both text and image embeddings**, so search can be lexical, semantic, or by-image.
- API: **FastAPI**.
- Frontend: **Next.js + React**, TanStack Query, **OpenSeadragon** for deep-zoom scans
  with the ability to overlay OCR/HTR bounding boxes on the image.

---

## 3. Build phases (implement in order; each must run standalone)

### Phase 1 — Probe & schema
- `scripts/probe_sources.py` (see §1).
- Define a **unified record schema** all sources map into:
  `{ id, source, title, date, collection, record_group, people[], places[],
  image_urls[], text, text_source (native|ocr|htr),
  image_analysis { caption, doc_type, layout, tables[], photo_description, entities[] },
  text_embedding[], image_embedding[], rights, source_url, ingested_at }`.
  The record links image and text as one object — neither is discarded.

### Phase 2 — Harvester
- One module per source under `harvesters/`, each yielding unified records **with their image URLs**.
- **Async with a concurrency cap; honor rate-limit headers; exponential backoff** (`tenacity`).
- Download images to the raw store (respecting rights/ToS); record the local/object path on the record.
- **Checkpointing:** persist a cursor per source so runs resume, never restart.
- **Idempotent upserts** keyed on `(source, id)`.
- CLI: `harvest --source nara --query "Freedmen's Bureau" --with-images --max 5000`.

### Phase 3 — Image + text analysis (the core stage)
Run per record; every result is stored **linked to that record**, alongside its image.
- **Text layer:** if the source supplies native text (most newspapers), keep it. Otherwise
  extract it from the image — **OCR for printed** matter, a **handwriting/vision model (HTR)**
  for the handwritten Bureau ledgers, Bank registers, and marriage/labor records. Tag
  `text_source` as `native|ocr|htr`. Keep **bounding boxes** so text maps to image regions.
- **Image layer:** for each image run a vision-language model to produce a **caption**,
  a **document-type / layout classification** (ledger, register, letter, form, photograph),
  **table extraction** where the page is tabular (bank ledgers, ration rolls), and for
  **photographs** a description. Extract **named entities** (people, places, dates, dollar amounts).
- **Cross-modal reconciliation:** compare extracted text against the image analysis and
  **flag low-confidence pages and text/image mismatches** for human review.
- **Embeddings:** compute a **text embedding** and an **image embedding** per record for
  semantic and visual search. Run this as an independent, resumable worker so it never
  blocks harvesting; log per-record time/cost.

### Phase 4 — Index & API
- Bulk-load into OpenSearch: full-text + facets (collection, record_group, date, place,
  people, **doc_type**), plus **k-NN fields for text and image embeddings**.
- FastAPI endpoints: `/search` (lexical + semantic + **search-by-image**, facets, pagination),
  `/record/{id}` (returns text, image URL, image_analysis, bounding boxes),
  `/aggregate` (counts over time/place/doc_type for the analysis views).
- **Cursor/`search_after` pagination** — offset pagination breaks past ~10k hits.

### Phase 5 — Dashboard
- **Search view:** query box (toggle lexical / semantic / by-image), faceted filters,
  result list with thumbnails and highlighted snippets.
- **Record view (image + text side by side):** deep-zoom scan (OpenSeadragon) with
  **OCR/HTR bounding-box overlays**, the transcribed/native text beside it, extracted
  tables and entities, the image caption/description, a **confidence flag** where analysis
  was uncertain, metadata panel, and a link to the authoritative source.
- **Analysis view:** volume-over-time, geographic distribution, doc-type breakdown,
  top people/places — driven by `/aggregate`, computed server-side.
- **Saved searches / export** (CSV of metadata + analysis; never rehost images beyond rights terms).

---

## 4. Analysis cost & quality guardrails (do not skip)

- **Image analysis is the expensive stage.** Vision/HTR calls cost time and money per page,
  so run analysis as an independent, **resumable, rate-limited** worker — a crash mid-batch
  must not restart from zero. Log throughput and estimated cost.
- **Handwriting ≠ OCR.** Tesseract cannot read cursive Bureau/Bank records; route handwritten
  pages to an HTR/vision model and expect lower accuracy — surface confidence, don't hide it.
- Store each image **once**; the dashboard streams from object storage / IIIF and does not copy.
- Aggregation for the analysis view is **server-side**; the UI paginates result sets.
- Start with **one record group** (e.g. RG 105 Freedman's Bank signature registers) end-to-end
  — harvest, image analysis, index, view — before scaling to more collections.

---

## 5. Accuracy, provenance & ethics

- Every displayed record **links back to its authoritative source URL** and shows its rights statement.
- Mark OCR/HTR text and image analysis as **machine-generated and potentially inaccurate**;
  always show the page image beside the extracted text so users verify against the source.
- Handwriting transcription and photo description will contain errors — present confidence
  and never let a model's reading of a record silently stand in for the record itself.
- Do not assert derived statistics as fact without citing the underlying records; distinguish
  "records matching query" (a count you can prove) from historical claims (which need scholarship).
- This material includes records of enslaved and freed people and racial violence. Handle names
  and personal data respectfully; follow each institution's guidance on sensitive collections.

---

## 6. First commands for Claude Code

```
1. Read this file fully.
2. Create the repo skeleton (harvesters/, analysis/, scripts/, api/, web/, docker-compose for Postgres+OpenSearch).
3. Write and run scripts/probe_sources.py — STOP and show me the real schemas + image URL formats before building harvesters.
4. Implement Phase 2 for NARA only (RG 105 Freedman's Bank), harvest 200 records WITH their images.
5. Implement Phase 3 on those 200: OCR/HTR the text, run image analysis, link both to each record.
6. Report throughput, transcription accuracy on handwritten pages, and any text/image mismatches before proceeding.
```

Build one vertical slice — harvest, image+text analysis, index, and a working
record view showing the scan beside its transcription — before scaling to more
collections. Confirm each source's real API contract and image-delivery format
against live responses; treat every endpoint and field name here as unverified
until `probe_sources.py` proves it.
