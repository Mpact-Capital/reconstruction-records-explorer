"""Shared harvester infrastructure: checkpointing, raw storage, rate-limited
HTTP. Every source module (harvesters/loc.py, harvesters/nara.py, ...) builds
on this so resuming and idempotent upserts work the same way everywhere.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from harvesters.schema import UnifiedRecord

logger = logging.getLogger("harvesters")

DATA_ROOT = Path("data")
CHECKPOINT_ROOT = DATA_ROOT / "checkpoints"
RAW_ROOT = DATA_ROOT / "raw"


class Checkpoint:
    """Per-source resume cursor. Call save() after each successfully
    processed page/batch so a crash never re-harvests from zero."""

    def __init__(self, source: str):
        self.path = CHECKPOINT_ROOT / f"{source}.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self.path.exists():
            return json.loads(self.path.read_text(encoding="utf-8"))
        return {}

    def get(self, key: str, default=None):
        return self._state.get(key, default)

    def save(self, **kwargs):
        self._state.update(kwargs)
        self.path.write_text(json.dumps(self._state, indent=2), encoding="utf-8")


class RawStore:
    """Persists unified records and their images to local FS, keyed by
    (source, id) so re-running a harvest is an idempotent upsert."""

    def __init__(self, source: str):
        self.root = RAW_ROOT / source
        self.root.mkdir(parents=True, exist_ok=True)

    def record_dir(self, record_id: str) -> Path:
        safe_id = record_id.replace("/", "_").replace(":", "_")
        d = self.root / safe_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def exists(self, record_id: str) -> bool:
        return (self.record_dir(record_id) / "record.json").exists()

    def save_record(self, record: UnifiedRecord) -> Path:
        d = self.record_dir(record.id)
        path = d / "record.json"
        path.write_text(record.model_dump_json(indent=2, exclude_none=False), encoding="utf-8")
        return path

    def image_path(self, record_id: str, index: int, suffix: str = ".jpg") -> Path:
        return self.record_dir(record_id) / f"image_{index}{suffix}"


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(exc, (httpx.TransportError, httpx.TimeoutException))


class RateLimitedClient:
    """Wraps httpx.AsyncClient with a concurrency cap, a fixed delay between
    requests, and retry/backoff that honors Retry-After on 429s."""

    def __init__(
        self,
        base_headers: Optional[dict[str, str]] = None,
        concurrency: int = 2,
        delay_seconds: float = 1.0,
        timeout: float = 30.0,
    ):
        self.client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers=base_headers or {"User-Agent": "reconstruction-records-explorer/0.1"},
        )
        self.semaphore = asyncio.Semaphore(concurrency)
        self.delay_seconds = delay_seconds

    async def aclose(self):
        await self.client.aclose()

    @retry(
        retry=retry_if_exception(_is_retryable),
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=60),
        reraise=True,
    )
    async def get(self, url: str, **kwargs) -> httpx.Response:
        async with self.semaphore:
            resp = await self.client.get(url, **kwargs)
            if resp.status_code == 429:
                retry_after = float(resp.headers.get("retry-after", 5))
                logger.warning("429 from %s, sleeping %.1fs", url, retry_after)
                await asyncio.sleep(retry_after)
            resp.raise_for_status()
            await asyncio.sleep(self.delay_seconds)
            return resp

    async def download(self, url: str) -> bytes:
        resp = await self.get(url)
        return resp.content
