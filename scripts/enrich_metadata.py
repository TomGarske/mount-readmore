"""Enrich the awards master CSV with cover, page count, and pub date from Open Library.

Usage:
    python scripts/enrich_metadata.py --master data/awards-master.csv --out data/awards-master.csv
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import httpx
import pandas as pd

OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json"


def lookup(client: httpx.Client, title: str, author: str) -> dict[str, str]:
    params = {"title": title, "author": author, "limit": 1}
    try:
        r = client.get(OPEN_LIBRARY_SEARCH, params=params, timeout=10.0)
        r.raise_for_status()
        docs = r.json().get("docs", [])
    except Exception:
        return {}
    if not docs:
        return {}
    d = docs[0]
    cover_id = d.get("cover_i")
    return {
        "ol_key": d.get("key", ""),
        "ol_isbn": (d.get("isbn") or [""])[0],
        "ol_pages": str(d.get("number_of_pages_median") or ""),
        "ol_first_pub": str(d.get("first_publish_year") or ""),
        "ol_cover": f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else "",
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--master", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--force", action="store_true", help="Re-fetch even if already enriched")
    args = p.parse_args()

    df = pd.read_csv(args.master)
    for col in ["ol_key", "ol_isbn", "ol_pages", "ol_first_pub", "ol_cover"]:
        if col not in df.columns:
            df[col] = ""

    with httpx.Client(headers={"User-Agent": "award-books-tracker/0.1"}) as client:
        for i, row in df.iterrows():
            if not args.force and row.get("ol_key"):
                continue
            meta = lookup(client, str(row["title"]), str(row["author"]))
            for k, v in meta.items():
                df.at[i, k] = v
            time.sleep(0.2)
            if i % 25 == 0:
                print(f"  {i}/{len(df)}")

    df.to_csv(args.out, index=False)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
