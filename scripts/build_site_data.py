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
    "best_series_hugo": "Series",
    "favorites": "Favorite",
}

TITLE_COL_FOR_SHEET = {
    "best_novel": "Novel",
    "best_novella_hugo": "Novel",
    "best_novelette_hugo": "Novelette",
    "best_series_hugo": "Series",
    "favorites": "Novel",
}


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

    award_cols = [c for c in ["Hugo", "Nebula", "WFA", "Mythopoeic", "Kitschies"] if c in df.columns]

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
        })

    return records


def apply_cover_cache(records: list[dict], cache_path: Path) -> int:
    if not cache_path.exists():
        return 0
    with cache_path.open() as f:
        cache = json.load(f)
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
        if meta.get("cover_url"):
            applied += 1
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

    # Deduplicate ids in case of slug collision
    seen: dict[str, int] = {}
    for r in all_records:
        base = r["id"]
        n = seen.get(base, 0)
        if n:
            r["id"] = f"{base}-{n}"
        seen[base] = n + 1

    covers = apply_cover_cache(all_records, args.data / "openlib_cache.json")
    print(f"  Applied {covers} cover URLs from cache")

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
