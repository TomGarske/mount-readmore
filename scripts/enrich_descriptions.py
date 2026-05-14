"""Fetch book descriptions + subjects from Open Library work API.

Uses the ol_key already cached by enrich_covers.py. For each cached book that
has an ol_key but no description yet, calls /works/{key}.json and stores the
description string. Cache is keyed by ol_key.

Usage:
    python scripts/enrich_descriptions.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

CACHE_JSON = Path("data/openlib_cache.json")
DESC_CACHE = Path("data/openlib_descriptions.json")


def normalize_description(d: object) -> str:
    """Open Library returns description as string OR {type, value} dict."""
    if not d:
        return ""
    if isinstance(d, str):
        return d
    if isinstance(d, dict) and "value" in d:
        return d["value"]
    return ""


def fetch_work(client: httpx.Client, ol_key: str) -> dict:
    if not ol_key.startswith("/"):
        ol_key = "/" + ol_key
    url = f"https://openlibrary.org{ol_key}.json"
    try:
        r = client.get(url, timeout=15.0)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        return {"error": str(e)[:100]}
    return {
        "description": normalize_description(data.get("description")),
        "subjects": (data.get("subjects") or [])[:15],
    }


def main() -> None:
    if not CACHE_JSON.exists():
        print("No openlib_cache.json — run enrich_covers.py first.")
        return
    with CACHE_JSON.open() as f:
        cache = json.load(f)

    descriptions = {}
    if DESC_CACHE.exists():
        with DESC_CACHE.open() as f:
            descriptions = json.load(f)

    ol_keys = sorted({v.get("ol_key", "") for v in cache.values() if v.get("ol_key")})
    print(f"{len(ol_keys)} unique ol_keys to fetch; {len(descriptions)} already cached")

    pending = [k for k in ol_keys if k not in descriptions]
    print(f"  pending: {len(pending)}")

    new = 0
    with httpx.Client(headers={"User-Agent": "mount-readmore/0.1 (tom@example.com)"}) as client:
        for i, ol_key in enumerate(pending):
            meta = fetch_work(client, ol_key)
            descriptions[ol_key] = meta
            new += 1
            time.sleep(0.15)
            if new % 25 == 0:
                print(f"  {i + 1}/{len(pending)} done")
                DESC_CACHE.parent.mkdir(parents=True, exist_ok=True)
                with DESC_CACHE.open("w") as f:
                    json.dump(descriptions, f, indent=2, ensure_ascii=False)

    with DESC_CACHE.open("w") as f:
        json.dump(descriptions, f, indent=2, ensure_ascii=False)

    with_desc = sum(1 for v in descriptions.values() if v.get("description"))
    print(f"\nDone. {with_desc}/{len(descriptions)} works have a description.")


if __name__ == "__main__":
    main()
