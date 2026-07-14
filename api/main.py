"""FastAPI service for the Reconstruction Records Explorer (Phase 4).

Endpoints:
  GET /search           lexical search + facets over harvested records
  GET /record/{id}      one record: text, image, analysis, entities, tables
  GET /person/{name}    per-person financial profile: records + $ amounts tied to them
  GET /aggregate        counts by doc_type/decade, top people/places -- for the analysis view
"""

import re
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.db import get_pool

app = FastAPI(title="Reconstruction Records Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


@app.get("/search")
def search(
    q: str = "",
    doc_type: Optional[str] = None,
    collection: Optional[str] = None,
    limit: int = Query(25, le=150),
    offset: int = 0,
):
    pool = get_pool()
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, date, doc_type, collection, image_url, local_image_path, rights,
                   CASE WHEN %(q)s = '' THEN left(coalesce(text, ''), 240)
                        ELSE ts_headline('english', coalesce(text, ''), plainto_tsquery('english', %(q)s),
                                         'MaxFragments=1, MaxWords=40')
                   END AS snippet,
                   CASE WHEN %(q)s = '' THEN 0
                        ELSE ts_rank(text_tsv, plainto_tsquery('english', %(q)s)) END AS rank
            FROM records
            WHERE (%(q)s = '' OR text_tsv @@ plainto_tsquery('english', %(q)s))
              AND (%(doc_type)s::text IS NULL OR doc_type = %(doc_type)s)
              AND (%(collection)s::text IS NULL OR collection ILIKE '%%' || %(collection)s || '%%')
            ORDER BY rank DESC, updated_at DESC
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            {"q": q, "doc_type": doc_type, "collection": collection, "limit": limit, "offset": offset},
        )
        results = cur.fetchall()

        cur.execute(
            """
            SELECT doc_type, count(*) AS count FROM records
            WHERE (%(q)s = '' OR text_tsv @@ plainto_tsquery('english', %(q)s))
            GROUP BY doc_type ORDER BY count DESC
            """,
            {"q": q},
        )
        facets = cur.fetchall()

    return {"results": results, "facets": {"doc_type": facets}, "limit": limit, "offset": offset}


@app.get("/record/{record_id:path}")
def get_record(record_id: str):
    pool = get_pool()
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM records WHERE id = %s", (record_id,))
        record = cur.fetchone()
        if not record:
            raise HTTPException(404, "record not found")

        cur.execute("SELECT type, value, amount_usd, associated_person FROM entities WHERE record_id = %s", (record_id,))
        record["entities"] = cur.fetchall()

        cur.execute("SELECT caption, rows FROM record_tables WHERE record_id = %s", (record_id,))
        record["tables"] = cur.fetchall()

    return record


@app.get("/person/{name}")
def person_profile(name: str, limit: int = Query(50, le=200)):
    pattern = f"%{normalize(name)}%"
    pool = get_pool()
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT r.id, r.title, r.date, r.doc_type, r.image_url, r.local_image_path, r.source_url
            FROM records r
            JOIN entities e ON e.record_id = r.id
            WHERE e.type = 'person' AND e.normalized_value ILIKE %s
            ORDER BY r.date
            LIMIT %s
            """,
            (pattern, limit),
        )
        records = cur.fetchall()

        cur.execute(
            """
            SELECT e.value, e.amount_usd, e.associated_person, r.id AS record_id, r.title, r.date
            FROM entities e
            JOIN records r ON r.id = e.record_id
            WHERE e.type = 'amount' AND e.associated_person_normalized ILIKE %s
            ORDER BY r.date
            """,
            (pattern,),
        )
        financial_mentions = cur.fetchall()

        total_usd = sum((m["amount_usd"] or 0) for m in financial_mentions)

    if not records and not financial_mentions:
        raise HTTPException(404, "no records found for that name")

    return {
        "name": name,
        "records": records,
        "financial_mentions": financial_mentions,
        "total_usd": float(total_usd),
        "note": "associated_person linking is co-occurrence-based (same page/ledger row), an approximation -- not verified identity resolution.",
    }


@app.get("/aggregate")
def aggregate():
    pool = get_pool()
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT doc_type, count(*) AS count FROM records GROUP BY doc_type ORDER BY count DESC")
        by_doc_type = cur.fetchall()

        cur.execute(
            """
            SELECT (substring(date from '\\d{4}')::int / 10) * 10 AS decade, count(*) AS count
            FROM records
            WHERE date ~ '\\d{4}'
            GROUP BY decade ORDER BY decade
            """
        )
        by_decade = cur.fetchall()

        cur.execute(
            """
            SELECT normalized_value AS name, count(*) AS mentions
            FROM entities WHERE type = 'person' GROUP BY normalized_value
            ORDER BY mentions DESC LIMIT 20
            """
        )
        top_people = cur.fetchall()

        cur.execute(
            """
            SELECT normalized_value AS name, count(*) AS mentions
            FROM entities WHERE type = 'place' GROUP BY normalized_value
            ORDER BY mentions DESC LIMIT 20
            """
        )
        top_places = cur.fetchall()

        # Only sum amounts tied to a named person -- a per-person financial
        # total is meaningful. A raw sum over every dollar figure in the
        # archive is not: it would add a wage of $50 to Thaddeus Stevens'
        # estimate of the entire Civil War's cost ($10 billion) in the same
        # total, which asserts nothing real. See BUILD_INSTRUCTIONS.md §5.
        cur.execute(
            """
            SELECT sum(amount_usd) AS personal_total, count(*) AS personal_mentions
            FROM entities WHERE type = 'amount' AND associated_person IS NOT NULL
            """
        )
        personal = cur.fetchone()

        cur.execute("SELECT count(*) AS n FROM entities WHERE type = 'amount' AND amount_usd IS NOT NULL")
        all_amounts = cur.fetchone()

        cur.execute(
            """
            SELECT value, amount_usd, associated_person, record_id
            FROM entities WHERE type = 'amount' AND amount_usd IS NOT NULL
            ORDER BY amount_usd DESC LIMIT 10
            """
        )
        largest_amounts = cur.fetchall()

        financial_totals = {
            "person_linked_total_usd": float(personal["personal_total"] or 0),
            "person_linked_mentions": personal["personal_mentions"],
            "all_dollar_mentions": all_amounts["n"],
            "largest_amounts": largest_amounts,
            "note": "person_linked_total_usd sums only amounts tied to a named person on the page -- a meaningful per-person figure. A sum over every dollar figure in the archive is not shown because it would mix personal wages/prices with large-scale estimates (e.g. a war-cost estimate) at wildly different orders of magnitude.",
        }

    return {
        "by_doc_type": by_doc_type,
        "by_decade": by_decade,
        "top_people": top_people,
        "top_places": top_places,
        "financial_totals": financial_totals,
    }
