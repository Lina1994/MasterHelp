#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v8 loader (EN-only): additive merge of ~30 NEW SRD 5.2 (2024) EN creatures
covering v6 themes (Undead + Monstrosity + Fiend + Dragon).

Source: `data/manuals/dnd5e-2024/scripts/.v8_monsters_data.json`.

**IMPORTANT**: This script is now EN-only. The Spanish content for these
creatures is owned exclusively by `scripts/parse_es_srd.py`, which ingests
the official `SRD_CC_v5.2.1 CASTELLANO` PDF published by Wizards of the
Coast (CC BY 4.0) and stamps the resulting files with
`"source": "SRD 5.2 castellano (Wizards)"`. Running this script will NOT
write anything to `monsters/es/`.

Coverage (v6 themes):
  - UNDEAD (8): will_o_wisp, mummy, mummy_lord, revenant, vampire_spawn,
    vampire, lich, death_knight.
  - MONSTROSITY (7): basilisk, hippogriff, hydra, purple_worm, remorhaz,
    sphinx, tarrasque.
  - FIEND (8): quasit, dretch, barbed_devil, hezrou, glabrezu, erinyes,
    balor, pit_fiend.
  - DRAGON (7): adult_black_dragon, adult_blue_dragon, adult_green_dragon,
    adult_red_dragon, adult_white_dragon, ancient_red_dragon.

Schema = flat strings per language file (matching goblin.json: id, slug,
lang, source, name, size, type, alignment, armorClass, hitPoints:{avg,roll},
speed:{walk,fly,swim,climb,burrow,snow}, abilities:{str,...,cha},
saves[], skills[], damage{V,I,R}, conditionImmunities[], senses,
languages, challengeRating, experiencePoints, proficiencyBonus,
traits:[{name,text}], actions:[{name,text}], legendaryActions?:...).
"""
from __future__ import annotations
import argparse
import json
import pathlib
from typing import Any

MONSTERS_ROOT = pathlib.Path("data/manuals/dnd5e-2024/monsters")
EN_DIR = MONSTERS_ROOT / "en"
DATA_PATH = pathlib.Path(
    "data/manuals/dnd5e-2024/scripts/.v8_monsters_data.json"
)

EN_SOURCE_STAMP = "SRD 5.2 (2024)"


def pb(cr) -> int:
    try:
        crn = float(cr)
    except (TypeError, ValueError):
        return 2
    if crn < 5:    return 2
    if crn < 9:    return 3
    if crn < 13:   return 4
    if crn < 17:   return 5
    if crn < 21:   return 6
    if crn < 25:   return 7
    return 8


def exp_for(cr) -> int:
    table = {
        0: 10, "1/8": 25, "1/4": 50, "1/2": 100, 1: 200, 2: 450, 3: 700,
        4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
        11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000,
        17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
        23: 50000, 24: 62000,
    }
    if cr in table:
        return table[cr]
    try:
        crn = float(cr)
    except (TypeError, ValueError):
        return 10
    return max((v for k, v in table.items() if isinstance(k, (int, float))
                and k <= crn), default=10)


def main() -> int:
    parser = argparse.ArgumentParser(description="v8 EN-only ingest.")
    parser.add_argument("--force", action="store_true",
                        help="Re-write EN files even if they already exist.")
    args = parser.parse_args()

    if not DATA_PATH.exists():
        print(f"data file not found: {DATA_PATH}", file=__import__("sys").stderr)
        return 2

    monsters = json.loads(DATA_PATH.read_text(encoding="utf-8"))["monsters"]
    print(f"Loaded {len(monsters)} EN entries from {DATA_PATH}")

    added = 0
    skipped = 0
    for m in monsters:
        mid = m["id"]
        out_path = EN_DIR / f"{mid}.json"
        if out_path.exists() and not args.force:
            skipped += 1
            continue
        localized: dict[str, Any] = {
            "id": mid,
            "slug": mid,
            "lang": "en",
            "source": EN_SOURCE_STAMP,
            "name": m["name"]["en"],
            "size": m["size"],
            "type": m["type"]["en"],
            "alignment": m["alignment"]["en"],
            "armorClass": m["armorClass"],
            "hitPoints": {
                "average": m["hitPoints"]["average"],
                "roll": m["hitPoints"]["roll"],
            },
            "maxHitPoints": m["hitPoints"]["average"],
            "hitDice": m["hitPoints"]["roll"],
            "speed": m["speed"]["en"] if isinstance(m.get("speed"), dict)
                     and "en" in m["speed"] else m["speed"],
            "abilities": m["abilities"],
            "senses": m["senses"]["en"],
            "languages": m["languages"]["en"],
            "challengeRating": m["challengeRating"],
            "experiencePoints": exp_for(m["challengeRating"]),
            "proficiencyBonus": pb(m["challengeRating"]),
        }
        # Optional bilingual-optional fields -> collapse to EN string.
        for opt in ("damageVulnerabilities", "damageResistances",
                    "damageImmunities", "conditionImmunities"):
            v = m.get(opt)
            if v is None:
                continue
            localized[opt] = v["en"] if isinstance(v, dict) and "en" in v else v

        # skills/saves are sometimes bilingual arrays (en/es strings per language).
        # We extract the EN sub-array if present.
        for opt in ("saves", "skills"):
            v = m.get(opt)
            if v is None:
                continue
            localized[opt] = v["en"] if isinstance(v, dict) and "en" in v else v

        # Traits and actions keep EN name+text.
        for opt in ("traits", "actions", "legendaryActions"):
            v = m.get(opt)
            if v is None:
                continue
            localized[opt] = [
                {"name": x["name"]["en"], "text": x["text"]["en"]}
                if isinstance(x, dict) and "en" in x.get("name", {})
                else x for x in v
            ]

        out_path.write_text(
            json.dumps(localized, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        added += 1

    print(f"EN: added {added} / skipped {skipped}")
    print("ES: not touched (run scripts/parse_es_srd.py to ingest the official Spanish SRD)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
