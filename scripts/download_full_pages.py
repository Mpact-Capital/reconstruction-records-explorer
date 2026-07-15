"""CLI: download_full_pages --source nara [--max-records N] [--concurrency 8]

Downloads every page image of each harvested NARA volume (not just the one
representative page used for analysis), so the dashboard can offer a full
page-by-page viewer. Resumable: skips pages already on disk, and skips
volumes whose pages_downloaded already equals total_pages.

This re-fetches each record's full digitalObjects list directly (the
record.json's own `image_urls` is capped at 200 entries -- fine for
analysis, not for a complete download).
"""

import argparse
import asyncio
import glob
import json
import logging
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

from harvesters.base import RAW_ROOT

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("download_full_pages")

SEARCH_URL = "https://catalog.archives.gov/api/v2/records/search"


async def fetch_full_object_list(client: httpx.AsyncClient, na_id: str) -> list[str]:
    resp = await client.get(SEARCH_URL, params={"naId": na_id, "limit": 1})
    resp.raise_for_status()
    body = resp.json()["body"]
    hits = body.get("hits", {}).get("hits", [])
    if not hits:
        return []
    rec = hits[0]["_source"]["record"]
    return [o["objectUrl"] for o in rec.get("digitalObjects", []) if o.get("objectUrl")]


async def download_one_page(client: httpx.AsyncClient, url: str, dest: Path, sem: asyncio.Semaphore) -> bool:
    if dest.exists():
        return True
    async with sem:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            return True
        except Exception:
            logger.exception("Failed to download %s", url)
            return False


async def process_record(client: httpx.AsyncClient, path: str, sem: asyncio.Semaphore, stats: dict):
    with open(path, encoding="utf-8") as f:
        record = json.load(f)

    na_id = record["id"].removeprefix("nara-")
    record_dir = Path(path).parent
    pages_dir = record_dir / "pages"
    pages_dir.mkdir(exist_ok=True)

    urls = await fetch_full_object_list(client, na_id)
    if not urls:
        logger.warning("No digital objects found for %s", record["id"])
        return

    total = len(urls)
    tasks = []
    for i, url in enumerate(urls, 1):
        suffix = Path(url.split("#")[0]).suffix or ".jpg"
        dest = pages_dir / f"{i:04d}{suffix}"
        tasks.append(download_one_page(client, url, dest, sem))

    results = await asyncio.gather(*tasks)
    downloaded = sum(1 for r in results if r)

    record["total_pages"] = total
    record["pages_downloaded"] = downloaded
    # Store the complete per-page URL list (not the 200-entry cap used at
    # harvest time) so the dashboard's page viewer can link directly to
    # NARA's own hosted images -- no need to re-host our local copies.
    record["image_urls"] = urls
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2)

    stats["records_done"] += 1
    stats["pages_done"] += downloaded
    logger.info(
        "[%d/%d records] %s | %d/%d pages downloaded (total so far: %d pages)",
        stats["records_done"],
        stats["total_records"],
        record["id"],
        downloaded,
        total,
        stats["pages_done"],
    )


async def run(max_records: int, concurrency: int):
    api_key = os.getenv("NARA_API_KEY")
    if not api_key:
        raise SystemExit("NARA_API_KEY not set in .env")

    paths = sorted(glob.glob(str(RAW_ROOT / "nara" / "*" / "record.json")))

    to_process = []
    for path in paths:
        with open(path, encoding="utf-8") as f:
            record = json.load(f)
        total = record.get("total_pages")
        downloaded = record.get("pages_downloaded", 0)
        if total is not None and downloaded >= total:
            continue
        to_process.append(path)
        if len(to_process) >= max_records:
            break

    logger.info("Found %d records needing full-page download (of %d total)", len(to_process), len(paths))

    stats = {"records_done": 0, "pages_done": 0, "total_records": len(to_process)}
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        headers={"x-api-key": api_key, "User-Agent": "reconstruction-records-explorer/0.1"}, timeout=60.0
    ) as client:
        for path in to_process:
            try:
                await process_record(client, path, sem, stats)
            except Exception:
                logger.exception("Failed processing %s", path)

    logger.info("Done. %d records processed, %d total pages downloaded.", stats["records_done"], stats["pages_done"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-records", type=int, default=1000, dest="max_records")
    parser.add_argument("--concurrency", type=int, default=8)
    args = parser.parse_args()
    asyncio.run(run(args.max_records, args.concurrency))


if __name__ == "__main__":
    sys.exit(main())
