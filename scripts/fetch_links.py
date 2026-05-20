"""Resolve canonical Bookshop.org product links for books missing a read link.

bookshop.org/book/<ISBN13> issues a 308 redirect to the canonical product page
(/p/books/<slug>/<id>?ean=<ISBN>&next=t). We read that redirect target (the
product page itself 403s bots, but the redirect header comes back fine), strip
the &next=t tracking suffix, and store it — which matches the hand-curated
bookshop_url format already in manual_overrides.json exactly.

Only books WITH an ISBN that Bookshop actually carries get a link. Everything
else (magazine short fiction with no ISBN, etc.) is left missing for hand
curation as a free-to-read publication_url — per the rule "if it's really
published online to read, link that; otherwise Bookshop; if you can't, leave
it missing."

Output: data/auto_links.json  { book_id: {bookshop_url, source} }

Usage:
    python scripts/fetch_links.py --site site/data.json --out data/auto_links.json
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401, ANN001
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def isbn13(book: dict) -> str | None:
    raw = (book.get("isbn") or "").strip().replace("-", "").replace(" ", "")
    if re.fullmatch(r"\d{13}", raw):
        return raw
    if re.fullmatch(r"\d{9}[\dXx]", raw):  # ISBN-10 -> ISBN-13
        core = "978" + raw[:9]
        s = sum((1 if i % 2 == 0 else 3) * int(c) for i, c in enumerate(core))
        return core + str((10 - s % 10) % 10)
    return None


def resolve_bookshop(isbn: str) -> str | None:
    url = f"https://bookshop.org/book/{isbn}"
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    loc = None
    try:
        resp = _OPENER.open(req, timeout=15)
        loc = resp.headers.get("Location")
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            loc = e.headers.get("Location")
    except Exception:  # noqa: BLE001
        return None
    if not loc or "/p/books/" not in loc:
        return None
    if loc.startswith("/"):
        loc = "https://bookshop.org" + loc
    # Normalize to the canonical "<product-path>?ean=<ISBN>" form, dropping
    # tracking/variant params (next=t, digital=t, etc.).
    base = loc.split("?", 1)[0]
    m = re.search(r"[?&]ean=(\d{13})", loc)
    ean = m.group(1) if m else isbn
    return f"{base}?ean={ean}"


def ol_edition_isbns(title: str, author: str) -> list[str]:
    """All edition ISBN-13s for a work, via Open Library search — used to find
    the specific edition Bookshop actually lists when our stored ISBN is a
    different printing."""
    q = "https://openlibrary.org/search.json?" + urllib.parse.urlencode(
        {"title": title, "author": author, "fields": "isbn", "limit": 2})
    try:
        req = urllib.request.Request(q, headers={"User-Agent": "readmoresff-enrich/0.1"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.load(r)
    except Exception:  # noqa: BLE001
        return []
    out, seen = [], set()
    for d in data.get("docs", []):
        for i in d.get("isbn", []) or []:
            ii = i.replace("-", "").replace(" ", "")
            if re.fullmatch(r"\d{13}", ii) and ii not in seen:
                seen.add(ii)
                out.append(ii)
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--site", type=Path, default=Path("site/data.json"))
    p.add_argument("--out", type=Path, default=Path("data/auto_links.json"))
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--force", action="store_true")
    p.add_argument("--alternates", action="store_true",
                   help="on a direct-ISBN miss, try the work's other edition ISBNs via Open Library")
    p.add_argument("--min-year", type=int, default=0)
    p.add_argument("--category", default="")
    args = p.parse_args()

    site = json.loads(args.site.read_text())
    books = site["books"] if isinstance(site, dict) else site
    out: dict = json.loads(args.out.read_text()) if args.out.exists() else {}

    needy = [b for b in books
             if not (b.get("publication_url") or b.get("bookshop_url") or "").strip()]
    if not args.force:
        needy = [b for b in needy if b["id"] not in out]
    if args.min_year:
        needy = [b for b in needy if (b.get("year") or 0) >= args.min_year]
    if args.category:
        needy = [b for b in needy if b.get("category") == args.category]
    if args.limit:
        needy = needy[: args.limit]

    with_isbn = [b for b in needy if isbn13(b)]
    print(f"Missing-link books to process: {len(needy)} ({len(with_isbn)} have an ISBN)")

    found = 0
    no_isbn = 0
    not_carried = 0
    for i, b in enumerate(needy, 1):
        isbn = isbn13(b)
        if not isbn:
            no_isbn += 1
            continue
        url = resolve_bookshop(isbn)
        if not url and args.alternates:
            author = (b.get("authors") or [""])[0]
            for alt in ol_edition_isbns(b.get("title", ""), author)[:8]:
                if alt == isbn:
                    continue
                url = resolve_bookshop(alt)
                time.sleep(0.4)
                if url:
                    break
        if url:
            out[b["id"]] = {"bookshop_url": url, "source": "bookshop-isbn"}
            found += 1
            tag = "OK"
        else:
            not_carried += 1
            tag = "not on bookshop"
        if i % 25 == 0 or url:
            print(f"[{i:4d}/{len(needy)}] {b['id'][:46]:46s} {tag}")
        time.sleep(0.4)

    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True))
    print()
    print(f"Bookshop links found:   {found}")
    print(f"No usable ISBN:         {no_isbn}  (free-online or hand-curate)")
    print(f"ISBN not on Bookshop:   {not_carried}")
    print(f"Total in {args.out.name}: {len(out)}")


if __name__ == "__main__":
    main()
