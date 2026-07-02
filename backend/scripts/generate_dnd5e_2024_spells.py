"""Expand the SRD 5.2 (2024) spells lists (EN+ES), riding alongside the explicit
monolithic `spells.en.json` and `spells.es.json` files at
`data/manuals/dnd5e-2024/spells/`.

Spells source their bilingual data from a list `DATA` defined below — populated
in chunks via heredoc (`>>`) appenders. Each entry is a tuple with positional,
EN/ES field pairs.

Run from `MasterHelp/backend`.
"""

import json
import pathlib

OUT = pathlib.Path("data/manuals/dnd5e-2024/spells")
OUT.mkdir(parents=True, exist_ok=True)


# Schema reference (from frontend/src/types/index.ts):
#   id (string), name, level (int), school, castingTime, range,
#   duration, components (string), classes (string[]), description,
#   savingThrow (optional), areaOfEffect (optional)

DATA: list = []


def emit(lang: str) -> list:
    """Build {lang}-indexed list of spell dicts from DATA tuples."""
    idx = 0 if lang == "en" else 1
    out = []
    for row in DATA:
        (spell_id, level,
         school, name,
         casting_time, range_,
         duration_, components,
         classes, description,
         saving_throw, area_of_effect) = row[name_idx := None]
        out.append({
            "id": spell_id,
            "name": name[idx],
            "level": level,
            "school": school[idx],  # type: ignore[index]
            "castingTime": casting_time[idx],
            "range": range_[idx],
            "duration": duration_[idx],
            "components": components,
            "classes": classes[idx],
            "description": description[idx],
            **({"savingThrow": saving_throw[idx]} if saving_throw else {}),
            **({"areaOfEffect": area_of_effect[idx]} if area_of_effect else {}),
        })
    return out


def main():
    en = emit("en")
    es = emit("es")
    (OUT / "spells.en.json").write_text(
        json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "spells.es.json").write_text(
        json.dumps(es, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(en)} spells EN, {len(es)} spells ES (DATA size: {len(DATA)})")


if __name__ == "__main__":
    main()
