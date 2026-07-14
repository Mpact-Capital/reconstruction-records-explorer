-- Reconstruction Records Explorer -- Phase 4 index schema.
-- Postgres + pgvector chosen over OpenSearch (BUILD_INSTRUCTIONS.md §2 lists
-- either as valid); full-text via tsvector covers lexical search at this
-- scale, and the relational model is what a per-person financial profile
-- (person <-> dollar amounts <-> records) actually needs -- that's a set of
-- joins, not a facet search.

-- pgvector is added once the embeddings stage (Phase 3 cont'd) is actually
-- implemented; not installed on this native Windows Postgres yet.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT,
    date TEXT,
    collection TEXT,
    collection_group TEXT,
    record_group TEXT,
    text TEXT,
    text_source TEXT,
    rights TEXT,
    source_url TEXT,
    ingested_at TIMESTAMPTZ,
    image_url TEXT,
    local_image_path TEXT,
    doc_type TEXT,
    caption TEXT,
    layout TEXT,
    photo_description TEXT,
    analysis_confidence REAL,
    mismatch_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    text_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'english',
            coalesce(title, '') || ' ' ||
            coalesce(text, '') || ' ' ||
            coalesce(caption, '') || ' ' ||
            coalesce(photo_description, '')
        )
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_records_text_tsv ON records USING GIN (text_tsv);
CREATE INDEX IF NOT EXISTS idx_records_doc_type ON records (doc_type);
CREATE INDEX IF NOT EXISTS idx_records_collection_group ON records (collection_group);
CREATE INDEX IF NOT EXISTS idx_records_source ON records (source);
CREATE INDEX IF NOT EXISTS idx_records_date ON records (date);

-- One row per extracted entity (person/place/date/amount/organization).
-- `normalized_value`/`associated_person_normalized` are lowercased +
-- whitespace-collapsed for cross-record person grouping -- an
-- approximation given OCR/HTR spelling variance, not exact-match identity.
CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records (id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    amount_usd NUMERIC,
    associated_person TEXT,
    associated_person_normalized TEXT
);

CREATE INDEX IF NOT EXISTS idx_entities_record_id ON entities (record_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (type);
CREATE INDEX IF NOT EXISTS idx_entities_normalized_value ON entities USING GIN (normalized_value gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_entities_associated_person_normalized
    ON entities USING GIN (associated_person_normalized gin_trgm_ops);

CREATE TABLE IF NOT EXISTS record_tables (
    id SERIAL PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records (id) ON DELETE CASCADE,
    caption TEXT,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_record_tables_record_id ON record_tables (record_id);
