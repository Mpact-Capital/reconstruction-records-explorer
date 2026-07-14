"""CLI: load_to_postgres --source loc

Reads every harvested+analyzed record from data/raw/<source>/*/record.json
and upserts it into Postgres (records/entities/record_tables), so the API
and dashboard have something structured and queryable to sit on top of.
Idempotent: re-running replaces each record's entities/tables in full.
"""

import argparse
import glob
import json
import logging
import os
import re
import sys

import psycopg
from dotenv import load_dotenv

from harvesters.base import RAW_ROOT
from harvesters.collections import classify as classify_collection

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("load_to_postgres")


def normalize(value):
    if not value:
        return None
    return re.sub(r"\s+", " ", value.strip().lower())


def load_record(conn, record: dict):
    ia = record.get("image_analysis") or {}
    image_urls = record.get("image_urls") or []
    local_paths = record.get("local_image_paths") or []

    raw = record.get("raw") or {}
    collection_group, collection_detail = classify_collection(raw.get("partof"))

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO records (
                id, source, title, date, collection, collection_group, record_group, text, text_source,
                rights, source_url, ingested_at, image_url, local_image_path,
                doc_type, caption, layout, photo_description, analysis_confidence,
                mismatch_flags, raw, updated_at
            ) VALUES (
                %(id)s, %(source)s, %(title)s, %(date)s, %(collection)s, %(collection_group)s, %(record_group)s,
                %(text)s, %(text_source)s, %(rights)s, %(source_url)s, %(ingested_at)s,
                %(image_url)s, %(local_image_path)s, %(doc_type)s, %(caption)s, %(layout)s,
                %(photo_description)s, %(analysis_confidence)s, %(mismatch_flags)s, %(raw)s, now()
            )
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, date = EXCLUDED.date, collection = EXCLUDED.collection,
                collection_group = EXCLUDED.collection_group,
                record_group = EXCLUDED.record_group, text = EXCLUDED.text,
                text_source = EXCLUDED.text_source, rights = EXCLUDED.rights,
                source_url = EXCLUDED.source_url, ingested_at = EXCLUDED.ingested_at,
                image_url = EXCLUDED.image_url, local_image_path = EXCLUDED.local_image_path,
                doc_type = EXCLUDED.doc_type, caption = EXCLUDED.caption, layout = EXCLUDED.layout,
                photo_description = EXCLUDED.photo_description,
                analysis_confidence = EXCLUDED.analysis_confidence,
                mismatch_flags = EXCLUDED.mismatch_flags, raw = EXCLUDED.raw, updated_at = now()
            """,
            {
                "id": record["id"],
                "source": record["source"],
                "title": record.get("title"),
                "date": record.get("date"),
                "collection": collection_detail,
                "collection_group": collection_group,
                "record_group": record.get("record_group"),
                "text": record.get("text"),
                "text_source": record.get("text_source"),
                "rights": record.get("rights"),
                "source_url": record.get("source_url"),
                "ingested_at": record.get("ingested_at"),
                "image_url": image_urls[-1] if image_urls else None,
                "local_image_path": local_paths[0] if local_paths else None,
                "doc_type": ia.get("doc_type"),
                "caption": ia.get("caption"),
                "layout": ia.get("layout"),
                "photo_description": ia.get("photo_description"),
                "analysis_confidence": ia.get("confidence"),
                "mismatch_flags": json.dumps(ia.get("mismatch_flags", [])),
                "raw": json.dumps(record.get("raw", {})),
            },
        )

        cur.execute("DELETE FROM entities WHERE record_id = %s", (record["id"],))
        for e in ia.get("entities", []):
            cur.execute(
                """
                INSERT INTO entities (record_id, type, value, normalized_value, amount_usd, associated_person, associated_person_normalized)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    record["id"],
                    e.get("type"),
                    e.get("value"),
                    normalize(e.get("value")),
                    e.get("amount_usd"),
                    e.get("associated_person"),
                    normalize(e.get("associated_person")),
                ),
            )

        cur.execute("DELETE FROM record_tables WHERE record_id = %s", (record["id"],))
        for t in ia.get("tables", []):
            cur.execute(
                "INSERT INTO record_tables (record_id, caption, rows) VALUES (%s, %s, %s)",
                (record["id"], t.get("caption"), json.dumps(t.get("rows", []))),
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    args = parser.parse_args()

    dsn = os.getenv("POSTGRES_DSN")
    if not dsn:
        raise SystemExit("POSTGRES_DSN not set in .env")

    paths = sorted(glob.glob(str(RAW_ROOT / args.source / "*" / "record.json")))
    logger.info("Loading %d records for source=%s", len(paths), args.source)

    with psycopg.connect(dsn) as conn:
        for i, path in enumerate(paths, 1):
            with open(path, encoding="utf-8") as f:
                record = json.load(f)
            load_record(conn, record)
            if i % 25 == 0 or i == len(paths):
                logger.info("[%d/%d] loaded", i, len(paths))
        conn.commit()

    logger.info("Done.")


if __name__ == "__main__":
    sys.exit(main())
