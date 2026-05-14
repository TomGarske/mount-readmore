"""Enrich site/data.json with Open Library cover URLs.

Caches lookups in data/openlib_cache.json so subsequent runs only hit the API
for new books. Resumes mid-run if interrupted (cache flushed every 25 lookups).

Usage:
    python scripts/enrich_covers.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

DATA_JSON = Path("site/data.json")
CACHE_JSON = Path("data/openlib_cache.json")
OPEN_LIBRARY = "https://openlibrary.org/search.json"


def cache_key(title: str, author: str) -> str:
    return f"{title.strip().lower()}|{author.strip().lower()}"


def lookup(client: httpx.Client, title: str, author: str) -> dict:
    params = {"title": title, "author": author, "limit": 1, "fields": "key,cover_i,first_publish_year,isbn,number_of_pages_median"}
    try:
        r = client.get(OPEN_LIBRARY, params=params, timeout=15.0)
        r.raise_for_status()
        docs = r.json().get("docs", [])
    except Exception as e:
        return {"error": str(e)[:80]}
    if not docs:
        return {}
    d = docs[0]
    cover_i = d.get("cover_i")
    return {
        "ol_key": d.get("key", ""),
        "cover_url": f"https://covers.openlibrary.org/b/id/{cover_i}-M.jpg" if cover_i else "",
        "first_pub_year": d.get("first_publish_year"),
        "isbn": (d.get("isbn") or [None])[0],
        "pages": d.get("number_of_pages_median"),
    }


def main() -> None:
    with DATA_JSON.open() as f:
        data = json.load(f)
    cache = {}
    if CACHE_JSON.exists():
        with CACHE_JSON.open() as f:
            cache = json.load(f)

    books = data["books"]
    print(f"{len(books)} books to enrich, {len(cache)} already cached")

    new_lookups = 0
    with httpx.Client(headers={"User-Agent": "sff-awards/0.1 (tom@example.com)"}) as client:
        for i, book in enumerate(books):
            author = book["authors"][0] if book.get("authors") else ""
            key = cache_key(book["title"], author)
            if key in cache:
                meta = cache[key]
            else:
                meta = lookup(client, book["title"], author)
                cache[key] = meta
                new_lookups += 1
                time.sleep(0.2)
                if new_lookups % 25 == 0:
                    print(f"  {i + 1}/{len(books)} (new: {new_lookups})")
                    CACHE_JSON.parent.mkdir(parents=True, exist_ok=True)
                    with CACHE_JSON.open("w") as f:
                        json.dump(cache, f, indent=2)

            for field in ["cover_url", "ol_key", "first_pub_year", "isbn", "pages"]:
                if field in meta and meta[field]:
                    book[field] = meta[field]

    with CACHE_JSON.open("w") as f:
        json.dump(cache, f, indent=2)
    with DATA_JSON.open("w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    with_cover = sum(1 for b in books if b.get("cover_url"))
    print(f"\nDone. {with_cover}/{len(books)} books have a cover URL.")
    print(f"  New lookups: {new_lookups}  Cache: {len(cache)}")


if __name__ == "__main__":
    main()
