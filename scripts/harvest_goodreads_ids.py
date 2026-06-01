"""Harvest Goodreads Book IDs + ISBNs from the personal export.

Reads exports/goodreads_export.csv (the user's "Export Library" download),
normalizes title + author, matches against site/data.json records, and emits
data/goodreads_ids.json — a flat map keyed by the site's canonical book id.

Output schema:
    {
      "the-tainted-cup-bennett-2025-novel": {
        "goodreads_id": "61209853",
        "isbn":    "0593723821",
        "isbn13":  "9780593723821",
        "matched_title":  "The Tainted Cup",
        "matched_author": "Robert Jackson Bennett"
      },
      ...
    }

Usage:
    python scripts/harvest_goodreads_ids.py \
        --export exports/goodreads_export.csv \
        --site   site/data.json \
        --out    data/goodreads_ids.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
from pathlib import Path

import httpx

OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json"


def normalize(s: str) -> str:
    """Lowercase, strip non-alphanumeric. Aggressive — used only for matching."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def strip_series_suffix(title: str) -> str:
    """'Foo (Bar, #1)' -> 'Foo'. Goodreads tacks series suffixes onto every title."""
    if "(" in title:
        return title.split("(", 1)[0].strip()
    return title


def strip_excel_string(s: str) -> str:
    """Goodreads exports wrap ISBNs as Excel string literals: '="0593723821"' -> '0593723821'."""
    if not s:
        return ""
    s = s.strip()
    if s.startswith('="') and s.endswith('"'):
        s = s[2:-1]
    return s.strip()


def alt_title_variants(title: str) -> list[str]:
    """Yield ['main', 'alternate'] when a title has '(also known as X)' or 'main (X)' format.
    Used to widen the match window for titles that carry US/UK variants in the canon."""
    out = [title]
    base = strip_series_suffix(title)
    if base != title:
        out.append(base)
    # 'A (also known as B)' or 'A (UK: B)'
    m = re.search(r"\((?:also known as|UK:|US:|aka)\s+([^)]+)\)", title, flags=re.I)
    if m:
        out.append(m.group(1).strip())
        out.append(re.sub(r"\([^)]+\)", "", title).strip())
    return out


def author_variants(author: str) -> list[str]:
    """Strip pseudonym annotations: 'A (as B)' -> ['A (as B)', 'A', 'B']."""
    out = [author]
    m = re.search(r"^(.*?)\s*\(as\s+([^)]+)\)\s*$", author, flags=re.I)
    if m:
        out.append(m.group(1).strip())
        out.append(m.group(2).strip())
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--export", type=Path, default=Path("exports/goodreads_export.csv"))
    p.add_argument("--site", type=Path, default=Path("site/data.json"))
    p.add_argument("--out", type=Path, default=Path("data/goodreads_ids.json"))
    p.add_argument("--skip-open-library", action="store_true",
                   help="Skip the OL fallback pass (export-only mode)")
    p.add_argument("--limit", type=int, default=0,
                   help="Cap on OL-sourced matches per run (0 = no cap)")
    args = p.parse_args()

    with args.site.open() as f:
        site = json.load(f)
    canon = site["books"]

    # Build lookup table keyed by (normalized_title, normalized_author) for the canon.
    # Each canon book gets indexed under every (title, author) variant we can think of
    # so a Goodreads row with an annotated alt-title still finds its match.
    canon_index: dict[tuple[str, str], dict] = {}
    isbn_index: dict[str, dict] = {}
    isbn13_index: dict[str, dict] = {}
    for rec in canon:
        title = rec.get("title", "")
        authors = rec.get("authors") or []
        primary_author = authors[0] if authors else ""
        for t in alt_title_variants(title):
            for a in author_variants(primary_author):
                canon_index[(normalize(t), normalize(a))] = rec
        if rec.get("isbn"):
            isbn_index[rec["isbn"]] = rec

    # Walk the Goodreads export, attempting to match each row to a canon record.
    matches: dict[str, dict] = {}
    seen_book_ids: set[str] = set()
    skipped_no_match = 0
    skipped_dup = 0
    with args.export.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            gr_id = row.get("Book Id", "").strip()
            if not gr_id:
                continue
            isbn = strip_excel_string(row.get("ISBN", ""))
            isbn13 = strip_excel_string(row.get("ISBN13", ""))
            title = strip_series_suffix(row.get("Title", ""))
            author = row.get("Author", "")
            # Match priority: ISBN13 → ISBN → (title, author) normalized.
            rec = None
            if isbn13 and isbn13 in isbn13_index:
                rec = isbn13_index[isbn13]
            elif isbn and isbn in isbn_index:
                rec = isbn_index[isbn]
            else:
                # Try every (title-variant, author-variant) pair the canon indexed.
                for t in alt_title_variants(title):
                    if rec:
                        break
                    for a in author_variants(author):
                        key = (normalize(t), normalize(a))
                        if key in canon_index:
                            rec = canon_index[key]
                            break
            if rec is None:
                skipped_no_match += 1
                continue
            if rec["id"] in matches:
                # Goodreads can have multiple editions per work — keep the first match.
                skipped_dup += 1
                continue
            matches[rec["id"]] = {
                "goodreads_id": gr_id,
                "isbn": isbn or None,
                "isbn13": isbn13 or None,
                "matched_title": row.get("Title", ""),
                "matched_author": author,
            }
            seen_book_ids.add(gr_id)

    # Second pass: for canon books we DIDN'T match in the export, query
    # Open Library's search.json with fields=id_goodreads. OL has Goodreads
    # IDs threaded onto edition records for a huge fraction of older books
    # (where Goodreads' own search is now WAF-blocked for automation).
    if not args.skip_open_library:
        ol_added = 0
        unmatched_canon = [r for r in canon if r["id"] not in matches]
        print(f"\nQuerying Open Library for {len(unmatched_canon)} unmatched canon books...")
        with httpx.Client(headers={"User-Agent": "award-books-tracker/0.3 (ol-gr-ids)"}) as client:
            for i, rec in enumerate(unmatched_canon, 1):
                if args.limit and ol_added >= args.limit:
                    break
                title = rec.get("title", "")
                authors = rec.get("authors") or []
                primary = authors[0] if authors else ""
                # Try the title as-is first, then a "strip after colon" variant.
                queries = [(title, primary)]
                if ":" in title:
                    queries.append((title.split(":", 1)[0], primary))
                hit_id: str | None = None
                hit_isbn: str | None = None
                for t, a in queries:
                    if hit_id:
                        break
                    params = {
                        "title": t,
                        "author": a,
                        "fields": "key,title,id_goodreads,isbn,cover_i",
                        "limit": 3,
                    }
                    try:
                        r = client.get(OPEN_LIBRARY_SEARCH, params=params, timeout=10.0)
                        r.raise_for_status()
                        docs = r.json().get("docs", [])
                    except Exception:
                        docs = []
                    for d in docs:
                        gr_list = d.get("id_goodreads") or []
                        if gr_list:
                            hit_id = str(gr_list[0])
                            isbn_list = d.get("isbn") or []
                            if isbn_list:
                                hit_isbn = isbn_list[0]
                            break
                    time.sleep(0.2)
                if hit_id:
                    matches[rec["id"]] = {
                        "goodreads_id": hit_id,
                        "isbn": hit_isbn,
                        "isbn13": None,
                        "matched_title": rec.get("title", ""),
                        "matched_author": primary,
                        "source": "open_library",
                    }
                    ol_added += 1
                if i % 25 == 0:
                    print(f"  {i}/{len(unmatched_canon)} processed, {ol_added} matched")
        print(f"Open Library second pass added: {ol_added}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(matches, indent=2, sort_keys=True))
    print(f"\nGoodreads rows scanned:  {sum(1 for _ in args.export.open().readlines()) - 1}")
    print(f"Canon books in site:     {len(canon)}")
    print(f"Matched (written):       {len(matches)}")
    print(f"  with ISBN backfill:    {sum(1 for v in matches.values() if v.get('isbn') or v.get('isbn13'))}")
    print(f"GR rows w/o canon match: {skipped_no_match}")
    print(f"GR rows skipped as dup:  {skipped_dup}")
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
