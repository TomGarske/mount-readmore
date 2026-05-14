"""Assemble the final xlsx from the _updated.csv files.

Output: data/Hugo-Nebula-WFA-winners_updated.xlsx with original sheet names.

Usage:
    python scripts/build_xlsx.py --data data --out data/Hugo-Nebula-WFA-winners_updated.xlsx
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

# Map sheet CSV stem -> display sheet name in the original xlsx
SHEETS = {
    "favorites": "Favorites",
    "best_novel": "Best Novel",
    "best_novella_hugo": "Best Novella (Hugo)",
    "best_novelette_hugo": "Best Novelette (Hugo)",
    "best_series_hugo": "Best Series (Hugo)",
    "sandbox": "Sandbox",
}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=Path("data"))
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()

    with pd.ExcelWriter(args.out, engine="openpyxl") as writer:
        for stem, sheet_name in SHEETS.items():
            updated = args.data / f"{stem}_updated.csv"
            src = updated if updated.exists() else args.data / f"{stem}.csv"
            if not src.exists():
                continue
            df = pd.read_csv(src, dtype=str, keep_default_na=False)
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            print(f"  {sheet_name:30s} {len(df):4d} rows from {src.name}")

    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
