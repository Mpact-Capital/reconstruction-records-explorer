"""Unified record schema every harvester maps into (BUILD_INSTRUCTIONS.md §1/§3).

The image and the text of a record are linked, first-class citizens of the
same object -- neither is a side effect of the other. `image_analysis`,
`text_embedding`, and `image_embedding` are filled in later by Phase 3
analysis workers and are optional at harvest time.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class TextSource(str, Enum):
    NATIVE = "native"
    OCR = "ocr"
    HTR = "htr"


class BoundingBox(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    confidence: Optional[float] = None


class Table(BaseModel):
    caption: Optional[str] = None
    rows: list[list[str]] = Field(default_factory=list)
    confidence: Optional[float] = None


class EntityType(str, Enum):
    PERSON = "person"
    PLACE = "place"
    DATE = "date"
    AMOUNT = "amount"
    ORGANIZATION = "organization"
    OTHER = "other"


class Entity(BaseModel):
    type: EntityType
    value: str
    # Populated only for type == AMOUNT: parsed numeric USD value and,
    # best-effort, the named person this amount is tied to in the source
    # text/ledger row (co-occurrence-based -- an approximation, not a
    # verified link). None when no confident association exists.
    amount_usd: Optional[float] = None
    associated_person: Optional[str] = None


class ImageAnalysis(BaseModel):
    caption: Optional[str] = None
    doc_type: Optional[str] = None  # ledger | register | letter | form | photograph | newspaper | other
    layout: Optional[str] = None
    tables: list[Table] = Field(default_factory=list)
    photo_description: Optional[str] = None
    entities: list[Entity] = Field(default_factory=list)
    confidence: Optional[float] = None
    mismatch_flags: list[str] = Field(default_factory=list)
    # True when the image is a scanning artifact (blank target frame, camera
    # slate, publication title/seal page, or shared descriptive-pamphlet
    # front matter) rather than actual archival record content -- common in
    # NARA microfilm, where every roll repeats the same front matter before
    # the roll's own content begins.
    is_front_matter: bool = False


class UnifiedRecord(BaseModel):
    id: str
    source: str
    title: Optional[str] = None
    date: Optional[str] = None  # kept as raw string: many records only have a range or partial date
    collection: Optional[str] = None
    record_group: Optional[str] = None
    people: list[str] = Field(default_factory=list)
    places: list[str] = Field(default_factory=list)

    image_urls: list[str] = Field(default_factory=list)
    local_image_paths: list[str] = Field(default_factory=list)

    text: Optional[str] = None
    text_source: Optional[TextSource] = None
    bounding_boxes: list[BoundingBox] = Field(default_factory=list)

    image_analysis: Optional[ImageAnalysis] = None
    text_embedding: Optional[list[float]] = None
    image_embedding: Optional[list[float]] = None

    rights: Optional[str] = None
    source_url: Optional[str] = None
    ingested_at: Optional[datetime] = None

    # Original API response, kept for provenance/debugging and to recover
    # fields not yet mapped into the unified schema.
    raw: dict[str, Any] = Field(default_factory=dict)

    def dedupe_key(self) -> tuple[str, str]:
        return (self.source, self.id)
