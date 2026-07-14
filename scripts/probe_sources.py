"""Probe each data source with a single-record query and print the real
response schema + rate-limit headers. Run this before writing any harvester —
endpoint contracts in BUILD_INSTRUCTIONS.md are unverified until this proves
them against live responses.

Usage:
    python scripts/probe_sources.py [--source nara|loc|chronicling_america|dpla|census|smithsonian]
"""

import argparse
import json
import os
import sys

import httpx
from dotenv import load_dotenv
from rich import print as rprint
from rich.console import Console

load_dotenv()
console = Console()

NARA_API_KEY = os.getenv("NARA_API_KEY", "")
DPLA_API_KEY = os.getenv("DPLA_API_KEY", "")
CENSUS_API_KEY = os.getenv("CENSUS_API_KEY", "")
SMITHSONIAN_API_KEY = os.getenv("SMITHSONIAN_API_KEY", "")

RATE_LIMIT_HEADER_NAMES = [
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "retry-after",
    "ratelimit-limit",
    "ratelimit-remaining",
]


def _print_result(name: str, resp: httpx.Response, note: str = ""):
    console.rule(f"[bold]{name}[/bold]")
    console.print(f"URL: {resp.request.url}")
    console.print(f"Status: {resp.status_code}")

    rl_headers = {
        k: v for k, v in resp.headers.items() if k.lower() in RATE_LIMIT_HEADER_NAMES
    }
    console.print(f"Rate-limit headers: {rl_headers or 'none observed'}")

    if note:
        console.print(f"[yellow]Note: {note}[/yellow]")

    try:
        body = resp.json()
    except ValueError:
        console.print("[red]Response is not JSON[/red]")
        console.print(resp.text[:500])
        return None

    console.print("Top-level keys:", list(body.keys()) if isinstance(body, dict) else type(body))

    # Prefer showing one real result item's shape over top-level facets/pagination —
    # that's what a harvester actually needs to map.
    results = body.get("results") if isinstance(body, dict) else None
    if isinstance(results, list) and results:
        console.print(f"[bold]results[0] shape ({len(results)} result(s) returned):[/bold]")
        console.print(json.dumps(results[0], indent=2)[:4000])
    else:
        console.print(json.dumps(body, indent=2)[:3000])
    return body


def probe_nara(client: httpx.Client):
    if not NARA_API_KEY:
        console.rule("[bold]NARA Catalog API[/bold]")
        console.print(
            "[red]Skipped: NARA_API_KEY not set.[/red] As of API v2, NARA requires an "
            "x-api-key header. Request one by emailing Catalog_API@nara.gov with your "
            "name + email (free, manual — no self-serve signup)."
        )
        return None
    url = "https://catalog.archives.gov/api/v2/records/search"
    params = {
        "q": "Freedmen's Bureau",
        "resultTypes": "description",
        "limit": 1,
    }
    resp = client.get(url, params=params, headers={"x-api-key": NARA_API_KEY})
    return _print_result("NARA Catalog API", resp)


def probe_loc(client: httpx.Client):
    url = "https://www.loc.gov/search/"
    params = {"q": "Freedmen's Bureau", "fo": "json", "c": 1}
    resp = client.get(url, params=params)
    return _print_result("Library of Congress search", resp)


def probe_chronicling_america(client: httpx.Client):
    # The standalone chroniclingamerica.loc.gov API was retired in 2025; the
    # collection is now served through the unified loc.gov API.
    url = "https://www.loc.gov/collections/chronicling-america/"
    params = {"q": "Freedmen's Bureau", "fo": "json", "c": 1}
    resp = client.get(url, params=params)
    return _print_result(
        "Chronicling America (via loc.gov collections API)",
        resp,
        note="Legacy chroniclingamerica.loc.gov API retired 2025; now served under "
        "loc.gov/collections/chronicling-america/.",
    )


def probe_dpla(client: httpx.Client):
    if not DPLA_API_KEY:
        console.rule("[bold]DPLA[/bold]")
        console.print("[red]Skipped: DPLA_API_KEY not set in .env[/red]")
        return None
    url = "https://api.dp.la/v2/items"
    params = {"q": "Freedmen's Bureau", "api_key": DPLA_API_KEY, "page_size": 1}
    resp = client.get(url, params=params)
    return _print_result("DPLA", resp)


def probe_census(client: httpx.Client):
    if not CENSUS_API_KEY:
        console.rule("[bold]Census[/bold]")
        console.print("[red]Skipped: CENSUS_API_KEY not set in .env[/red]")
        return None
    # 1870/1880 decennial APIs are limited; this hits a modern ACS endpoint
    # purely to confirm auth + response shape, not for historical tenure data.
    url = "https://api.census.gov/data/2020/dec/pl"
    params = {"get": "NAME,P1_001N", "for": "state:*", "key": CENSUS_API_KEY}
    resp = client.get(url, params=params)
    _print_result(
        "Census API",
        resp,
        note="Hit a modern ACS/decennial endpoint to verify auth + shape only; "
        "historical tenure/land data will need IPUMS USA extracts, not this API.",
    )
    return None


def probe_smithsonian(client: httpx.Client):
    if not SMITHSONIAN_API_KEY:
        console.rule("[bold]Smithsonian[/bold]")
        console.print("[red]Skipped: SMITHSONIAN_API_KEY not set in .env[/red]")
        return None
    url = "https://api.si.edu/openaccess/api/v1.0/search"
    params = {"q": "Freedmen's Bureau", "api_key": SMITHSONIAN_API_KEY, "rows": 1}
    resp = client.get(url, params=params)
    return _print_result("Smithsonian Open Access", resp)


PROBES = {
    "nara": probe_nara,
    "loc": probe_loc,
    "chronicling_america": probe_chronicling_america,
    "dpla": probe_dpla,
    "census": probe_census,
    "smithsonian": probe_smithsonian,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=list(PROBES.keys()), default=None)
    args = parser.parse_args()

    targets = [args.source] if args.source else list(PROBES.keys())

    with httpx.Client(
        timeout=30.0,
        follow_redirects=True,
        headers={"User-Agent": "reconstruction-records-explorer/0.1 (probe)"},
    ) as client:
        for name in targets:
            try:
                PROBES[name](client)
            except httpx.HTTPError as exc:
                console.rule(f"[bold red]{name} — request failed[/bold red]")
                console.print(str(exc))


if __name__ == "__main__":
    sys.exit(main())
