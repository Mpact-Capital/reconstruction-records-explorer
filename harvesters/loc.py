"""Library of Congress harvester (loc.gov JSON API — also serves the former
Chronicling America collection since its 2025 API retirement, via
`https://www.loc.gov/collections/chronicling-america/`).

No API key required. Confirmed schema via scripts/probe_sources.py.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path

from harvesters.base import Checkpoint, RateLimitedClient, RawStore
from harvesters.schema import TextSource, UnifiedRecord

logger = logging.getLogger("harvesters.loc")

SEARCH_URL = "https://www.loc.gov/search/"
SOURCE_NAME = "loc"


def _map_record(item: dict) -> UnifiedRecord:
    image_urls = item.get("image_url") or []
    description = item.get("description") or []
    text = "\n".join(description) if isinstance(description, list) else str(description or "")

    rights = (item.get("item") or {}).get("rights_information") or (item.get("item") or {}).get("rights_advisory")
    if not rights:
        rights = "Access restricted" if item.get("access_restricted") else "No rights statement provided by LoC catalog record"

    return UnifiedRecord(
        id=item.get("id") or item.get("url") or "",
        source=SOURCE_NAME,
        title=item.get("title"),
        date=item.get("date") or (item.get("dates") or [None])[0],
        collection=", ".join(item.get("partof") or []) or None,
        record_group=None,
        people=item.get("contributor") or [],
        places=[],
        image_urls=list(image_urls),
        text=text or None,
        text_source=TextSource.NATIVE if text else None,
        rights=rights,
        source_url=item.get("id") or item.get("url"),
        ingested_at=datetime.now(timezone.utc),
        raw=item,
    )


async def harvest_loc(
    query: str,
    max_records: int = 200,
    with_images: bool = True,
    per_page: int = 25,
    collection_path: str = "search",
) -> AsyncIterator[UnifiedRecord]:
    """Yields UnifiedRecord for `query`, resuming from the last checkpointed
    page. `collection_path='collections/chronicling-america'` targets that
    collection instead of the general catalog search."""

    checkpoint = Checkpoint(SOURCE_NAME)
    store = RawStore(SOURCE_NAME)
    client = RateLimitedClient(concurrency=2, delay_seconds=1.5)

    start_page = checkpoint.get(f"page::{query}", 1)
    yielded = checkpoint.get(f"count::{query}", 0)

    base_url = f"https://www.loc.gov/{collection_path}/"

    try:
        page = start_page
        while yielded < max_records:
            resp = await client.get(
                base_url,
                params={"q": query, "fo": "json", "c": per_page, "sp": page},
            )
            body = resp.json()
            results = body.get("results") or []
            if not results:
                logger.info("No more results at page %d for query=%r", page, query)
                break

            for item in results:
                if yielded >= max_records:
                    break
                record = _map_record(item)
                if not record.id:
                    continue

                # A record already on disk may carry a downloaded image and/or
                # Phase 3 analysis from an earlier harvest (overlapping
                # queries can re-match the same id). Leave it untouched
                # rather than re-saving a blank reconstruction over it.
                existing = store.load(record.id)
                if existing is not None:
                    yielded += 1
                    yield existing
                    continue

                if with_images and record.image_urls:
                    # store the single largest-resolution image (last in the list)
                    largest_url = record.image_urls[-1].split("#", 1)[0]
                    try:
                        content = await client.download(largest_url)
                        # LoC serves some images as .gif regardless of the
                        # URL's own extension; keep whatever the URL says
                        # here purely for a readable filename -- analysis
                        # sniffs the real format from file bytes, not this.
                        suffix = Path(largest_url).suffix or ".jpg"
                        img_path = store.image_path(record.id, 0, suffix)
                        img_path.write_bytes(content)
                        record.local_image_paths = [str(img_path)]
                    except Exception:
                        logger.exception("Image download failed for %s", record.id)

                store.save_record(record)
                yielded += 1
                yield record

            page += 1
            checkpoint.save(**{f"page::{query}": page, f"count::{query}": yielded})
    finally:
        await client.aclose()
