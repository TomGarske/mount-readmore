"""Scrape Goodreads book/show pages for cover + description + ISBN.

Only fetches pages for books that ALREADY have a goodreads_id (harvested
from the personal export or discovered earlier). Search-based discovery is
blocked by AWS WAF, but the book/show/<id> route serves a normal HTML page
to a plain User-Agent.

Inputs:
  site/data.json        (source of canon ids + existing field state)
  data/goodreads_ids.json   (id-only lookup from harvest_goodreads_ids.py)

Outputs:
  data/goodreads_metadata.json   (cover_url, description, isbn, pages keyed by canon id)
  data/openlib_cache.json        (cover_url + isbn filled in where we had nothing)

Why two outputs:
  - goodreads_metadata.json is the canonical source of GR-derived fields and is
    consumed by build_site_data via a new apply_goodreads_metadata() pass.
  - openlib_cache also gets the cover_url + isbn so the existing cache pipeline
    treats GR-sourced data as a first-class fallback. Description goes only to
    goodreads_metadata so we never lose the OL-sourced one if GR truncates.

Usage:
    python scripts/fetch_goodreads_metadata.py
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

import httpx

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def extract_book_description(next_data: dict) -> str:
    """Walk the apolloState graph for a Book typename and return its description."""
    state = next_data.get("props", {}).get("pageProps", {}).get("apolloState", {})
    if not isinstance(state, dict):
        return ""
    # Apollo keys look like 'Book:kca://book/amzn1.gr.book.v3.AHMTdTBFDCiQ2N6a'
    for key, value in state.items():
        if not isinstance(value, dict):
            continue
        if value.get("__typename") != "Book":
            continue
        desc = value.get("description")
        if isinstance(desc, str) and desc.strip():
            return desc.strip()
    return ""


def clean_html_description(s: str) -> str:
    """Strip HTML tags Goodreads embeds, normalize whitespace."""
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p>\s*<p[^>]*>", "\n\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    # Collapse repeated whitespace; keep paragraph breaks.
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def fetch_book(client: httpx.Client, gr_id: str) -> dict:
    url = f"https://www.goodreads.com/book/show/{gr_id}"
    try:
        r = client.get(url, timeout=15.0)
        r.raise_for_status()
    except Exception as e:
        return {"_error": str(e)}
    html = r.text

    out: dict = {"goodreads_id": gr_id, "source_url": url}

    # og:image is the cover (CDN-served, stable URL).
    m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
    if m:
        out["cover_url"] = m.group(1)

    # JSON-LD has the structured book metadata.
    m = re.search(r'<script\s+type="application/ld\+json"[^>]*>(.*?)</script>', html, flags=re.S)
    if m:
        try:
            ld = json.loads(m.group(1))
            if ld.get("isbn"):
                out["isbn"] = ld["isbn"]
            if ld.get("numberOfPages"):
                out["pages"] = ld["numberOfPages"]
            if ld.get("name"):
                out["title"] = ld["name"]
            if ld.get("inLanguage"):
                out["language"] = ld["inLanguage"]
        except Exception:
            pass

    # Full description lives in the embedded Next.js Apollo state.
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, flags=re.S)
    if m:
        try:
            nd = json.loads(m.group(1))
            desc = extract_book_description(nd)
            if desc:
                out["description"] = clean_html_description(desc)
        except Exception:
            pass

    # Fall back to og:description (truncated but better than nothing).
    if not out.get("description"):
        m = re.search(r'<meta\s+property="og:description"\s+content="([^"]+)"', html)
        if m and m.group(1).strip():
            out["description"] = m.group(1).strip()

    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--site", type=Path, default=Path("site/data.json"))
    p.add_argument("--gr-ids", type=Path, default=Path("data/goodreads_ids.json"))
    p.add_argument("--gr-meta", type=Path, default=Path("data/goodreads_metadata.json"))
    p.add_argument("--ol-cache", type=Path, default=Path("data/openlib_cache.json"))
    p.add_argument("--sleep", type=float, default=1.2, help="Seconds between requests (respect their servers)")
    p.add_argument("--force", action="store_true", help="Re-fetch even cached entries")
    p.add_argument("--limit", type=int, default=0, help="Cap on books to fetch this run")
    args = p.parse_args()

    with args.site.open() as f:
        site = json.load(f)
    canon = site["books"]

    gr_ids: dict = {}
    if args.gr_ids.exists():
        with args.gr_ids.open() as f:
            gr_ids = json.load(f)

    gr_meta: dict = {}
    if args.gr_meta.exists():
        with args.gr_meta.open() as f:
            gr_meta = json.load(f)

    ol_cache: dict = {}
    if args.ol_cache.exists():
        with args.ol_cache.open() as f:
            ol_cache = json.load(f)

    # Books to fetch: those with a goodreads_id we haven't already cached.
    todo: list[tuple[dict, str]] = []
    for book in canon:
        rec_id = book["id"]
        gr_entry = gr_ids.get(rec_id)
        if not gr_entry or not gr_entry.get("goodreads_id"):
            continue
        if not args.force and rec_id in gr_meta:
            cached = gr_meta[rec_id]
            if cached.get("cover_url") and cached.get("description"):
                continue
        todo.append((book, gr_entry["goodreads_id"]))
    if args.limit:
        todo = todo[: args.limit]
    print(f"Books to fetch from Goodreads: {len(todo)}")

    new_covers = 0
    new_descs = 0
    errors = 0
    with httpx.Client(
        headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"},
        follow_redirects=True,
    ) as client:
        for i, (book, gr_id) in enumerate(todo, 1):
            print(f"[{i:3d}/{len(todo)}] gr={gr_id:>11s} | {book['title'][:48]}")
            data = fetch_book(client, gr_id)
            if data.get("_error"):
                print(f"    ! {data['_error']}")
                errors += 1
                time.sleep(args.sleep)
                continue
            gr_meta[book["id"]] = data
            if data.get("cover_url") and not (book.get("cover_url") or "").strip():
                new_covers += 1
            if data.get("description") and not (book.get("description") or "").strip():
                new_descs += 1
            # Mirror cover + isbn into the OL cache so the existing pipeline
            # picks them up as a fallback when OL itself returned nothing.
            author = book["authors"][0] if book.get("authors") else ""
            key = f"{book['title'].strip().lower()}|{author.strip().lower()}"
            ol_entry = ol_cache.setdefault(key, {})
            if data.get("cover_url") and not ol_entry.get("cover_url"):
                ol_entry["cover_url"] = data["cover_url"]
            if data.get("isbn") and not ol_entry.get("isbn"):
                ol_entry["isbn"] = data["isbn"]
            time.sleep(args.sleep)

    args.gr_meta.write_text(json.dumps(gr_meta, indent=2, sort_keys=True, ensure_ascii=False))
    args.ol_cache.write_text(json.dumps(ol_cache, indent=2, sort_keys=True, ensure_ascii=False))

    print()
    print(f"Pages fetched:       {len(todo)}")
    print(f"New covers (vs canon): {new_covers}")
    print(f"New descs  (vs canon): {new_descs}")
    print(f"Errors:              {errors}")
    print(f"Wrote {args.gr_meta} ({len(gr_meta)} entries)")
    print("Next step: re-run scripts/build_site_data.py to fold into site/data.json.")


if __name__ == "__main__":
    main()
