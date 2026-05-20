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
    "best_novella_nebula": "Novella",
    "best_novelette_hugo": "Novelette",
    "favorites": "Favorite",
}

TITLE_COL_FOR_SHEET = {
    "best_novel": "Novel",
    "best_novella_hugo": "Novel",
    "best_novella_nebula": "Novel",
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


_SUFFIX_RE = re.compile(r"^(jr|sr|ii|iii|iv|v|md|phd|esq)\.?$", re.IGNORECASE)


def parse_authors(raw: str) -> list[str]:
    if not raw:
        return []
    # Common separators: ' and ', ', ', '/' (e.g. 'Robert Jordan/Brandon Sanderson')
    parts = re.split(r"\s+and\s+|,\s*|/", raw)
    parts = [p.strip() for p in parts if p.strip()]
    # Rejoin name suffixes that the comma-split accidentally separated.
    # "James Tiptree, Jr." -> ["James Tiptree", "Jr."] should become
    # ["James Tiptree, Jr."] — same for Sr., II, III, IV, MD, PhD, Esq.
    merged: list[str] = []
    for p in parts:
        if merged and _SUFFIX_RE.match(p):
            merged[-1] = f"{merged[-1]}, {p}"
        else:
            merged.append(p)
    return merged


def lastname_for_slug(full_name: str) -> str:
    """Return the lastname token used for the book id slug.

    Strips trailing name suffixes (Jr., Sr., II, III, IV, V, MD, PhD, Esq)
    AND a comma that introduced them, so 'James Tiptree, Jr.' -> 'Tiptree'
    and 'Walter M. Miller, Jr.' -> 'Miller' rather than the literal 'Jr.'.
    """
    if not full_name or full_name == "unknown":
        return "x"
    # Drop ", Jr." / ", Sr." style suffixes attached by comma.
    cleaned = re.sub(r",\s*(jr|sr|ii|iii|iv|v|md|phd|esq)\.?\s*$", "", full_name, flags=re.IGNORECASE).strip()
    # Also drop a bare trailing token suffix ("Walter M. Miller Jr.").
    parts = cleaned.split()
    while parts and _SUFFIX_RE.match(parts[-1]):
        parts.pop()
    return parts[-1] if parts else "x"


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


# Years for which "Retro Hugos" were awarded — real Hugos began in 1953, so any
# Hugo-column entry in one of these years is actually a Retrospective Hugo, a
# separate award. Source: thehugoawards.org/hugo-history.
RETRO_HUGO_YEARS = {1939, 1941, 1943, 1944, 1945, 1946, 1951, 1954}


def hugo_award_key(year) -> str:
    """Hugo entries in a Retro Hugo year map to the retro_hugo award, not hugo."""
    return "retro_hugo" if year in RETRO_HUGO_YEARS else "hugo"


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
                key = hugo_award_key(year) if col == "Hugo" else col.lower()
                awards[key] = status

        if not awards and "Hugo" in df.columns:
            # 7-col Hugo-only sheets where the status sits in the Hugo column
            status = normalize_status(row.get("Hugo", ""))
            if status:
                awards[hugo_award_key(year)] = status

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
        slug_base = f"{slugify(title)}-{slugify(lastname_for_slug(first_author))}-{year or 'n'}-{category.lower()}"

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


def apply_goodreads_metadata(records: list[dict], path: Path) -> tuple[int, int]:
    """Fold scraped Goodreads book/show data onto canon records.

    Only writes a field when the record is missing it — OL data wins where it
    exists. Returns (covers_added, descriptions_added) for the build log.
    """
    if not path.exists():
        return 0, 0
    with path.open() as f:
        gr = json.load(f)
    covers = 0
    descs = 0
    for r in records:
        entry = gr.get(r.get("id"))
        if not entry:
            continue
        if entry.get("cover_url") and not (r.get("cover_url") or "").strip():
            r["cover_url"] = entry["cover_url"]
            covers += 1
        if entry.get("description") and not (r.get("description") or "").strip():
            r["description"] = entry["description"]
            descs += 1
        if entry.get("isbn") and not r.get("isbn"):
            r["isbn"] = entry["isbn"]
        if entry.get("pages") and not r.get("pages"):
            r["pages"] = entry["pages"]
    return covers, descs


def apply_goodreads_ids(records: list[dict], path: Path) -> int:
    """Fold Goodreads Book IDs (and any ISBNs harvested alongside them) onto
    canon records. Map is keyed by the site's canonical id, so the lookup is
    a single dict hit per book."""
    if not path.exists():
        return 0
    with path.open() as f:
        gr_map = json.load(f)
    applied = 0
    for r in records:
        entry = gr_map.get(r.get("id"))
        if not entry:
            continue
        if entry.get("goodreads_id"):
            r["goodreads_id"] = entry["goodreads_id"]
            applied += 1
        # Backfill ISBN if the canon entry didn't already have one — Goodreads
        # exports include ISBN13 + ISBN10 for many older paperbacks OL missed.
        if not r.get("isbn"):
            if entry.get("isbn"):
                r["isbn"] = entry["isbn"]
            elif entry.get("isbn13"):
                r["isbn"] = entry["isbn13"]
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


def apply_manual_overrides(records: list[dict], path: Path) -> int:
    """Apply hand-curated field overrides from data/manual_overrides.json.
    Keyed by canonical book id; any key in the override dict is set on the
    matching record, overwriting whatever the pipeline produced."""
    if not path.exists():
        return 0
    with path.open() as f:
        overrides = json.load(f)
    applied = 0
    id_map = {r["id"]: r for r in records}
    for book_id, fields in overrides.items():
        rec = id_map.get(book_id)
        if not rec:
            continue
        rec.update(fields)
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
        # Recompute id without per-year suffix collisions. lastname_for_slug
        # strips name suffixes (Jr., Sr., etc.) so "James Tiptree, Jr."
        # slugs as "tiptree" not "jr".
        first_author = r["authors"][0] if r.get("authors") else "unknown"
        last_name = lastname_for_slug(first_author)
        r["id"] = f"{slugify(r['title'])}-{slugify(last_name)}-{r.get('year') or 'n'}-{r['category'].lower()}"
        base = r["id"]
        n = seen.get(base, 0)
        if n:
            r["id"] = f"{base}-{n}"
        seen[base] = n + 1

    covers = apply_cover_cache(all_records, args.data / "openlib_cache.json", args.data / "openlib_descriptions.json")
    google_covers = apply_google_books_cache(all_records, args.data / "google_books_cache.json")
    gr_covers, gr_descs = apply_goodreads_metadata(all_records, args.data / "goodreads_metadata.json")
    apply_manual_overrides(all_records, args.data / "manual_overrides.json")
    descs = sum(1 for r in all_records if r.get("description"))
    gend = apply_author_gender(all_records, args.data / "author_gender.json")
    gr_ids = apply_goodreads_ids(all_records, args.data / "goodreads_ids.json")
    genres = sum(1 for r in all_records if r.get("genres"))
    total_covers = sum(1 for r in all_records if r.get("cover_url"))
    print(f"  Applied {covers} OL covers + {google_covers} Google Books covers + {gr_covers} GR covers ({total_covers} total) + {descs} descs (incl. {gr_descs} from GR) + {genres} genre sets + {gend} genders + {gr_ids} Goodreads ids")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w") as f:
        json.dump({
            "books": all_records,
            "meta": {
                "total": len(all_records),
                "by_category": {c: sum(1 for r in all_records if r["category"] == c) for c in set(r["category"] for r in all_records)},
            },
        }, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {args.out} with {len(all_records)} books ({total_covers} with covers)")


if __name__ == "__main__":
    main()
