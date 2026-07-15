"""Phase 3 image+text analysis (BUILD_INSTRUCTIONS.md Phase 3) via Claude
vision. Per record: caption, doc-type/layout classification, table
extraction, entity extraction, and — where the source's own catalog text is
thin or absent — best-effort transcription (OCR for print, HTR for
handwriting), plus a confidence score and cross-modal mismatch flags.

This is deliberately the expensive, rate-limited, resumable stage: a crash
mid-batch must not force re-analysis of already-processed records.
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Optional

import anthropic
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from harvesters.schema import Entity, ImageAnalysis, Table, TextSource, UnifiedRecord

logger = logging.getLogger("analysis.vision")

MODEL = "claude-sonnet-5"

# Pricing is per Anthropic's published rates for this model, used only to
# print a running cost estimate -- not billed by this script.
INPUT_PRICE_PER_MTOK = 3.0
OUTPUT_PRICE_PER_MTOK = 15.0

SYSTEM_PROMPT = """\
You are assisting a digital archive of Reconstruction-era (1863-1877) US \
federal records: Freedmen's Bureau case files, Freedmen's Bank registers, \
congressional documents, photographs, and related manuscripts. This \
material includes records of formerly enslaved people, and sometimes \
racial violence -- handle names and personal details factually and \
respectfully; do not embellish or speculate beyond what the page shows.

You will be given a scanned page/photo image plus the existing catalog \
metadata for it. Call the `record_analysis` tool with your findings. \
Rules:
- `transcription`: if the image contains legible text (printed or \
  handwritten), transcribe it as completely and literally as you can. If \
  the existing catalog text already looks like a full transcription \
  (not just a bibliographic blurb), you may leave this empty.
- `doc_type`: classify the primary content of the image.
- `confidence`: your honest confidence (0-1) in the transcription's \
  accuracy. Historical handwriting is hard -- a mediocre confidence score \
  is expected and useful; do not inflate it.
- `mismatch_flags`: note anything where the image content seems to \
  contradict, or not match, the supplied catalog title/date/description \
  (e.g. wrong item, blank/illegible page, mismatched date).
- `is_front_matter`: true if this image is a scanning/publication artifact \
  rather than actual record content -- a blank target frame, a camera/lab \
  slate (operator name, date filmed, roll number), a publication title or \
  seal page, or pages of a shared descriptive pamphlet/introduction/finding \
  aid. False for any page that is part of the actual historical record \
  (a letter, ledger entry, register, contract, photograph, etc.), even if \
  otherwise hard to read.
- `entities`: extract every named person, place, date, and organization \
  visible on the page as separate structured entities.
- `amount` entities are ONLY for concrete, real US-dollar figures actually \
  recorded as such on the page -- a ledger line, a price, a wage, an \
  appropriation, an account balance. Set `amount_usd` to the parsed \
  numeric value (e.g. "$50.00" -> 50.0), and set `associated_person` to \
  the specific named person that amount is tied to (e.g. a ledger row's \
  name column, or "paid to X") ONLY if that link is clearly shown on the \
  page -- leave it null rather than guess.
  Do NOT create an `amount` entity for: rhetorical/hypothetical figures \
  used in political speech or argument (e.g. "even if it cost ten \
  billions of dollars"); population counts, tallies, or other non-dollar \
  quantities; measurements (tons, acres, miles); or amounts in a \
  non-USD currency (e.g. "pounds sterling") -- put those under `other` \
  instead, or omit them if not a named entity at all.
- Never assert a historical claim as fact beyond what is directly visible \
  on the page.
"""

RECORD_ANALYSIS_TOOL = {
    "name": "record_analysis",
    "description": "Structured analysis of a single scanned record image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "caption": {"type": "string", "description": "One-sentence description of what the image shows."},
            "doc_type": {
                "type": "string",
                "enum": ["ledger", "register", "letter", "form", "photograph", "newspaper", "book_page", "map", "other"],
            },
            "layout": {"type": "string", "description": "Brief layout description, e.g. 'single column handwritten letter', 'tabular ledger with ruled columns'."},
            "tables": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "caption": {"type": "string"},
                        "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}},
                    },
                    "required": ["rows"],
                },
            },
            "photo_description": {"type": ["string", "null"], "description": "If doc_type is photograph, a factual description of the scene/subjects."},
            "entities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": ["person", "place", "date", "amount", "organization", "other"]},
                        "value": {"type": "string", "description": "The entity as it appears/normalized, e.g. a person's name or 'St. Louis, MO'."},
                        "amount_usd": {"type": ["number", "null"], "description": "Only for type=amount: parsed numeric USD value."},
                        "associated_person": {"type": ["string", "null"], "description": "Only for type=amount: the named person this amount is clearly tied to on the page, else null."},
                    },
                    "required": ["type", "value"],
                },
            },
            "transcription": {"type": "string", "description": "Full transcription of legible text, or empty string if none / catalog text already suffices."},
            "text_source_used": {"type": "string", "enum": ["ocr", "htr", "none"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "mismatch_flags": {"type": "array", "items": {"type": "string"}},
            "is_front_matter": {"type": "boolean", "description": "True if this is a scanning artifact / cover slide / shared front matter, not actual record content."},
        },
        "required": ["caption", "doc_type", "entities", "transcription", "text_source_used", "confidence", "mismatch_flags", "is_front_matter"],
    },
}


def _sniff_media_type(data: bytes) -> str:
    """Detect actual image format from magic bytes rather than trusting the
    file's extension -- some sources (e.g. LoC) serve .gif content behind
    URLs/paths that don't say so, and the API rejects a mismatched
    media_type outright."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


class AnalysisCost:
    def __init__(self):
        self.input_tokens = 0
        self.output_tokens = 0
        self.n = 0

    def add(self, usage):
        self.input_tokens += usage.input_tokens
        self.output_tokens += usage.output_tokens
        self.n += 1

    @property
    def estimated_usd(self) -> float:
        return (self.input_tokens / 1_000_000) * INPUT_PRICE_PER_MTOK + (
            self.output_tokens / 1_000_000
        ) * OUTPUT_PRICE_PER_MTOK

    def __str__(self):
        return f"{self.n} calls, ~${self.estimated_usd:.4f} estimated"


def _is_retryable(exc: BaseException) -> bool:
    # Retry rate limits/server hiccups/timeouts, but not 4xx client errors
    # (e.g. bad image data) -- retrying those just burns time for a request
    # that will never succeed.
    if isinstance(exc, anthropic.APIStatusError):
        return exc.status_code in (429, 500, 502, 503, 529)
    return isinstance(exc, (anthropic.APITimeoutError, anthropic.APIConnectionError))


@retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    reraise=True,
)
async def _call_model(client: anthropic.AsyncAnthropic, image_bytes: bytes, media_type: str, record: UnifiedRecord):
    b64 = base64.b64encode(image_bytes).decode()
    context = (
        f"Catalog title: {record.title or '(none)'}\n"
        f"Catalog date: {record.date or '(none)'}\n"
        f"Existing catalog text/description: {record.text or '(none)'}\n\n"
        "Analyze this scanned record image."
    )
    return await client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        tools=[RECORD_ANALYSIS_TOOL],
        tool_choice={"type": "tool", "name": "record_analysis"},
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": context},
                ],
            }
        ],
    )


HANDWRITTEN_DOC_TYPES = {"ledger", "register", "letter"}


def _apply_analysis(record: UnifiedRecord, data: dict) -> UnifiedRecord:
    tables = [Table(caption=t.get("caption"), rows=t.get("rows", [])) for t in data.get("tables", [])]
    entities = []
    for e in data.get("entities", []):
        if not isinstance(e, dict):
            logger.warning("Skipping malformed entity for record %s: %r", record.id, e)
            continue
        entities.append(
            Entity(
                type=e["type"],
                value=e["value"],
                amount_usd=e.get("amount_usd"),
                associated_person=e.get("associated_person"),
            )
        )

    record.image_analysis = ImageAnalysis(
        caption=data.get("caption"),
        doc_type=data.get("doc_type"),
        layout=data.get("layout"),
        tables=tables,
        photo_description=data.get("photo_description"),
        entities=entities,
        confidence=data.get("confidence"),
        mismatch_flags=data.get("mismatch_flags", []),
        is_front_matter=data.get("is_front_matter", False),
    )

    transcription = (data.get("transcription") or "").strip()
    existing_text = (record.text or "").strip()
    if transcription and len(transcription) > len(existing_text) * 1.5:
        record.text = transcription
        used = data.get("text_source_used")
        if used == "htr":
            record.text_source = TextSource.HTR
        elif used == "ocr":
            record.text_source = TextSource.OCR
        elif data.get("doc_type") in HANDWRITTEN_DOC_TYPES:
            record.text_source = TextSource.HTR
        else:
            record.text_source = TextSource.OCR

    return record


async def analyze_record(
    client: anthropic.AsyncAnthropic, record: UnifiedRecord, cost: Optional[AnalysisCost] = None
) -> UnifiedRecord:
    if not record.local_image_paths:
        return record

    image_path = Path(record.local_image_paths[0])
    image_bytes = image_path.read_bytes()
    media_type = _sniff_media_type(image_bytes)

    resp = await _call_model(client, image_bytes, media_type, record)
    if cost is not None:
        cost.add(resp.usage)

    tool_use = next((b for b in resp.content if b.type == "tool_use"), None)
    if tool_use is None:
        logger.warning("No tool_use block for record %s", record.id)
        return record

    return _apply_analysis(record, tool_use.input)


async def analyze_record_skip_front_matter(
    client: anthropic.AsyncAnthropic,
    record: UnifiedRecord,
    fetch_page,
    candidate_offsets: Optional[list] = None,
    cost: Optional[AnalysisCost] = None,
) -> tuple[UnifiedRecord, Optional[bytes], Optional[int]]:
    """For sources (NARA microfilm) where the first page(s) of a record are
    reliably a shared cover/title/finding-aid front matter rather than actual
    content: try candidate pages at increasing offsets into record.image_urls,
    accepting the first one Claude doesn't flag as front matter. `fetch_page`
    is an async `(url) -> bytes` downloader (caller supplies this so this
    module doesn't need its own rate-limited HTTP client).

    Returns (record, winning_image_bytes, winning_offset) -- the caller
    decides whether/where to persist the winning page's bytes, since only it
    knows the on-disk layout.
    """
    if candidate_offsets is None:
        candidate_offsets = [1, 30, 75, 150]

    urls = record.image_urls
    if not urls:
        return record, None, None

    last_data = None
    last_bytes = None
    last_idx = None
    for offset in candidate_offsets:
        idx = min(offset, len(urls) - 1)
        url = urls[idx]
        image_bytes = await fetch_page(url)
        media_type = _sniff_media_type(image_bytes)

        resp = await _call_model(client, image_bytes, media_type, record)
        if cost is not None:
            cost.add(resp.usage)

        tool_use = next((b for b in resp.content if b.type == "tool_use"), None)
        if tool_use is None:
            logger.warning("No tool_use block for record %s at offset %d", record.id, idx)
            continue

        data = tool_use.input
        last_data, last_bytes, last_idx = data, image_bytes, idx
        if not data.get("is_front_matter"):
            logger.info("Record %s: real content found at page offset %d", record.id, idx)
            break
        logger.info("Record %s: page offset %d is front matter, trying next", record.id, idx)
    else:
        logger.warning("Record %s: all %d candidate pages were front matter, keeping the last", record.id, len(candidate_offsets))

    if last_data is None:
        return record, None, None

    record = _apply_analysis(record, last_data)
    return record, last_bytes, last_idx
