-- Adds a top-level collection_group column alongside the existing
-- `collection` column. `collection` is repopulated by the loader (from
-- harvesters/collections.py's classify()) to hold a short, specific label
-- instead of the raw comma-joined partof tags -- the loader re-derives both
-- from `raw` so this migration itself does no data backfill.
ALTER TABLE records ADD COLUMN IF NOT EXISTS collection_group TEXT;
CREATE INDEX IF NOT EXISTS idx_records_collection_group ON records (collection_group);
