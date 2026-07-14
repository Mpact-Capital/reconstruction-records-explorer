-- Broadens full-text search to include the AI-generated caption and photo
-- description, not just the title/OCR-HTR text. Without this, "themes or
-- events" only visible in a photograph's caption (rather than literal
-- catalog/OCR text) were invisible to search.
ALTER TABLE records DROP COLUMN text_tsv;

ALTER TABLE records ADD COLUMN text_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector(
        'english',
        coalesce(title, '') || ' ' ||
        coalesce(text, '') || ' ' ||
        coalesce(caption, '') || ' ' ||
        coalesce(photo_description, '')
    )
) STORED;

CREATE INDEX IF NOT EXISTS idx_records_text_tsv ON records USING GIN (text_tsv);
