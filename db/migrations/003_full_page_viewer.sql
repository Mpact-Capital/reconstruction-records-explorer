-- Supports the full-document page viewer: total page count for a volume,
-- and the complete per-page image URL list (NARA-hosted, we link directly
-- rather than re-hosting our local archival copies).
ALTER TABLE records ADD COLUMN IF NOT EXISTS total_pages INTEGER;
ALTER TABLE records ADD COLUMN IF NOT EXISTS pages_downloaded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE records ADD COLUMN IF NOT EXISTS page_urls JSONB;
