"""CLI: harvest --source loc --query "Freedmen's Bureau" --with-images --max 200

One vertical slice at a time, per BUILD_INSTRUCTIONS.md — resumable via
per-source checkpoints in data/checkpoints/, idempotent upserts into
data/raw/<source>/<id>/.
"""

import argparse
import asyncio
import logging
import sys

from harvesters.loc import harvest_loc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("harvest")

HARVESTERS = {
    "loc": lambda query, max_records, with_images: harvest_loc(
        query, max_records=max_records, with_images=with_images
    ),
    "chronicling_america": lambda query, max_records, with_images: harvest_loc(
        query, max_records=max_records, with_images=with_images, collection_path="collections/chronicling-america"
    ),
}


async def run(source: str, query: str, max_records: int, with_images: bool):
    fn = HARVESTERS[source]
    count = 0
    async for record in fn(query, max_records, with_images):
        count += 1
        has_img = bool(record.local_image_paths)
        logger.info("[%d/%d] %s | %s | image=%s", count, max_records, record.id, record.title, has_img)
    logger.info("Done. Harvested %d records for source=%s query=%r", count, source, query)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, choices=list(HARVESTERS.keys()))
    parser.add_argument("--query", required=True)
    parser.add_argument("--max", type=int, default=200, dest="max_records")
    parser.add_argument("--with-images", action="store_true")
    args = parser.parse_args()

    asyncio.run(run(args.source, args.query, args.max_records, args.with_images))


if __name__ == "__main__":
    sys.exit(main())
