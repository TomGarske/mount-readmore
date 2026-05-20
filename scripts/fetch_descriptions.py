"""Fill missing book descriptions from Wikipedia (automated, high-precision).

Open Library is exhausted for the books that still lack a description (see
scripts/retry_openlibrary.py — most already have an OL cover but the work has
no description text). Google Books is rate-limited (HTTP 429) from CI/shared
egress. Wikipedia's REST summary, by contrast, is reliable and returns clean
one-to-three sentence extracts that almost always open with
"<Title> is a <year> science fiction novel by <Author>" — which lets us gate
hard on accuracy: we only accept an extract that names the book's author AND
describes a work (novel / novella / novelette / short story / collection).

Hits are written to data/supplemental_descriptions.json keyed by canonical book
id. build_site_data.py folds them in (filling description only when still
empty, so hand-curated manual_overrides.json still wins).

Usage:
    python scripts/fetch_descriptions.py \
        --site site/data.json \
        --out  data/supplemental_descriptions.json
    # add --force to re-check ids already present in the out file
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

WIKI_SEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
UA = "readmoresff-enrich/0.1 (https://readmoresff.org; book description backfill)"

# Strong "this page is about a written work" signals. Deliberately excludes the
# bare word "story" (too loose — appears in author bios) to keep precision high.
STRONG_WORK_WORDS = (
    "novel", "novella", "novelette", "short story", "short-story",
    "collection", "anthology", "novelette", "fix-up",
)


def _get(url: str, params: dict | None = None, tries: int = 3):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(0.6 * (attempt + 1))
    raise last  # type: ignore[misc]


def title_variants(title: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []

    def push(t: str) -> None:
        t = re.sub(r"\s+", " ", t).strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)

    push(title)
    m = re.search(r"^(.*?)\s*\((?:also known as|aka|UK:|US:)\s+([^)]+)\)\s*(.*)$", title, flags=re.I)
    if m:
        push(m.group(1) + (" " + m.group(3) if m.group(3) else ""))
        push(m.group(2))
    if "(" in title:
        push(title.split("(", 1)[0])
    push(re.sub(r"\s*\([^)]+\)\s*$", "", title))
    if ":" in title:
        push(title.split(":", 1)[0])
    if "," in title:
        push(title.split(",", 1)[0])
    return out


def _norm_title(s: str) -> list[str]:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\b(a|an|the)\b", " ", s)
    return [t for t in s.split() if t]


def _strip_disambig(page_title: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", page_title or "").strip()


def title_matches(page_title: str, variants: list[str]) -> bool:
    """True only if the Wikipedia page is actually about OUR title — guards
    against same-author sequels/series pages (e.g. 'Beggars in Spain' for
    'Beggars and Choosers'). Accepts exact or token-prefix matches either way."""
    pt = _norm_title(_strip_disambig(page_title))
    if not pt:
        return False
    for v in variants:
        vt = _norm_title(v)
        if not vt:
            continue
        if pt == vt:
            return True
        shorter, longer = (pt, vt) if len(pt) <= len(vt) else (vt, pt)
        if longer[: len(shorter)] == shorter:   # token-level prefix either way
            return True
    return False


def author_surname(author: str) -> str:
    a = re.sub(r"\([^)]*\)", "", author)            # drop "(as X)", "(French)"
    a = re.sub(r"\b(jr|sr|iii|ii)\.?$", "", a.strip(), flags=re.I).strip()
    toks = [t for t in re.split(r"\s+", a) if t]
    return toks[-1] if toks else ""


def accept(summ: dict | None, author: str, variants: list[str]) -> bool:
    if not summ or summ.get("type") == "disambiguation":
        return False
    extract = (summ.get("extract") or "").strip()
    e = extract.lower()
    if len(e) < 30:
        return False
    surname = author_surname(author).lower()
    if not surname or surname not in e:                 # must name the author
        return False
    page_title = (summ.get("title") or "").strip()
    if page_title.lower() == author.strip().lower():    # the author's own bio page
        return False
    if not any(w in e for w in STRONG_WORK_WORDS):       # must describe a work
        return False
    if not title_matches(page_title, variants):          # must be OUR title, not a sibling
        return False
    return True


def clean_extract(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def wiki_summary(page_title: str) -> dict | None:
    enc = urllib.parse.quote(page_title.replace(" ", "_"), safe="")
    try:
        return _get(WIKI_SUMMARY.format(title=enc))
    except Exception:  # noqa: BLE001
        return None


def wiki_search(query: str, limit: int = 5) -> list[str]:
    try:
        data = _get(WIKI_SEARCH, {
            "action": "query", "list": "search", "format": "json",
            "srlimit": limit, "srsearch": query,
        })
        return [h["title"] for h in data.get("query", {}).get("search", [])]
    except Exception:  # noqa: BLE001
        return []


def find_description(title: str, author: str) -> dict | None:
    candidates: list[str] = []
    seen: set[str] = set()

    def add(t: str) -> None:
        if t and t.lower() not in seen:
            seen.add(t.lower())
            candidates.append(t)

    tvs = title_variants(title)
    # 1) Direct REST tries with the common WP disambiguator suffixes.
    for tv in tvs:
        add(tv)
        for suffix in ("(novel)", "(novella)", "(novelette)", "(short story)"):
            add(f"{tv} {suffix}")
    # 2) Search-driven candidates.
    for tv in tvs[:2]:
        for pt in wiki_search(f'"{tv}" {author}', limit=5):
            add(pt)
        time.sleep(0.15)

    checked = 0
    for cand in candidates:
        if checked >= 10:
            break
        summ = wiki_summary(cand)
        checked += 1
        time.sleep(0.15)
        if accept(summ, author, tvs):
            return {
                "description": clean_extract(summ.get("extract")),
                "source": "wikipedia",
                "wiki_title": summ.get("title"),
                "url": (summ.get("content_urls", {}).get("desktop", {}) or {}).get("page"),
            }
    return None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--site", type=Path, default=Path("site/data.json"))
    p.add_argument("--out", type=Path, default=Path("data/supplemental_descriptions.json"))
    p.add_argument("--limit", type=int, default=0, help="cap books processed (0 = all)")
    p.add_argument("--force", action="store_true", help="re-check ids already in --out")
    args = p.parse_args()

    site = json.loads(args.site.read_text())
    books = site["books"] if isinstance(site, dict) else site
    out: dict = json.loads(args.out.read_text()) if args.out.exists() else {}

    needy = [b for b in books if not (b.get("description") or "").strip()]
    if not args.force:
        needy = [b for b in needy if b["id"] not in out]
    if args.limit:
        needy = needy[: args.limit]
    print(f"Books missing a description to process: {len(needy)}")

    filled = 0
    misses: list[str] = []
    for i, b in enumerate(needy, 1):
        title = b.get("title", "")
        author = (b.get("authors") or [""])[0]
        print(f"[{i:3d}/{len(needy)}] {title[:48]:48s} | {author[:24]:24s}", end="  ")
        hit = find_description(title, author)
        if hit:
            out[b["id"]] = hit
            filled += 1
            print(f"OK <- {hit['wiki_title']}")
        else:
            misses.append(f"{title} | {author}")
            print("miss")

    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True))
    print()
    print(f"Filled this run:        {filled}")
    print(f"Still missing:          {len(misses)}")
    print(f"Total in {args.out.name}: {len(out)}")
    if misses:
        print("Misses:")
        for m in misses:
            print(f"  - {m}")


if __name__ == "__main__":
    main()
