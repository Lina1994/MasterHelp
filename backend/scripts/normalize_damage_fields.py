#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
normalize_damage_fields.py - Migrate string-typed
`damageVulnerabilities` / `damageResistances` / `damageImmunities` /
`conditionImmunities` fields into clean JSON arrays of trimmed strings.

Background
----------
An audit of the `data/manuals/dnd5e-2024/monsters/{en,es}/**`
corpus (314 files) found 184 instances where these fields were
stored as raw strings (e.g. `"cold, lightning; bludgeoning,
piercing, slashing from nonmagical attacks"`) instead of arrays.
The `MonsterStatBlock.tsx:joinList` helper used to crash with
`arr.join is not a function` because `string#join` is undefined.

This script is an idempotent data-layer fix. After running it, the
fields are always arrays, so consumers can rely on `Array.isArray`.

Splitter rules
--------------
- Split on `,` and `;` (both appear in SRD prose).
- Strip whitespace; drop empty segments.
- If the value is already a list → leave unchanged.
- If the value is an empty/whitespace string → leave unchanged.
- If the value is a JSON-encoded list/object string (defensive
  case where some intermediate producer serialized the array),
  parse then normalize. Falls back to the simple splitter on
  parse error.
- Unknown shapes (e.g. numbers, dicts) are returned unchanged so
  this script never corrupts structures it doesn't understand.

Run from `C:\CODE V2\dm-app\MasterHelp\backend\`:

    # Mutate in place (idempotent — re-running is a no-op):
    python -X utf8 scripts/normalize_damage_fields.py

    # Dry-run / audit-only:
    python -X utf8 scripts/normalize_damage_fields.py --check

Exit codes:
  0  always (the script reports counts via stdout).
"""
from __future__ import annotations
import argparse
import json
import pathlib
import re
import sys
from typing import Iterable

FIELDS: tuple[str, ...] = (
    "damageVulnerabilities",
    "damageResistances",
    "damageImmunities",
    "conditionImmunities",
)
SEPARATOR_RX = re.compile(r"[,;]")


def _clean_str_list(items: Iterable[object]) -> list[str]:
    """Convert an iterable into a clean list of non-empty trimmed strings.

    Each element is coerced via `str()` and trimmed. Non-string items
    (numbers, dicts, None) become their string representation; empty
    and whitespace-only entries are dropped.
    """
    return [str(x).strip() for x in items if str(x).strip()]


def normalize_field(v):
    """Return a clean normalized representation, or the input unchanged.

    Behavior matrix:
      list             → identity (already correct schema).
      None             → unchanged.
      str (empty)      → unchanged (nothing to split).
      str (non-empty)  → list of trimmed segments from split on `,;`.
      str (JSON-like)  → parse first if it's a valid list/object; else
                         fall back to the simple splitter.
      other            → unchanged (defensive; never corrupts foreign shapes).
    """
    if isinstance(v, list):
        return v
    if v is None:
        return v
    if not isinstance(v, str):
        return v

    stripped = v.strip()
    if not stripped:
        return v

    # Defensive JSON-stringified array detection. Some intermediate
    # producers (DTO mappers, double-encoded DB columns) may have
    # rendered the list as a string. Parse and re-emit.
    if stripped[0] in ("[", "{"):
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                return _clean_str_list(parsed)
            if isinstance(parsed, dict):
                # Foreign shape — keep as-is so we don't corrupt.
                return v
        except (json.JSONDecodeError, ValueError):
            pass  # fall through to flat-string splitter

    return _clean_str_list(SEPARATOR_RX.split(stripped))


def process(root: pathlib.Path, write: bool) -> tuple[int, int, int, int]:
    changed_files = 0
    skipped_files = 0
    parsed_errors = 0
    changed_fields = 0

    for p in sorted(root.glob("**/*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"  PARSE-ERROR  {p}: {exc}", file=sys.stderr)
            parsed_errors += 1
            continue

        dirty = False
        for field in FIELDS:
            if field not in data:
                continue
            new_v = normalize_field(data[field])
            # Every no-op branch in `normalize_field` returns the
            # exact same object instance, so `is` is sufficient.
            # The "fresh list" producer invariant is enforced inside
            # `normalize_field` itself, not duplicated here.
            if new_v is data[field]:
                continue
            data[field] = new_v
            dirty = True
            changed_fields += 1

        if not dirty:
            skipped_files += 1
            continue

        changed_files += 1
        if write:
            # Preserve original key order + 2-space indent + trailing \n
            # so re-running on already-normalized files is byte-stable
            # (modulo re-flow of originally-string values to arrays).
            p.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    mode = "MUTATED" if write else "WOULD-CHANGE"
    print(
        f"{mode}: {changed_files} files; "
        f"FIELDS-CHANGED: {changed_fields}; "
        f"SKIPPED (already normalized): {skipped_files}; "
        f"PARSE-ERRORS: {parsed_errors}"
    )
    return changed_files, changed_fields, skipped_files, parsed_errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "root",
        nargs="?",
        default="data/manuals/dnd5e-2024/monsters",
        help="Path to the monsters/ root directory (default: %(default)s).",
    )
    ap.add_argument(
        "--check",
        "--dry-run",
        action="store_true",
        help="Report what would change; do not write files.",
    )
    args = ap.parse_args()

    root = pathlib.Path(args.root)
    if not root.exists():
        print(f"ERROR: root not found: {root}", file=sys.stderr)
        return 2
    process(root, write=not args.check)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
