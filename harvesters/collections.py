"""Classifies a LoC record's raw `partof` tags (an unordered bag like
["catalog", "thaddeus stevens papers: general correspondence, 1829-1869",
"manuscript division", "thaddeus stevens papers"]) into a clean
(group, detail) pair for faceted browsing -- e.g.
("Manuscript Division", "Thaddeus Stevens Papers: General Correspondence, 1829-1869").

The raw join used at harvest time (`", ".join(partof)`) is unusable as a
filter facet: order is arbitrary per record and every generic tag (catalog,
general collections, finding aids...) is mixed in with the one tag that's
actually specific. This re-derives group/detail from the same tags.
"""

from __future__ import annotations

import re

# Tags that are LoC site-navigation categories, not meaningful collection
# names -- never shown as the "detail" label, and ignored when picking one.
_STOPLIST = {
    "catalog",
    "general collections",
    "digital collections",
    "finding aids",
    "selected digitized books",
    "u.s. government digital resources",
    "u.s. local history collection",
    "researcher engagement and general collections division",
    "rare book selections",
    "house document",
    "senate document",
    "senate miscellaneous document",
    "house bills",
    "bills",
    "congress.gov",
    "community collections grant project",
    "local history and genealogy web archive",
    "library of congress blogs",
    "in custodia legis: law librarians of congress",
    "national recording preservation board",
}

_CONGRESS_SESSION_RE = re.compile(r"^\d+(st|nd|rd|th) congress(, \d+(st|nd|rd|th) session)?$")
_SERIAL_RE = re.compile(r"united states congressional serial set:\s*serial no\.\s*(\d+)")

_ACRONYMS = {"naacp": "NAACP", "u.s.": "U.S.", "d.c.": "D.C."}


def _titlecase(s: str) -> str:
    words = s.split(" ")
    out = []
    for w in words:
        lw = w.lower().strip(",")
        if lw in _ACRONYMS:
            out.append(_ACRONYMS[lw] + w[len(lw):])
        else:
            out.append(w[:1].upper() + w[1:] if w else w)
    return " ".join(out)


def classify(partof: list[str] | None) -> tuple[str, str]:
    """Returns (group, detail), both display-ready (title-cased)."""
    tags = [t.strip() for t in (partof or []) if t and t.strip()]
    lower = [t.lower() for t in tags]

    if any("congressional serial set" in t for t in lower):
        group = "Congressional Serial Set"
    elif any(t in ("congress.gov", "house bills", "bills", "senate bill") for t in lower):
        group = "Congressional Bills"
    elif any(
        "prints and photographs division" in t
        or "prints & photographs" in t
        or t.startswith("lot ")
        or "gladstone collection of african american photographs" in t
        or "liljenquist family collection" in t
        for t in lower
    ):
        group = "Prints & Photographs"
    elif any("law library" in t or t.startswith("u.s. reports") for t in lower):
        group = "Law Library"
    elif any("rare book" in t or "african american perspectives" in t for t in lower):
        group = "Rare Book & Special Collections"
    elif any("geography and map" in t for t in lower):
        group = "Geography & Map Division"
    elif any("american folklife center" in t for t in lower):
        group = "American Folklife Center"
    elif any("manuscript division" in t for t in lower):
        group = "Manuscript Division"
    else:
        group = "General Collections"

    detail = None

    # Congressional serial-set items get a short, specific label instead of
    # the full "united states congressional serial set: serial no. N" tag.
    for t in tags:
        m = _SERIAL_RE.search(t.lower())
        if m:
            session = next((orig for orig in tags if _CONGRESS_SESSION_RE.match(orig.lower())), None)
            detail = f"Serial No. {m.group(1)}" + (f" ({_titlecase(session)})" if session else "")
            break

    if detail is None:
        candidates = [
            t for t in tags
            if t.lower() not in _STOPLIST
            and not _CONGRESS_SESSION_RE.match(t.lower())
            and t.lower() != group.lower()
        ]
        if candidates:
            best = max(candidates, key=len)
            if ":" in best:
                prefix, _, rest = best.partition(":")
                prefix, rest = prefix.strip(), rest.strip()
                # e.g. best="thaddeus stevens papers: general correspondence, 1829-1869"
                # and "thaddeus stevens papers" is also a candidate -> the group is
                # already implied, so drop the redundant prefix from the label.
                if any(c.strip().lower() == prefix.lower() for c in candidates if c != best):
                    detail = rest
                else:
                    detail = best
            else:
                detail = best

    if detail is None:
        detail = group

    return _titlecase(group), _titlecase(detail.strip().rstrip(","))
