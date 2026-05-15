"""Infer author gender from their first name and cache it.

Uses the gender-guesser library when available (pure Python, name->m/f/etc).
Falls back to a small built-in table for the most common cases.

Outputs data/author_gender.json: { "Robert Jackson Bennett": "male", ... }
Manual overrides can be added to data/author_gender_overrides.json — those
take precedence and are merged into the output.

Usage:
    python scripts/enrich_author_gender.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

DATA_JSON = Path("site/data.json")
OUT_JSON = Path("data/author_gender.json")
OVERRIDES_JSON = Path("data/author_gender_overrides.json")

# Hand-curated fallback for common SFF authors (when the heuristic library is missing
# or returns 'unknown' / 'andy'). Used as the source of truth where present.
MANUAL = {
    "ursula k. le guin": "female",
    "ursula vernon": "female",
    "n. k. jemisin": "female",
    "octavia e. butler": "female",
    "octavia butler": "female",
    "connie willis": "female",
    "lois mcmaster bujold": "female",
    "c. j. cherryh": "female",
    "naomi novik": "female",
    "kelly link": "female",
    "tamsyn muir": "female",
    "becky chambers": "female",
    "ann leckie": "female",
    "arkady martine": "female",
    "mary robinette kowal": "female",
    "nnedi okorafor": "female",
    "emily tesh": "female",
    "r. f. kuang": "female",
    "fonda lee": "female",
    "alix e. harrow": "female",
    "rebecca roanhorse": "female",
    "elizabeth bear": "female",
    "premee mohamed": "female",
    "seanan mcguire": "female",
    "freya marske": "female",
    "olivia waite": "female",
    "amal el-mohtar": "female",
    "natalia theodoridou": "female",
    "kaliane bradley": "female",
    "antonia hodgson": "female",
    "kerstin hall": "female",
    "sarah pinsker": "female",
    "naomi kritzer": "female",
    "nghi vo": "female",
    "susanna clarke": "female",
    "j. k. rowling": "female",
    "madeline miller": "female",
    "vajra chandrasekera": "male",
    "sofia samatar": "female",
    "ursula vernon (as t. kingfisher)": "female",
    "t. kingfisher": "female",
    "annalee newitz": "female",
    "tasha suri": "female",
    "katherine addison": "female",
    "heather fawcett": "female",
    "andrea hairston": "female",
    "shannon chakraborty": "female",
    "s. a. chakraborty": "female",
    "s. l. huang": "female",
    "tochi onyebuchi": "male",
    "wole talabi": "male",
    "p. djèlí clark": "male",
    "stephen graham jones": "male",
    "daryl gregory": "male",
    "john wiswell": "male",
    "ray nayler": "male",
    "robert jackson bennett": "male",
    "scott lynch": "male",
    "martha wells": "female",
    "aliette de bodard": "female",
    "yaroslav barsukov": "male",
    "thomas ha": "male",
    "eugenia triantafyllou": "female",
    "h.h. pak": "unknown",
    "cameron reed": "unknown",
    "catherynne m. valente": "female",
}


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


def first_name(full: str) -> str:
    # Strip initials like "R." and parenthetical aliases like "(as T. Kingfisher)"
    cleaned = re.sub(r"\(.*?\)", "", full).strip()
    parts = [p.strip(".") for p in cleaned.split() if p.strip(".")]
    parts = [p for p in parts if len(p) > 1]  # drop single-letter initials
    return parts[0] if parts else ""


def main() -> None:
    with DATA_JSON.open() as f:
        data = json.load(f)

    authors = sorted({a for b in data["books"] for a in (b.get("authors") or [])})
    print(f"{len(authors)} unique authors")

    overrides: dict[str, str] = {}
    if OVERRIDES_JSON.exists():
        with OVERRIDES_JSON.open() as f:
            overrides = {k.lower(): v for k, v in json.load(f).items()}

    try:
        from gender_guesser.detector import Detector
        detector = Detector(case_sensitive=False)
    except Exception:
        detector = None

    result: dict[str, str] = {}
    for author in authors:
        norm = normalize_name(author)
        if norm in overrides:
            result[author] = overrides[norm]
            continue
        if norm in MANUAL:
            result[author] = MANUAL[norm]
            continue
        fn = first_name(author)
        if not fn or not detector:
            result[author] = "unknown"
            continue
        g = detector.get_gender(fn)
        # gender-guesser values: male, mostly_male, female, mostly_female, andy, unknown
        if g in ("male", "mostly_male"):
            result[author] = "male"
        elif g in ("female", "mostly_female"):
            result[author] = "female"
        else:
            result[author] = "unknown"

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    counts = {"male": 0, "female": 0, "unknown": 0}
    for v in result.values():
        counts[v] = counts.get(v, 0) + 1
    print(f"Distribution: {counts}")
    print(f"Wrote {OUT_JSON}")


if __name__ == "__main__":
    main()
