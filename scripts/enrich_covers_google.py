"""Second-pass cover enrichment via Google Books.

For every book in site/data.json that has NO cover_url yet, try Google Books
(https://www.googleapis.com/books/v1/volumes). Cache hits + misses in
data/google_books_cache.json so reruns are cheap.

Usage:
    python scripts/enrich_covers_google.py
Then run build_site_data.py again to apply the new covers.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

DATA_JSON = Path("site/data.json")
OL_CACHE = Path("data/openlib_cache.json")
GB_CACHE = Path("data/google_books_cache.json")
GB_URL = "https://www.googleapis.com/books/v1/volumes"


def cache_key(title: str, author: str) -> str:
    return f"{title.strip().lower()}|{author.strip().lower()}"


def lookup(client: httpx.Client, title: str, author: str) -> dict:
    q = f'intitle:"{title}"'
    if author:
        q += f' inauthor:"{author}"'
    # Retry with backoff for transient errors (429 rate limit, 5xx)
    last_err = ""
    for attempt in range(4):
        try:
            r = client.get(GB_URL, params={"q": q, "maxResults": 3, "printType": "books"}, timeout=20.0)
            if r.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            r.raise_for_status()
            items = r.json().get("items", []) or []
            break
        except Exception as e:
            last_err = str(e)[:100]
            time.sleep(1 + attempt)
            items = []
    else:
        return {"error": last_err or "exhausted retries"}
    for it in items:
        info = it.get("volumeInfo", {}) or {}
        links = info.get("imageLinks", {}) or {}
        cover = links.get("thumbnail") or links.get("smallThumbnail")
        if cover:
            # Force HTTPS, drop edge curls / zoom for cleaner image
            cover = cover.replace("http://", "https://").replace("&edge=curl", "").replace("zoom=1", "zoom=2")
            return {
                "cover_url": cover,
                "isbn": next((i.get("identifier") for i in (info.get("industryIdentifiers") or []) if i.get("type", "").startswith("ISBN")), None),
                "pages": info.get("pageCount"),
                "first_pub_year": (info.get("publishedDate") or "")[:4] or None,
            }
    return {}


def main() -> None:
    with DATA_JSON.open() as f:
        data = json.load(f)

    gb_cache = {}
    if GB_CACHE.exists():
        with GB_CACHE.open() as f:
            gb_cache = json.load(f)

    missing = [b for b in data["books"] if not b.get("cover_url")]
    print(f"{len(missing)} books missing covers; checking Google Books")

    new = 0
    hits = 0
    with httpx.Client(headers={"User-Agent": "mount-readmore/0.1"}) as client:
        for i, b in enumerate(missing):
            author = b["authors"][0] if b.get("authors") else ""
            key = cache_key(b["title"], author)
            if key in gb_cache:
                meta = gb_cache[key]
            else:
                meta = lookup(client, b["title"], author)
                if not meta.get("error"):
                    gb_cache[key] = meta
                else:
                    # Don't cache transient errors so we can retry next run
                    pass
                new += 1
                time.sleep(0.6)
                if new % 25 == 0:
                    print(f"  {i + 1}/{len(missing)} (new lookups: {new}, hits: {hits})")
                    GB_CACHE.parent.mkdir(parents=True, exist_ok=True)
                    with GB_CACHE.open("w") as f:
                        json.dump(gb_cache, f, indent=2)
            if meta.get("cover_url"):
                hits += 1

    with GB_CACHE.open("w") as f:
        json.dump(gb_cache, f, indent=2)

    print(f"\nDone. {hits}/{len(missing)} missing books now have a Google Books cover.")
    print(f"  New lookups: {new}  Cache size: {len(gb_cache)}")


if __name__ == "__main__":
    main()
