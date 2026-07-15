"""NARA Catalog API v2 harvester.

Requires NARA_API_KEY (x-api-key header) -- request via email to
Catalog_API@nara.gov, no self-serve signup. Confirmed schema via direct
API + swagger.json inspection (scripts/probe_sources.py's original guess
was wrong on several fields -- see BUILD_INSTRUCTIONS.md §1 warning that
endpoints/fields must be verified, not trusted from the spec table).

Important scope note: at this Bureau-of-Refugees-Freedmen-and-Abandoned-Lands
field-office level, a single search result ("file unit") is often an entire
bound volume -- e.g. a "Registered Letters Received" ledger can have 800-1400+
page images. Downloading/analyzing every page of every volume would cost
tens of dollars per volume. To keep cost proportional to record count (as
with the LoC harvester), each NARA record here represents one volume, and
only its FIRST page is downloaded and analyzed as a representative sample --
`local_image_paths` and Phase 3 analysis reflect page 1 only, not the full
volume. `image_urls` stores up to 50 of the volume's page URLs for
reference/future per-page browsing, not all of them.
"""

from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path

from harvesters.base import Checkpoint, RateLimitedClient, RawStore
from harvesters.schema import TextSource, UnifiedRecord

logger = logging.getLogger("harvesters.nara")

SEARCH_URL = "https://catalog.archives.gov/api/v2/records/search"
SOURCE_NAME = "nara"

MAX_STORED_IMAGE_URLS = 200


def _find_record_group_number(ancestors: list[dict]) -> str | None:
    # For BRFAL field-office microfilm, this is usually RG 64 (NARA's own
    # cataloging record group for microfilm publications), not RG 105 (the
    # creating agency, Bureau of Refugees, Freedmen, and Abandoned Lands) --
    # both are accurate, they just describe different things (the microfilm
    # reproduction vs. the original paper records). The BRFAL/RG 105
    # association is conveyed via `collection` (the microform title) instead.
    for a in ancestors or []:
        if a.get("levelOfDescription") == "recordGroup" and a.get("recordGroupNumber") is not None:
            return str(a["recordGroupNumber"])
    return None


_FIELD_OFFICE_RE = re.compile(r"^(Subordinate Field Offices|Office[s]? of (?:the )?[\w\s]+),\s*([^(,]+)")


def classify_collection(title: str | None, microform_title: str | None) -> tuple[str, str]:
    """(group, detail) for the collection dropdown, grouping NARA field-office
    volumes by the office named at the start of the title (e.g. "Staunton",
    "Boydton (Mecklenburg County)") rather than lumping everything under one
    generic bucket -- mirrors harvesters/collections.py's role for LoC, but
    NARA's title convention is different enough to need its own logic."""
    if not title:
        return (microform_title or "NARA", microform_title or "NARA")
    m = _FIELD_OFFICE_RE.match(title)
    if m:
        return (f"Field Office: {m.group(2).strip()}", title)
    return (microform_title or "NARA", title)


def _representative_page_url(image_urls: list[str]) -> str:
    # Each microfilm roll segment leads with a standardized NARA
    # publication title/seal card as its first frame -- confirmed
    # empirically (9/10 in an initial batch were blank cover slides, not
    # record content). Page 2 is the real first content page when present.
    return image_urls[1] if len(image_urls) > 1 else image_urls[0]


def _map_record(item: dict, api_key: str) -> UnifiedRecord:
    rec = item["record"]
    na_id = rec.get("naId")
    digital_objects = rec.get("digitalObjects") or []
    image_urls = [o["objectUrl"] for o in digital_objects if o.get("objectUrl")][:MAX_STORED_IMAGE_URLS]

    microforms = rec.get("microformPublications") or []
    collection = microforms[0].get("title") if microforms else None

    restriction = (rec.get("useRestriction") or {}).get("status")
    rights = f"{restriction} (National Archives and Records Administration)" if restriction else "See NARA catalog record for rights status"

    date = None
    start = rec.get("coverageStartDate") or {}
    if start.get("logicalDate"):
        date = start["logicalDate"]
    else:
        # Volume-level descriptions (the common case for BRFAL field-office
        # microfilm) often have no structured coverage dates at all -- the
        # date range only exists as free text in the title, e.g. "...October
        # 1865-December 1866 THRU ... 1867-1868". Fall back to the min/max
        # 4-digit year mentioned there.
        years = sorted(set(re.findall(r"\b(18\d{2}|19\d{2})\b", rec.get("title") or "")))
        if years:
            date = years[0] if len(years) == 1 else f"{years[0]}-{years[-1]}"

    return UnifiedRecord(
        id=f"nara-{na_id}",
        source=SOURCE_NAME,
        title=rec.get("title"),
        date=date,
        collection=collection,
        record_group=_find_record_group_number(rec.get("ancestors") or []),
        image_urls=image_urls,
        text=None,
        text_source=None,
        rights=rights,
        source_url=f"https://catalog.archives.gov/id/{na_id}",
        ingested_at=datetime.now(timezone.utc),
        raw=rec,
    )


async def harvest_nara(
    query: str,
    microform_id: str | None = None,
    max_records: int = 50,
    with_images: bool = True,
    per_page: int = 20,
) -> AsyncIterator[UnifiedRecord]:
    """Yields UnifiedRecord for `query` (optionally scoped to a specific
    microform publication, e.g. "M1913" for the Virginia BRFAL field
    offices), resuming from the last checkpointed page."""

    api_key = None
    import os

    from dotenv import load_dotenv

    load_dotenv()
    api_key = os.getenv("NARA_API_KEY")
    if not api_key:
        raise RuntimeError("NARA_API_KEY not set in .env")

    checkpoint_key = f"{query}::{microform_id or ''}"
    checkpoint = Checkpoint(SOURCE_NAME)
    store = RawStore(SOURCE_NAME)
    client = RateLimitedClient(
        base_headers={"x-api-key": api_key, "User-Agent": "reconstruction-records-explorer/0.1"},
        concurrency=2,
        delay_seconds=1.0,
    )

    start_page = checkpoint.get(f"page::{checkpoint_key}", 1)
    yielded = checkpoint.get(f"count::{checkpoint_key}", 0)

    try:
        page = start_page
        while yielded < max_records:
            params = {
                "q": query,
                "limit": per_page,
                "page": page,
                "availableOnline": "true",
            }
            if microform_id:
                params["microformPublicationsIdentifier"] = microform_id

            resp = await client.get(SEARCH_URL, params=params)
            body = resp.json()["body"]
            hits = body.get("hits", {}).get("hits", [])
            if not hits:
                logger.info("No more results at page %d for query=%r", page, query)
                break

            for item in hits:
                if yielded >= max_records:
                    break
                record = _map_record(item["_source"], api_key)
                if not record.raw.get("naId"):
                    continue

                # A record already on disk may carry a downloaded image and/or
                # Phase 3 analysis from an earlier harvest (queries can overlap
                # -- e.g. a volume spanning multiple field offices matches more
                # than one office's search). Leave it untouched rather than
                # re-saving a blank reconstruction that would clobber both.
                existing = store.load(record.id)
                if existing is not None:
                    yielded += 1
                    yield existing
                    continue

                if with_images and record.image_urls:
                    first_page_url = _representative_page_url(record.image_urls)
                    try:
                        content = await client.download(first_page_url)
                        suffix = Path(first_page_url).suffix or ".jpg"
                        img_path = store.image_path(record.id, 0, suffix)
                        img_path.write_bytes(content)
                        record.local_image_paths = [str(img_path)]
                    except Exception:
                        logger.exception("Image download failed for %s", record.id)

                store.save_record(record)
                yielded += 1
                yield record

            page += 1
            checkpoint.save(**{f"page::{checkpoint_key}": page, f"count::{checkpoint_key}": yielded})
    finally:
        await client.aclose()


async def harvest_nara_by_ids(na_ids: list[int], with_images: bool = True) -> AsyncIterator[UnifiedRecord]:
    """Fetch specific, already-verified NARA IDs directly -- for when the
    free-text relevance search has been checked against the full result set
    (title + scopeAndContentNote) and only a known subset genuinely matches,
    rather than trusting query relevance ranking (see BUILD_INSTRUCTIONS.md
    §1: verify, don't trust, and the same lesson learned harvesting LoC)."""

    import os

    from dotenv import load_dotenv

    load_dotenv()
    api_key = os.getenv("NARA_API_KEY")
    if not api_key:
        raise RuntimeError("NARA_API_KEY not set in .env")

    store = RawStore(SOURCE_NAME)
    client = RateLimitedClient(
        base_headers={"x-api-key": api_key, "User-Agent": "reconstruction-records-explorer/0.1"},
        concurrency=2,
        delay_seconds=1.0,
    )

    try:
        resp = await client.get(SEARCH_URL, params={"naId": ",".join(str(i) for i in na_ids), "limit": len(na_ids)})
        body = resp.json()["body"]
        hits = body.get("hits", {}).get("hits", [])

        for item in hits:
            record = _map_record(item["_source"], api_key)
            if not record.raw.get("naId"):
                continue

            existing = store.load(record.id)
            if existing is not None:
                yield existing
                continue

            if with_images and record.image_urls:
                first_page_url = record.image_urls[0]
                try:
                    content = await client.download(first_page_url)
                    suffix = Path(first_page_url).suffix or ".jpg"
                    img_path = store.image_path(record.id, 0, suffix)
                    img_path.write_bytes(content)
                    record.local_image_paths = [str(img_path)]
                except Exception:
                    logger.exception("Image download failed for %s", record.id)

            store.save_record(record)
            yield record
    finally:
        await client.aclose()
