"""CLI: analyze --source loc --max 200 --concurrency 3

Phase 3 worker: runs vision analysis over harvested records that have a
local image and haven't been analyzed yet (skips records where
image_analysis is already set, so a crash/interrupt is resumable for free
by just re-running this command).
"""

import argparse
import asyncio
import glob
import json
import logging
import os
import sys

import anthropic
from dotenv import load_dotenv

from analysis.vision import AnalysisCost, analyze_record
from harvesters.base import RAW_ROOT
from harvesters.schema import UnifiedRecord

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("analyze")


async def worker(queue: asyncio.Queue, client: anthropic.AsyncAnthropic, cost: AnalysisCost, stats: dict):
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
        path, record = item
        try:
            record = await analyze_record(client, record, cost=cost)
            with open(path, "w", encoding="utf-8") as f:
                f.write(record.model_dump_json(indent=2, exclude_none=False))
            stats["done"] += 1
            conf = record.image_analysis.confidence if record.image_analysis else None
            logger.info(
                "[%d/%d] %s | doc_type=%s conf=%s | %s",
                stats["done"],
                stats["total"],
                record.id,
                record.image_analysis.doc_type if record.image_analysis else None,
                conf,
                cost,
            )
            if record.image_analysis and record.image_analysis.mismatch_flags:
                stats["mismatches"].append((record.id, record.image_analysis.mismatch_flags))
        except Exception:
            logger.exception("Analysis failed for %s", path)
            stats["errors"] += 1
        finally:
            queue.task_done()


async def run(source: str, max_records: int, concurrency: int, force: bool = False):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY not set in .env")

    record_paths = sorted(glob.glob(str(RAW_ROOT / source / "*" / "record.json")))

    to_process = []
    skipped_no_image = 0
    skipped_done = 0
    for path in record_paths:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        had_analysis = raw.get("image_analysis") is not None
        stale_schema = had_analysis and any(
            not isinstance(e, dict) for e in raw["image_analysis"].get("entities", [])
        )
        if force or stale_schema:
            # discard any previous (possibly schema-incompatible) analysis
            raw["image_analysis"] = None
            if stale_schema:
                had_analysis = False
        record = UnifiedRecord.model_validate(raw)
        if not record.local_image_paths:
            skipped_no_image += 1
            continue
        if had_analysis and not force:
            skipped_done += 1
            continue
        to_process.append((path, record))
        if len(to_process) >= max_records:
            break

    logger.info(
        "Found %d records to analyze (skipped %d already-analyzed, %d with no image)",
        len(to_process),
        skipped_done,
        skipped_no_image,
    )

    client = anthropic.AsyncAnthropic(api_key=api_key)
    cost = AnalysisCost()
    stats = {"done": 0, "errors": 0, "total": len(to_process), "mismatches": []}

    queue: asyncio.Queue = asyncio.Queue()
    for item in to_process:
        queue.put_nowait(item)
    for _ in range(concurrency):
        queue.put_nowait(None)

    workers = [asyncio.create_task(worker(queue, client, cost, stats)) for _ in range(concurrency)]
    await queue.join()
    for w in workers:
        w.cancel()

    logger.info("Done. %d analyzed, %d errors. Cost: %s", stats["done"], stats["errors"], cost)
    if stats["mismatches"]:
        logger.info("Cross-modal mismatch flags on %d records:", len(stats["mismatches"]))
        for rid, flags in stats["mismatches"]:
            logger.info("  %s: %s", rid, flags)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--max", type=int, default=200, dest="max_records")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--force", action="store_true", help="Re-analyze records that already have image_analysis")
    args = parser.parse_args()
    asyncio.run(run(args.source, args.max_records, args.concurrency, force=args.force))


if __name__ == "__main__":
    sys.exit(main())
