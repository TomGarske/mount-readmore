"""Normalize award sheet CSVs into a single site/data.json for the static site.

Reads *_updated.csv (or *.csv if no updated version), produces a JSON array of
records like:
    {
      "id": "the-tainted-cup-bennett-2025",
      "title": "The Tainted Cup",
      "authors": ["Robert Jackson Bennett"],
      "category": "Novel",
      "year": 2025,
      "publisher": "Del Rey",
      "awards": {"hugo": "winner"},
      "tom": "Read",
      "nika": ""
    }

Usage:
    python scripts/build_site_data.py --data data --out site/data.json
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

CATEGORY_FOR_SHEET = {
    "best_novel": "Novel",
    "best_novella_hugo": "Novella",
    "best_novelette_hugo": "Novelette",
    "favorites": "Favorite",
}

TITLE_COL_FOR_SHEET = {
    "best_novel": "Novel",
    "best_novella_hugo": "Novel",
    "best_novelette_hugo": "Novelette",
    "favorites": "Novel",
}


import re as _re

# Subgenre rules — checked first, narrower / more specific
SUBGENRE_RULES = [
    ("Space Opera",      [r"space opera", r"interplanetary", r"galactic empire"]),
    ("Hard SF",          [r"hard science fiction", r"hard sf", r"hard sci"]),
    ("Time Travel",      [r"time travel", r"time-travel"]),
    ("Cyberpunk",        [r"cyberpunk", r"cyber-punk"]),
    ("Dystopian",        [r"dystopia", r"post-apocalyp", r"postapocalyp"]),
    ("First Contact",    [r"human-alien", r"first contact"]),
    ("Military SF",      [r"military science fiction", r"military sf", r"space war"]),
    ("Alternate History", [r"alternate history", r"alternative history"]),
    ("Urban Fantasy",    [r"urban fantasy"]),
    ("Epic Fantasy",     [r"epic fantasy", r"heroic fantasy", r"sword and sorcery"]),
    ("Magical Realism",  [r"magical realism", r"magic realism"]),
    ("Fairy Tale",       [r"fairy tale", r"folklore", r"folk tale"]),
    ("Horror",           [r"\bhorror\b"]),
]
_SUBGENRE_RES = [(label, [_re.compile(p, _re.IGNORECASE) for p in pats]) for label, pats in SUBGENRE_RULES]

# Primary genre detection — Science Fiction vs Fantasy vs Blend
_RE_SF = _re.compile(r"science[ -]?fiction|\bsf\b|science-fiction|space opera|hard science|cyberpunk|interplanetary|robot|spaceship|extraterrestrial", _re.IGNORECASE)
_RE_FANTASY = _re.compile(r"\bfantasy\b|\bmagic\b|dragon|wizard|witch|sorcer|elves|fairy tale|mythopo", _re.IGNORECASE)


def categorize_genres(subjects: list[str]) -> tuple[str, list[str]]:
    """Return (primary_genre, subgenres). primary is 'Science Fiction', 'Fantasy', 'Blend', 'Horror', or '' if unknown."""
    if not subjects:
        return "", []
    text = " | ".join(subjects).lower()
    has_sf = bool(_RE_SF.search(text))
    has_fantasy = bool(_RE_FANTASY.search(text))
    # Subgenres
    subgenres = []
    for label, regexes in _SUBGENRE_RES:
        if any(rx.search(text) for rx in regexes):
            subgenres.append(label)
    # Primary
    if has_sf and has_fantasy:
        primary = "Blend"
    elif has_sf:
        primary = "Science Fiction"
    elif has_fantasy:
        primary = "Fantasy"
    elif "Horror" in subgenres:
        primary = "Horror"
    else:
        primary = ""
    return primary, subgenres


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def parse_authors(raw: str) -> list[str]:
    if not raw:
        return []
    # Common separators: ' and ', ', ', '/' (e.g. 'Robert Jordan/Brandon Sanderson')
    parts = re.split(r"\s+and\s+|,\s*|/", raw)
    return [p.strip() for p in parts if p.strip()]


def parse_year(raw: str) -> int | None:
    if not raw:
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def normalize_status(raw: str) -> str | None:
    if not raw:
        return None
    v = raw.strip().lower()
    if v in ("winner", "won"):
        return "winner"
    if v in ("nominee", "nominated", "finalist", "shortlist"):
        return "nominee"
    return v or None


def process_csv(path: Path, sheet_stem: str) -> list[dict]:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    category = CATEGORY_FOR_SHEET.get(sheet_stem, "Other")
    title_col = TITLE_COL_FOR_SHEET.get(sheet_stem)
    author_col = "Author(s)" if "Author(s)" in df.columns else "Author"

    # Only track Hugo and Nebula. WFA/Mythopoeic/Kitschies columns are ignored.
    award_cols = [c for c in ["Hugo", "Nebula"] if c in df.columns]

    records = []
    for _, row in df.iterrows():
        title = (row.get(title_col, "") or "").strip()
        if not title:
            continue
        author_raw = (row.get(author_col, "") or "").strip()
        year = parse_year(row.get("Year", ""))
        publisher = (row.get("Publisher", "") or row.get("Publisher or publication", "") or "").strip()

        awards = {}
        for col in award_cols:
            status = normalize_status(row.get(col, ""))
            if status:
                awards[col.lower()] = status

        if not awards and "Hugo" in df.columns:
            # 7-col Hugo-only sheets where the status sits in the Hugo column
            status = normalize_status(row.get("Hugo", ""))
            if status:
                awards["hugo"] = status

        if not awards:
            continue  # skip rows with no award status (junk)

        tom = (row.get("Tom", "") or "").strip()
        nika = (row.get("Nika", "") or "").strip()
        tom_date_read = (row.get("Tom Date Read", "") or "").strip()
        tom_rating = (row.get("Tom Rating", "") or "").strip()
        tom_shelf = (row.get("Tom Shelf", "") or "").strip()
        nika_shelf = (row.get("Nika Shelf", "") or "").strip()
        westdac = (row.get("Westdac", "") or "").strip()
        westdac_shelf = (row.get("Westdac Shelf", "") or "").strip()
        westdac_date_read = (row.get("Westdac Date Read", "") or "").strip()
        westdac_rating = (row.get("Westdac Rating", "") or "").strip()
        colton = (row.get("Colton", "") or "").strip()
        colton_shelf = (row.get("Colton Shelf", "") or "").strip()
        colton_date_read = (row.get("Colton Date Read", "") or "").strip()
        colton_rating = (row.get("Colton Rating", "") or "").strip()
        schupp = (row.get("Schupp", "") or "").strip()
        schupp_shelf = (row.get("Schupp Shelf", "") or "").strip()
        schupp_date_read = (row.get("Schupp Date Read", "") or "").strip()
        schupp_rating = (row.get("Schupp Rating", "") or "").strip()
        series = (row.get("Series", "") or "").strip()

        authors = parse_authors(author_raw)
        first_author = authors[0] if authors else "unknown"
        slug_base = f"{slugify(title)}-{slugify(first_author.split()[-1] if first_author != 'unknown' else 'x')}-{year or 'n'}-{category.lower()}"

        records.append({
            "id": slug_base,
            "title": title,
            "authors": authors,
            "author_raw": author_raw,
            "category": category,
            "year": year,
            "publisher": publisher,
            "awards": awards,
            "tom": tom,
            "nika": nika,
            "tom_date_read": tom_date_read,
            "tom_rating": tom_rating,
            "tom_shelf": tom_shelf,
            "nika_shelf": nika_shelf,
            "westdac": westdac,
            "westdac_shelf": westdac_shelf,
            "westdac_date_read": westdac_date_read,
            "westdac_rating": westdac_rating,
            "colton": colton,
            "colton_shelf": colton_shelf,
            "colton_date_read": colton_date_read,
            "colton_rating": colton_rating,
            "schupp": schupp,
            "schupp_shelf": schupp_shelf,
            "schupp_date_read": schupp_date_read,
            "schupp_rating": schupp_rating,
            "series": series,
        })

    return records


def apply_author_gender(records: list[dict], path: Path) -> int:
    if not path.exists():
        return 0
    with path.open() as f:
        lookup = json.load(f)
    applied = 0
    for r in records:
        authors = r.get("authors") or []
        if not authors:
            continue
        # Per-author genders + primary (first author)
        per = [lookup.get(a, "unknown") for a in authors]
        r["author_genders"] = per
        r["primary_author_gender"] = per[0] if per else "unknown"
        if r["primary_author_gender"] != "unknown":
            applied += 1
    return applied


def apply_google_books_cache(records: list[dict], path: Path) -> int:
    """Second-pass cover enrichment: for books without cover_url after Open Library,
    fill in from Google Books cache."""
    if not path.exists():
        return 0
    with path.open() as f:
        cache = json.load(f)
    applied = 0
    for r in records:
        if r.get("cover_url"):
            continue
        author = r["authors"][0] if r.get("authors") else ""
        key = f"{r['title'].strip().lower()}|{author.strip().lower()}"
        meta = cache.get(key)
        if not meta or not meta.get("cover_url"):
            continue
        r["cover_url"] = meta["cover_url"]
        if not r.get("isbn") and meta.get("isbn"):
            r["isbn"] = meta["isbn"]
        if not r.get("pages") and meta.get("pages"):
            r["pages"] = meta["pages"]
        if not r.get("first_pub_year") and meta.get("first_pub_year"):
            r["first_pub_year"] = meta["first_pub_year"]
        applied += 1
    return applied


def apply_cover_cache(records: list[dict], cache_path: Path, desc_path: Path | None = None) -> int:
    if not cache_path.exists():
        return 0
    with cache_path.open() as f:
        cache = json.load(f)
    desc_cache = {}
    if desc_path and desc_path.exists():
        with desc_path.open() as f:
            desc_cache = json.load(f)
    applied = 0
    for r in records:
        author = r["authors"][0] if r.get("authors") else ""
        key = f"{r['title'].strip().lower()}|{author.strip().lower()}"
        meta = cache.get(key)
        if not meta:
            continue
        for field in ["cover_url", "ol_key", "first_pub_year", "isbn", "pages"]:
            if meta.get(field):
                r[field] = meta[field]
        # Manual description override (set directly in openlib_cache.json) wins
        # over the ol_key -> desc_cache lookup below.
        if meta.get("description"):
            r["description"] = meta["description"]
        if meta.get("cover_url"):
            applied += 1
        ol_key = meta.get("ol_key", "")
        if ol_key and ol_key in desc_cache:
            d = desc_cache[ol_key].get("description", "")
            if d:
                r["description"] = d
            subjects = desc_cache[ol_key].get("subjects", [])
            if subjects:
                r["subjects"] = subjects
                primary, subs = categorize_genres(subjects)
                if primary:
                    r["primary_genre"] = primary
                if subs:
                    r["subgenres"] = subs
                # Keep legacy "genres" field as union for back-compat with existing UI bits
                r["genres"] = ([primary] if primary else []) + subs
    return applied


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=Path("data"))
    p.add_argument("--out", type=Path, default=Path("site/data.json"))
    args = p.parse_args()

    all_records: list[dict] = []
    for stem in CATEGORY_FOR_SHEET.keys():
        updated = args.data / f"{stem}_updated.csv"
        src = updated if updated.exists() else args.data / f"{stem}.csv"
        if not src.exists():
            continue
        recs = process_csv(src, stem)
        print(f"  {stem:25s} {len(recs):4d} books from {src.name}")
        all_records.extend(recs)

    # Merge duplicate books that appear under multiple award years (e.g. The Moon
    # Is a Harsh Mistress as Hugo 1967 winner + Nebula 1966 nominee). Group by
    # (normalized title, normalized first author, category). Combine awards,
    # take the year of the highest-priority award (winner > nominee, then latest).
    AWARD_PRIORITY = {"winner": 2, "nominee": 1}
    merged: dict[tuple, dict] = {}
    for r in all_records:
        t = (r.get("title") or "").strip().lower()
        a = ((r.get("authors") or [""])[0] or "").strip().lower()
        cat = r.get("category", "")
        key = (t, a, cat)
        if key not in merged:
            merged[key] = r
            r["award_years"] = {k: r.get("year") for k in r.get("awards", {}).keys()}
            continue
        existing = merged[key]
        existing_years = existing.setdefault("award_years", {})
        # Merge awards: winner outranks nominee for the same award
        for award, status in r.get("awards", {}).items():
            cur = existing["awards"].get(award)
            if cur is None or AWARD_PRIORITY.get(status, 0) > AWARD_PRIORITY.get(cur, 0):
                existing["awards"][award] = status
                existing_years[award] = r.get("year")
            elif award not in existing_years:
                existing_years[award] = r.get("year")
        # Year — recompute from highest-priority award
        best_year = None
        best_pri = -1
        for award, status in existing["awards"].items():
            p = AWARD_PRIORITY.get(status, 0)
            yr = existing_years.get(award)
            if yr and (p > best_pri or (p == best_pri and (best_year is None or yr > best_year))):
                best_pri = p
                best_year = yr
        if best_year:
            existing["year"] = best_year
        # Merge reader fields — prefer non-empty
        for col in ["tom", "nika", "westdac", "colton", "schupp",
                    "tom_shelf", "nika_shelf", "westdac_shelf", "colton_shelf", "schupp_shelf",
                    "tom_date_read", "tom_rating",
                    "westdac_date_read", "westdac_rating",
                    "colton_date_read", "colton_rating",
                    "schupp_date_read", "schupp_rating",
                    "series", "publisher"]:
            if not existing.get(col) and r.get(col):
                existing[col] = r[col]
    all_records = list(merged.values())

    # Rebuild ids deterministically after merge (drop year suffix variants)
    seen: dict[str, int] = {}
    for r in all_records:
        # Recompute id without per-year suffix collisions
        first_author = r["authors"][0] if r.get("authors") else "unknown"
        last_name = first_author.split()[-1] if first_author and first_author != "unknown" else "x"
        r["id"] = f"{slugify(r['title'])}-{slugify(last_name)}-{r.get('year') or 'n'}-{r['category'].lower()}"
        base = r["id"]
        n = seen.get(base, 0)
        if n:
            r["id"] = f"{base}-{n}"
        seen[base] = n + 1

    covers = apply_cover_cache(all_records, args.data / "openlib_cache.json", args.data / "openlib_descriptions.json")
    google_covers = apply_google_books_cache(all_records, args.data / "google_books_cache.json")
    descs = sum(1 for r in all_records if r.get("description"))
    gend = apply_author_gender(all_records, args.data / "author_gender.json")
    genres = sum(1 for r in all_records if r.get("genres"))
    total_covers = sum(1 for r in all_records if r.get("cover_url"))
    print(f"  Applied {covers} OL covers + {google_covers} Google Books covers ({total_covers} total) + {descs} descs + {genres} genre sets + {gend} genders")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w") as f:
        json.dump({
            "books": all_records,
            "meta": {
                "total": len(all_records),
                "by_category": {c: sum(1 for r in all_records if r["category"] == c) for c in set(r["category"] for r in all_records)},
            },
        }, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {args.out} with {len(all_records)} books ({covers} with covers)")


if __name__ == "__main__":
    main()
