"""Second-pass Open Library lookup for books missing a cover / description.

The primary enrichment pass (scripts/enrich_metadata.py) queries Open Library
with the raw title + author as they appear in the awards CSVs. Many older or
multi-titled works fail to match because:

  * Title contains '(also known as X)' or '(UK: X)' — OL has the base title.
  * Author has a '(as <pseudonym>)' annotation — OL has the pseudonym or base.

This script reads site/data.json, finds every book without a cover_url, and
retries OL with cleaned title / author variants. Hits get written back to
data/openlib_cache.json and data/openlib_descriptions.json so the next
build_site_data run picks them up.

Usage:
    python scripts/retry_openlibrary.py \
        --site  site/data.json \
        --cache data/openlib_cache.json \
        --desc  data/openlib_descriptions.json
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

import httpx


OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json"
OPEN_LIBRARY_WORK = "https://openlibrary.org{ol_key}.json"


def title_variants(title: str) -> list[str]:
    """Yield candidate title strings to try against Open Library."""
    seen: set[str] = set()
    out: list[str] = []

    def push(t: str) -> None:
        t = t.strip()
        if not t or t.lower() in seen:
            return
        seen.add(t.lower())
        out.append(t)

    push(title)

    # 'Foo (also known as Bar)' → 'Foo', and also 'Bar' as a separate variant.
    m = re.search(r"^(.*?)\s*\((?:also known as|aka|UK:|US:)\s+([^)]+)\)\s*(.*)$", title, flags=re.I)
    if m:
        push(m.group(1) + (" " + m.group(3) if m.group(3) else ""))
        push(m.group(2))

    # 'Foo (Bar)' generic — try Foo alone.
    if "(" in title:
        push(title.split("(", 1)[0])

    # Strip trailing series suffix like 'Foo (Bar, #1)'.
    push(re.sub(r"\s*\([^)]+\)\s*$", "", title))

    return out


def author_variants(author: str) -> list[str]:
    """Yield candidate author strings — strips pseudonym annotations both ways."""
    seen: set[str] = set()
    out: list[str] = []

    def push(a: str) -> None:
        a = a.strip()
        if not a or a.lower() in seen:
            return
        seen.add(a.lower())
        out.append(a)

    push(author)

    # 'A (as B)' → 'A', 'B'
    m = re.search(r"^(.*?)\s*\(as\s+([^)]+)\)\s*$", author, flags=re.I)
    if m:
        push(m.group(1))
        push(m.group(2))

    # Drop generic parentheticals: 'Jean Bruller (French)' → 'Jean Bruller'
    if "(" in author:
        push(author.split("(", 1)[0])

    return out


def search_ol(client: httpx.Client, title: str, author: str) -> dict | None:
    params = {"title": title, "author": author, "limit": 3}
    try:
        r = client.get(OPEN_LIBRARY_SEARCH, params=params, timeout=10.0)
        r.raise_for_status()
    except Exception as e:
        print(f"    ! search failed: {e}")
        return None
    docs = r.json().get("docs", [])
    # Prefer the first doc that has a cover_i so we don't pick a coverless edition.
    for doc in docs:
        if doc.get("cover_i"):
            return doc
    return docs[0] if docs else None


def fetch_work_details(client: httpx.Client, ol_key: str) -> dict:
    """Pull description + subjects from the /works/<id>.json endpoint."""
    if not ol_key.startswith("/works/"):
        return {}
    try:
        r = client.get(OPEN_LIBRARY_WORK.format(ol_key=ol_key), timeout=10.0)
        r.raise_for_status()
    except Exception as e:
        print(f"    ! work fetch failed: {e}")
        return {}
    data = r.json()
    desc = data.get("description")
    if isinstance(desc, dict):
        desc = desc.get("value", "")
    return {
        "description": desc or "",
        "subjects": data.get("subjects") or [],
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--site", type=Path, default=Path("site/data.json"))
    p.add_argument("--cache", type=Path, default=Path("data/openlib_cache.json"))
    p.add_argument("--desc", type=Path, default=Path("data/openlib_descriptions.json"))
    p.add_argument("--limit", type=int, default=0, help="Cap on books to retry (0 = all)")
    p.add_argument("--force", action="store_true", help="Retry even books that already have a cover")
    args = p.parse_args()

    with args.site.open() as f:
        site = json.load(f)
    canon = site["books"]

    cache: dict = {}
    if args.cache.exists():
        with args.cache.open() as f:
            cache = json.load(f)
    desc_cache: dict = {}
    if args.desc.exists():
        with args.desc.open() as f:
            desc_cache = json.load(f)

    # Pick the books that still need help.
    needy = []
    for b in canon:
        wants_cover = not (b.get("cover_url") or "").strip()
        wants_desc = not (b.get("description") or "").strip()
        if wants_cover or wants_desc or args.force:
            needy.append(b)
    if args.limit:
        needy = needy[: args.limit]
    print(f"Books needing enrichment: {len(needy)}")

    new_covers = 0
    new_descs = 0
    new_cache_entries = 0
    misses: list[str] = []

    with httpx.Client(headers={"User-Agent": "award-books-tracker/0.2 (retry)"}) as client:
        for i, book in enumerate(needy, 1):
            title = book.get("title", "")
            authors = book.get("authors") or []
            primary_author = authors[0] if authors else ""
            key = f"{title.strip().lower()}|{primary_author.strip().lower()}"
            existing = cache.get(key, {})
            has_cover = bool(existing.get("cover_url"))
            has_desc = bool(existing.get("description"))
            if has_cover and has_desc and not args.force:
                continue

            print(f"[{i:3d}/{len(needy)}] {title[:50]:50s} | {primary_author[:30]}")
            hit = None
            tried = 0
            for t in title_variants(title):
                if hit and hit.get("cover_i"):
                    break
                for a in author_variants(primary_author):
                    tried += 1
                    doc = search_ol(client, t, a)
                    if doc:
                        # Stop on first cover-bearing hit; otherwise keep the best
                        # text-only match as a fallback for the description path.
                        if doc.get("cover_i"):
                            hit = doc
                            break
                        if hit is None:
                            hit = doc
                    time.sleep(0.2)
            if hit is None:
                print(f"    miss ({tried} tries)")
                misses.append(f"{title} | {primary_author}")
                continue

            cover_id = hit.get("cover_i")
            ol_key = hit.get("key", "")
            isbn_list = hit.get("isbn") or []
            entry = cache.setdefault(key, {})
            # Only set fields we actually got — preserve any prior data.
            if cover_id and not entry.get("cover_url"):
                entry["cover_url"] = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
                new_covers += 1
            if ol_key and not entry.get("ol_key"):
                entry["ol_key"] = ol_key
            if isbn_list and not entry.get("isbn"):
                entry["isbn"] = isbn_list[0]
            if hit.get("first_publish_year") and not entry.get("first_pub_year"):
                entry["first_pub_year"] = hit["first_publish_year"]
            if hit.get("number_of_pages_median") and not entry.get("pages"):
                entry["pages"] = hit["number_of_pages_median"]
            new_cache_entries += 1

            # Pull description + subjects when we have an ol_key and don't already have them.
            if ol_key and ol_key not in desc_cache:
                details = fetch_work_details(client, ol_key)
                if details.get("description") or details.get("subjects"):
                    desc_cache[ol_key] = details
                    if details.get("description"):
                        new_descs += 1
                time.sleep(0.2)

    args.cache.write_text(json.dumps(cache, indent=2, sort_keys=True))
    args.desc.write_text(json.dumps(desc_cache, indent=2, sort_keys=True))

    print()
    print(f"New cover URLs:        {new_covers}")
    print(f"New descriptions:      {new_descs}")
    print(f"Cache rows touched:    {new_cache_entries}")
    print(f"Still missing matches: {len(misses)}")
    if misses[:10]:
        print("First 10 misses:")
        for m in misses[:10]:
            print(f"  {m}")
    print()
    print("Next step: re-run scripts/build_site_data.py to fold these into site/data.json.")


if __name__ == "__main__":
    main()
