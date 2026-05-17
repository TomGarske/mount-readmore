#!/usr/bin/env python3
"""Backfill missing cover_url and description from openlibrary.

Pipeline per book that lacks cover_url OR description:
  1. If ISBN: HEAD https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg (200 = use it)
  2. Search https://openlibrary.org/search.json?title=..&author=.. (or by isbn)
     - Pick the best fuzzy-matched doc (title + author)
     - Use cover_i to build the cover URL
     - Capture the work key for description lookup
  3. For description: GET https://openlibrary.org/works/<key>.json
     - Use the description field (string or {value: ...})

The script writes directly to site/data.json. Run with no args to process all
missing books, or pass an integer arg to limit the batch size.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from typing import Optional

DATA_PATH = "site/data.json"
OL_SEARCH = "https://openlibrary.org/search.json"
OL_COVER_ISBN = "https://covers.openlibrary.org/b/isbn/{}-L.jpg"
OL_COVER_ID = "https://covers.openlibrary.org/b/id/{}-L.jpg"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def fetch(url: str, max_retries: int = 2) -> Optional[dict]:
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "readmore-backfill/1.0 (personal)"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status != 200:
                    return None
                return json.loads(resp.read())
        except Exception:
            if attempt == max_retries:
                return None
            time.sleep(0.8 * (attempt + 1))
    return None


def head_ok(url: str) -> bool:
    """Returns True if URL responds with 200 and an image body."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "readmore-backfill/1.0"}, method="HEAD")
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status != 200:
                return False
            # OpenLibrary returns a 1x1 placeholder when there's no real cover;
            # detect via Content-Length. Real covers are tens of KB.
            cl = resp.headers.get("Content-Length")
            if cl and int(cl) < 1000:
                return False
            return True
    except Exception:
        return False


def isbn_cover(isbn: str) -> Optional[str]:
    """If openlibrary has a cover for this ISBN, return the URL."""
    url = OL_COVER_ISBN.format(urllib.parse.quote(isbn))
    return url if head_ok(url) else None


def search_book(title: str, author: str, isbn: Optional[str]) -> Optional[dict]:
    """Search openlibrary for the best match. Returns the doc dict or None."""
    # ISBN-first search is most precise
    if isbn:
        url = f"{OL_SEARCH}?isbn={urllib.parse.quote(isbn)}&limit=3"
        data = fetch(url)
        if data and data.get("numFound"):
            doc = pick_doc(data.get("docs", []), title, author)
            if doc:
                return doc

    # Title+author search
    parts = []
    if title:
        parts.append(f"title={urllib.parse.quote(title)}")
    if author:
        parts.append(f"author={urllib.parse.quote(author)}")
    if not parts:
        return None
    url = f"{OL_SEARCH}?{'&'.join(parts)}&limit=10"
    data = fetch(url)
    if not data:
        return None
    return pick_doc(data.get("docs", []), title, author)


def pick_doc(docs: list, our_title: str, our_author: str) -> Optional[dict]:
    if not docs:
        return None
    our_t = norm(our_title)
    our_a = norm(our_author)
    scored = []
    for d in docs:
        rt = norm(d.get("title", ""))
        names = " ".join(norm(a) for a in (d.get("author_name") or []))
        score = 0
        if rt == our_t:
            score += 10
        elif our_t and (our_t in rt or rt in our_t):
            score += 5
        if our_a and our_a in names:
            score += 4
        if d.get("cover_i"):
            score += 1  # prefer docs that have a cover at all
        scored.append((score, d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored[0][0] >= 5 else None


def get_description_openlibrary(work_key: str) -> Optional[str]:
    if not work_key:
        return None
    if not work_key.startswith("/"):
        work_key = "/" + work_key
    url = f"https://openlibrary.org{work_key}.json"
    data = fetch(url)
    if not data:
        return None
    desc = data.get("description")
    if not desc:
        return None
    if isinstance(desc, dict):
        desc = desc.get("value", "")
    desc = re.sub(r"<[^>]+>", "", str(desc))
    desc = re.sub(r"\s*\(\[source\][^)]*\)\s*$", "", desc)
    desc = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", desc)
    desc = re.sub(r"\s+", " ", desc).strip()
    return desc or None


def get_description_wikipedia(title: str, author: str) -> Optional[str]:
    """Try several Wikipedia slug patterns and return a verified summary."""
    if not title:
        return None
    last_name = (author.split()[-1] if author else "").strip()
    last_norm = norm(last_name)
    title_safe = title.replace(" ", "_")
    candidates = [
        f"{title_safe}_(novel)",
        f"{title_safe}_({last_name}_novel)" if last_name else None,
        title_safe,
    ]
    candidates = [c for c in candidates if c]
    for slug in candidates:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(slug, safe='_()')}"
        data = fetch(url)
        if not data or data.get("type") == "disambiguation" or not data.get("extract"):
            continue
        extract = data.get("extract", "")
        desc_short = data.get("description", "") or ""
        # Verify the article actually mentions the author — guards against
        # totally unrelated articles when the title is generic.
        if last_norm and last_norm not in norm(extract + " " + desc_short):
            continue
        text = re.sub(r"\s+", " ", extract).strip()
        if text:
            return text
    return None


def lookup(book: dict) -> tuple:
    """Returns (cover_url or None, description or None)."""
    title = book.get("title", "")
    author = (book.get("authors") or [book.get("author_raw", "")])[0] if book.get("authors") else book.get("author_raw", "")
    isbn = book.get("isbn")
    existing_ol = book.get("ol_key")

    cover_url = None
    description = None

    # Cover via ISBN cover endpoint (fastest)
    if not book.get("cover_url") and isbn:
        cover_url = isbn_cover(isbn)

    # If we still need cover OR we need description, do a search to get work key + cover_i
    need_more = (not book.get("cover_url") and not cover_url) or (not book.get("description") and not existing_ol)
    work_key = existing_ol

    if need_more:
        doc = search_book(title, author, isbn)
        if doc:
            if not work_key:
                work_key = doc.get("key")  # /works/OLnnnW
            if not book.get("cover_url") and not cover_url:
                cover_i = doc.get("cover_i")
                if cover_i:
                    candidate = OL_COVER_ID.format(cover_i)
                    if head_ok(candidate):
                        cover_url = candidate

    if not book.get("description"):
        if work_key:
            description = get_description_openlibrary(work_key)
        if not description:
            description = get_description_wikipedia(title, author)

    return cover_url, description, work_key


def main():
    with open(DATA_PATH) as f:
        d = json.load(f)

    books = d["books"]
    missing = [(i, b) for i, b in enumerate(books) if not b.get("cover_url") or not b.get("description")]

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(missing)
    missing = missing[:limit]

    print(f"Processing {len(missing)} books missing cover or description...")

    updated_cover = 0
    updated_desc = 0
    no_match = []

    for n, (i, b) in enumerate(missing, 1):
        title = b.get("title")
        author = (b.get("authors") or [b.get("author_raw", "")])[0] if b.get("authors") else b.get("author_raw", "")
        cover_url, description, work_key = lookup(b)

        wrote_cover = False
        wrote_desc = False
        if cover_url and not b.get("cover_url"):
            b["cover_url"] = cover_url
            updated_cover += 1
            wrote_cover = True
        if description and not b.get("description"):
            b["description"] = description
            updated_desc += 1
            wrote_desc = True
        if work_key and not b.get("ol_key"):
            b["ol_key"] = work_key

        if not wrote_cover and not wrote_desc:
            no_match.append(f"{b.get('year')} {b.get('category')}: {title!r} by {author}")
        flag = ("C" if wrote_cover else ".") + ("D" if wrote_desc else ".")
        print(f"  [{n:3d}/{len(missing)}] {flag} {title[:50]:50}  ({author[:25]})")

        # Periodically checkpoint so a Ctrl-C doesn't lose everything
        if n % 25 == 0:
            with open(DATA_PATH, "w") as f:
                json.dump(d, f, indent=2, ensure_ascii=False)

        time.sleep(0.3)  # polite to openlibrary

    with open(DATA_PATH, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

    print()
    print(f"Done. Updated {updated_cover} covers, {updated_desc} descriptions.")
    if no_match:
        print(f"No usable match for {len(no_match)} books:")
        for line in no_match[:40]:
            print(f"  {line}")
        if len(no_match) > 40:
            print(f"  ...and {len(no_match) - 40} more")


if __name__ == "__main__":
    main()
