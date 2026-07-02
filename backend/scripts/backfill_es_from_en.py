#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Backfill the Spanish (es/) bestiary catalog from the English (en/) JSONs.

For every creature that exists under ``en/`` but has no ``es/`` counterpart
the script:

1. **Translates the four Tier-1 identity fields** — ``name``, ``size``,
   ``type``, ``alignment`` — using the lookup tables in
   ``scripts/es_i18n.py`` (overrides + pattern rules). When the lookup
   keeps the English name verbatim the file is stamped
   ``_i18n_pending: True`` so a future translator pass surfaces it.
2. **Preserves the English text** of every prose field (``traits[].text``,
   ``actions[].text``, ``legendaryActions[].text``, ``reactions[].text``,
   ``spellcasting``, ``senses``, ``languages``). Translating these
   convincingly is out of scope; the user gets Spanish UI labels with
   English body text until a human-curated translation exists.
3. **Stamps the file** with ``SRD 5.2 castellano (pendiente,
   autotraducido)`` so the user can distinguish auto-translated entries
   from manual PROVISIONAL work ``(pendiente)`` and from officially
   extracted entries ``(Wizards)``. A ``_i18n_meta`` block carries the
   source slug + backfill timestamp so re-running stays idempotent.

Re-runs are safe:
* Files already inside ``es/`` are **NOT** overwritten (the script exits
  with a skip-count summary unless ``--force`` is passed).
* Files already stamped with an ``autotraducido`` stamp ARE re-written,
  so updated translations land correctly.

Usage::

    python scripts/backfill_es_from_en.py             # default diff-only
    python scripts/backfill_es_from_en.py --dry-run   # print plan only
    python scripts/backfill_es_from_en.py --force     # overwrite existing
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import pathlib
import sys

# Make sibling scripts importable when invoked as
# ``python scripts/backfill_es_from_en.py``.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import es_i18n  # noqa: E402
from parse_es_srd import (  # noqa: E402
    ES_DIR,
    EN_DIR,
    OFFICIAL_STAMP,
    PROVISIONAL_STAMP,
)

AUTOTRANS_STAMP = "SRD 5.2 castellano (pendiente, autotraducido)"


def _translate_basics(en_data: dict, slug: str) -> dict:
    """Apply Tier-1 translation to identity fields, return ES basics dict.

    ``es_i18n.translate_basics`` returns a dict with the 4 translated
    fields plus an ``_i18n_pending`` bool. The caller drops the bool
    from the on-disk schema and stores it inside the ``_i18n_meta``
    block instead, so re-running ``parse_es_srd.py`` can detect the
    file as auto-translated even after its stamp becomes plain
    ``(pendiente)``.
    """
    es_basics = es_i18n.translate_basics(en_data)
    pending = es_basics.pop("_i18n_pending")
    return {"fields": es_basics, "_i18n_pending": pending}


def _build_i18n_meta(en_slug: str, pending: bool) -> dict:
    """Build the ``_i18n_meta`` block stamped into each backfilled JSON.

    The ``backfilled_at`` field uses ISO 8601 with timezone offset so
    a diff over time is informative even at second granularity — this
    helps when comparing two auto-translated versions of the same
    slug across repeated invocations.
    """
    return {
        "source_slug": en_slug,
        "source": "scripts/backfill_es_from_en.py",
        "version": 1,
        "backfilled_at": _dt.datetime.now(_dt.timezone.utc).isoformat(
            timespec="seconds"
        ),
        "translation_pending": pending,
    }


def _build_backfilled_es(en_data: dict, slug: str, log: list[str]) -> dict:
    """Construct the ES JSON for ``slug`` from ``en_data``.

    Algorithm:
    1. Translate Tier-1 fields and build ``_i18n_meta`` block.
    2. Deep-copy the full EN data structure (preserves all list-of-dict
       semantics for traits/actions/etc.) and overwrite the four
       identity fields in-place.
    3. Force the ``lang``, ``source``, ``slug``, and ``id`` fields so
       the schema invariants are honored regardless of upstream drift.
    """
    basics = _translate_basics(en_data, slug)
    out: dict = json.loads(json.dumps(en_data, ensure_ascii=False))

    out["id"] = slug
    out["slug"] = slug
    out["lang"] = "es"
    out["source"] = AUTOTRANS_STAMP

    out["name"] = basics["fields"]["name"]
    out["size"] = basics["fields"]["size"]
    out["type"] = basics["fields"]["type"]
    out["alignment"] = basics["fields"]["alignment"]

    out["_i18n_meta"] = _build_i18n_meta(en_slug=slug,
                                         pending=basics["_i18n_pending"])

    if basics["_i18n_pending"]:
        log.append(f"  PENDING [name-tier1 fallback] {slug}")
    else:
        log.append(f"  translated {slug}")

    return out


def _normalize_filename_for_match(stem: str) -> str:
    """Treat hyphens and underscores as equivalent for existence checks.

    Filesystem slugs allow hyphens (e.g. ``acolyte-captain.json``); the
    EN catalog may use either. When the backfill asks "does this ES
    file already exist?" we compare against both forms so neither form
    of the existing entry is mistaken for a fresh slot and accidentally
    overwritten by --force.
    """
    return stem.replace("-", "_")


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Backfill missing Spanish bestiary files from their "
            "English counterparts (Tier-1 field translation only)."
        ),
    )
    ap.add_argument(
        "--dry-run", action="store_true",
        help="Print the plan without writing any files.",
    )
    ap.add_argument(
        "--force", action="store_true",
        help="Overwrite existing ES files (the default is to skip them).",
    )
    ap.add_argument(
        "--report-path", default=None,
        help="Optional path to write a JSON coverage report.",
    )
    args = ap.parse_args()

    if not EN_DIR.exists():
        print(f"EN dir not found: {EN_DIR}", file=sys.stderr)
        return 2
    if not ES_DIR.exists():
        print(f"ES dir not found: {ES_DIR}", file=sys.stderr)
        return 2

    en_slugs = sorted(p.stem for p in EN_DIR.glob("*.json"))

    plan: dict[str, str] = {}        # slug -> action
    written: list[str] = []
    skipped: list[str] = []

    for stem in en_slugs:
        norm = _normalize_filename_for_match(stem)
        es_candidate = ES_DIR / f"{norm}.json"
        if not es_candidate.exists():
            # Some EN paths use hyphens, so also try the literal stem
            alt_candidate = ES_DIR / f"{stem}.json"
            if alt_candidate.exists():
                es_candidate = alt_candidate
            else:
                plan[stem] = "create"
                continue

        existing = json.loads(es_candidate.read_text(encoding="utf-8"))
        existing_source = existing.get("source", "")
        # Provenance-tightened auto-detection. We only treat a file as
        # ours if ``_i18n_meta.source`` matches the canonical script
        # identifier OR ``source`` still carries AUTOTRANS_STAMP. A loose
        # ``bool(_i18n_meta)`` would let any future tooling that
        # happens to stamp an ``_i18n_meta`` block cause us to overwrite
        # curated work.
        was_auto_translated = (
            existing.get("_i18n_meta", {}).get("source")
            == "scripts/backfill_es_from_en.py"
            or AUTOTRANS_STAMP in existing_source
        )

        # OFFICIAL files come from the SRD PDF parse — never overwrite.
        if OFFICIAL_STAMP in existing_source and not args.force:
            plan[stem] = "skip-official"
            skipped.append(stem)
            continue
        # Manually-authored PROVISIONAL files — must NOT contain an
        # ``_i18n_meta`` block (which is only stamped by this script).
        # Files that *do* contain ``_i18n_meta`` but lost their
        # ``AUTOTRANS_STAMP`` to a prior ``parse_es_srd.py`` Phase 2
        # relabel are still our files and must be re-stamped here so
        # the catalog highlights them as auto-translated placeholders.
        is_manual_provisional = (
            PROVISIONAL_STAMP in existing_source
            and not was_auto_translated
        )
        if is_manual_provisional and not args.force:
            plan[stem] = "skip-manual"
            skipped.append(stem)
            continue
        # Already auto-translated (either by source stamp or by
        # ``_i18n_meta`` provenance) — re-run to apply updated
        # translation dictionaries (e.g. the dragon-age fix).
        plan[stem] = "rewrite-autotrans"

    # Execute the plan ------------------------------------------------------

    if args.dry_run:
        print("=== DRY RUN (no files written) ===")
        will_create = sorted(s for s, a in plan.items() if a == "create")
        will_rewrite = sorted(s for s, a in plan.items() if a == "rewrite-autotrans")
        will_skip_off = sorted(s for s, a in plan.items() if a == "skip-official")
        will_skip_man = sorted(s for s, a in plan.items() if a == "skip-manual")
        print(f"Will CREATE   : {len(will_create)}")
        for s in will_create[:30]:
            print(f"  + {s}")
        if len(will_create) > 30:
            print(f"  ... +{len(will_create) - 30} more")
        print(f"Will REWRITE  : {len(will_rewrite)}")
        for s in will_rewrite[:30]:
            print(f"  ~ {s}")
        if len(will_rewrite) > 30:
            print(f"  ... +{len(will_rewrite) - 30} more")
        print(f"Will SKIP-OFF : {len(will_skip_off)}")
        print(f"Will SKIP-MAN : {len(will_skip_man)}")
        return 0

    log: list[str] = []
    for stem, action in plan.items():
        if action == "create" or action == "rewrite-autotrans":
            en_data = json.loads((EN_DIR / f"{stem}.json").read_text(encoding="utf-8"))
            out = _build_backfilled_es(en_data, stem, log)
            norm = _normalize_filename_for_match(stem)
            target = ES_DIR / f"{norm}.json"
            target.write_text(
                json.dumps(out, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            written.append(stem)

    print(f"Wrote {len(written)} new auto-translated ES files "
          f"(skipped {len(skipped)} curated/already-present).")
    if log:
        for line in log[:30]:
            print(line)
        if len(log) > 30:
            print(f"  ... +{len(log) - 30} more log entries")

    if args.report_path:
        pathlib.Path(args.report_path).write_text(
            json.dumps(
                {
                    "written": written,
                    "skipped": skipped,
                    "plan": plan,
                    "stamp": AUTOTRANS_STAMP,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
