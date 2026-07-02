"""Merge additional SRD 5.2 spells into the dnd5e-2024 spells lists (EN+ES).

The script reads an existing pair of spells files plus a bilingual data file,
merges the new entries in, sorts the resulting list by `(level, id)`, and
writes the output back to disk.

The bilingual input file uses JSON entries with `_en` / `_es` suffixed keys:

    {
      "id":          "fire_bolt",
      "level":       0,
      "school_en":   "Evocation",
      "school_es":   "Evocación",
      "name_en":     "Fire Bolt",
      "name_es":     "Descarga de fuego",
      "casting_en":  "Action",
      "casting_es":  "Acción",
      "range_en":    "120 feet",
      "range_es":    "36 m (120 pies)",
      "duration_en": "Instantaneous",
      "duration_es": "Instantáneo",
      "components":  "V, S",
      "classes_en":  ["Sorcerer", "Wizard"],
      "classes_es":  ["Hechicero", "Mago"],
      "desc_en":     "You hurl a mote of fire...",
      "desc_es":     "Lanzas una mota de fuego...",
      "saving_en":   null,
      "saving_es":   null,
      "area_en":     null,
      "area_es":     null
    }

`saving_*` and `area_*` are optional and may be `null`.

Usage (from `MasterHelp/backend/`):

    python scripts/merge_dnd5e_2024_spells.py [path/to/new_spells.json]

Default path is `tmp/new_spells_data.json` if no arg is given.
"""

import json
import pathlib
import sys


BASE = pathlib.Path("data/manuals/dnd5e-2024/spells")
DEFAULT_DATA = pathlib.Path("tmp/new_spells_data.json")


def to_one_lang(spells, lang_idx):
    """For each bilingual row, build the {lang}-indexed dict the backend expects.

    Defensive: every bilingual field uses `.get(f"...{suffix}", "")` so a
    missing or typo'd `desc_es` (e.g. accidentally spelled `desc_en` twice)
    cannot raise KeyError. Empty fallback strings keep the entry in the
    catalogue but let consumers render an obvious empty cell.
    """
    out = []
    for s in spells:
        suffix = "_en" if lang_idx == 0 else "_es"
        item = {
            "id": s.get("id", ""),
            "name": s.get(f"name{suffix}", ""),
            "level": s.get("level", 0),
            "school": s.get(f"school{suffix}", ""),
            "castingTime": s.get(f"casting{suffix}", ""),
            "range": s.get(f"range{suffix}", ""),
            "duration": s.get(f"duration{suffix}", ""),
            "components": s.get("components", ""),
            "classes": s.get(f"classes{suffix}", []),
            "description": s.get(f"desc{suffix}", ""),
        }
        # Optional fields: only add when present and non-empty (defensive .get)
        saving = s.get(f"saving{suffix}") or s.get("saving")
        if saving:
            item["savingThrow"] = saving
        area = s.get(f"area{suffix}") or s.get("area")
        if area:
            item["areaOfEffect"] = area
        out.append(item)
    return out


def merge():
    data_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATA
    if not data_path.exists():
        print(f"ERROR: bilingual data file not found at {data_path}")
        sys.exit(1)

    new_spells = json.load(open(data_path, encoding="utf-8"))

    en_path = BASE / "spells.en.json"
    es_path = BASE / "spells.es.json"
    en_existing = json.load(open(en_path, encoding="utf-8"))
    es_existing = json.load(open(es_path, encoding="utf-8"))

    # Drop any existing entries that share an id with the new ones (idempotent merge)
    new_ids = {s["id"] for s in new_spells}
    en_existing = [s for s in en_existing if s.get("id") not in new_ids]
    es_existing = [s for s in es_existing if s.get("id") not in new_ids]

    en_existing.extend(to_one_lang(new_spells, 0))
    es_existing.extend(to_one_lang(new_spells, 1))

    en_existing.sort(key=lambda s: (s.get("level", 99), s.get("id", "")))
    es_existing.sort(key=lambda s: (s.get("level", 99), s.get("id", "")))

    en_path.write_text(
        json.dumps(en_existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    es_path.write_text(
        json.dumps(es_existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"OK: EN={len(en_existing)} spells, ES={len(es_existing)} spells, "
        f"added {len(new_spells)} new."
    )


if __name__ == "__main__":
    merge()
