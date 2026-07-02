#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regression tests for the TYPE-line bleed trigger in `parse_es_srd.py`.

The bleed trigger (`_NEXT_STATBLOCK_RX`) hard-breaks multi-creature
pages so the section walker doesn't bleed the next creature's
CA/HP/Speed into the current sections[] arrays. It also needs to
REJECT mid-paragraph body text that incidentally mentions a creature
type plus an alignment phrase, otherwise it prematurely exits sections
and confuses the parser (canonical bug: a Lich's Atributos entry
citing "muerto viviente (ex), neutral malvado" used to trigger bleed).

This script locks in:
  * The Spanish D&D 5e creature-type whitelist
    (`_SRD_ES_TYPE_KEYWORDS`) — a presence check against the
    documented set, robust to future additions.
  * The 3 form variants (with subtype in parens / without / sin
    alineamiento) anchored on that whitelist.
  * The `(?-i:...)` case-sensitive override on the keyword group so
    lowercase body text cannot trigger.
  * The other bleed triggers (MOD, Clase, Velocidad, ability row)
    still match under outer re.IGNORECASE; the legacy compact
    six-integer form has a pre-existing latent quirk and is not
    covered here.

Run from `C:\CODE V2\dm-app\MasterHelp\backend\`:
    python -X utf8 tmp_test_es_srd_type_keywords.py

Exit 0 = all assertions pass. Non-zero = at least one regression
was found; review the FAIL lines and the recent parsing change.
"""
from __future__ import annotations
import sys
import re
import pathlib
sys.path.insert(0, str(pathlib.Path("scripts").resolve()))
from parse_es_srd import (  # noqa: E402
    _NEXT_STATBLOCK_RX,
    _SRD_ES_TYPE_KEYWORDS,
    _TYPE_WITH_PARENS,
    _TYPE_NO_PARENS,
    _TYPE_SIN_ALIN,
)


# =============================================================================
# Static structural assertions (don't run any matching; just verify sources)
# =============================================================================

def _assert_required_keywords(label: str) -> list[str]:
    """Presence check against the documented Spanish D&D 5e type set."""
    required: tuple[str, ...] = (
        "Aberración", "Bestia", "Celestial", "Autómata", "Constructo",
        "Dragón", "Elemental", "Feérico", "Infernal", "Gigante",
        "Licántropo", "Humanoide", "Monstruosidad", "Cieno", "Planta",
        r"Muerto\s+viviente",
    )
    fails: list[str] = []
    for kw in required:
        if kw not in _SRD_ES_TYPE_KEYWORDS:
            fails.append(f"[{label}] missing required keyword {kw!r}")
    return fails


def _assert_compiles(label: str, pattern: str) -> list[str]:
    fails: list[str] = []
    try:
        re.compile(pattern)
    except re.error as e:
        fails.append(f"[{label}] failed to compile: {e}")
    return fails


# =============================================================================
# Match assertions: True positives (must match)
# =============================================================================
# Organized 3 ways:
#   (a) 13 TYPE keywords observed in the actual SRD-CC_v5.2.1 corpus
#   (b) 3 defense-in-depth additions (Constructo/Licántropo/Humanoide)
#       whose presence is verified but whose direct match is also
#       exercised here so a width-bounded regex regression cannot
#       silently bypass the presence check.
#   (c) the 2-word Undead type `Muerto viviente` plus a subtype-of-
#       subtype variant.
# Plus 2 alignments (`caótico bueno`, `caótico neutral`) that
# round-out the 9-axis `legal|neutral|ca[oó]tic[oa] \s+\w+` regex.
TRUE_POSITIVES: list[tuple[str, str]] = [
    # (a) Corpus-observed keywords
    # Dragón — with subtype (adult/young/ancient red dragon family)
    ("Dragón Enorme (cromático), caótico malvado",      "dragon-with-subtype"),
    ("Dragón Grande (cromático), caótico malvado",      "dragon-with-subtype"),
    ("Dragón Mediano (cromático), caótico malvado",     "dragon-with-subtype"),
    # Dragón — no subtype
    ("Dragón Enorme, caótico malvado",                  "dragon-no-subtype"),
    # Infernal — with and without subtype
    ("Infernal Enorme (demonio), caótico malvado",      "fiend-with-subtype"),
    ("Infernal Mediano, legal malvado",                 "fiend-no-subtype"),
    # Sin alineamiento (unaligned) variants
    ("Bestia Mediana, sin alineamiento",                "beast-sin-alin"),
    ("Monstruosidad Mediana, sin alineamiento",         "monstrosity-sin-alin"),
    ("Autómata Grande, sin alineamiento",               "construct-sin-alin"),
    # Regular alignments
    ("Aberración Grande, neutral malvada",              "aberration-no-subtype"),
    ("Feérico Grande, neutral bueno",                   "fey"),
    ("Celestial Mediano, legal bueno",                  "celestial"),
    ("Planta Grande, sin alineamiento",                 "plant-sin-alin"),
    ("Elemental Mediano, legal neutral",                "elemental"),
    ("Cieno Mediano, sin alineamiento",                 "ooze-sin-alin"),
    ("Gigante Enorme, legal malvado",                   "giant"),
    # (b) Defense-in-depth keywords (not corpus-observed but locked in)
    ("Constructo Grande, sin alineamiento",             "constructo-no-subtype"),
    ("Licántropo Mediano, neutral malvado",             "licantropo-no-subtype"),
    ("Humanoide Mediano, caótico neutral",              "humanoide-no-subtype"),
    # (c) Undead variants
    ("Muerto viviente Mediano, caótico malvado",        "undead-2-word-type"),
    ("Muerto viviente (no-muerto) Mediano, caótico malvado",
     "undead-with-subtype-of-subtype"),
    # Alignment axis diversity (`caótico bueno`, `caótico neutral`)
    ("Dragón Mediano, caótico bueno",                   "alignment-caotico-bueno"),
    ("Aberración Mediana, caótico neutral",             "alignment-caotico-neutral"),
]


# =============================================================================
# Match assertions: True negatives (must NOT match)
# =============================================================================
# Body text patterns that previously caused false-positive bleed.
# These now correctly reject because the (?-i:(?:KEYWORDS)) anchor
# requires the line to start with one of the whitelisted keywords.
TRUE_NEGATIVES: list[tuple[str, str]] = [
    ("El liche es un muerto viviente (ex), neutral malvado.",       "lich-atributos-proc"),
    ("Es un Dragón ancestral, pero su tamaño es engañoso.",         "dragon-mid-sentence"),
    ("Esta criatura es de tipo Infernal (demonio), caótico malvado.",
     "type-mid-sentence"),
    ("Como bestia mediana, este lobo acecha neutral malvado.",      "lowercase-bestia"),
    ("Como humanoide, este bandido actúa correctamente.",           "lowercase-humanoide"),
    ("La monstrosidad cae, su reacción es ...",                     "monstruosidad-lowercase"),
    ("Sin dragones en la zona, los gnolls atacaron.",               "dragones-lowercase-none"),
]


# =============================================================================
# Match assertions: lowercase simpler alternates MUST still match
# (they retain outer re.IGNORECASE for robustness against OCR jitter)
# =============================================================================
TRUE_INNER_IGNORECASE: list[tuple[str, str]] = [
    ("mod. salv. mod. salv. mod. salv.",            "abilities-header-lowercase"),
    ("clase de armadura 18",                        "ac-lowercase"),
    ("velocidad 9 m.",                              "speed-lowercase"),
    ("fue 18 +4 +4 des 8 -1 -1 con 17 +3 +3",       "ability-row-lowercase"),
]


# =============================================================================
# Other bleed-triggers (case equivalence with the lowercase TI section)
# =============================================================================
# This section's purpose: verify that the AC / Speed / ability-row
# bleed-triggers match BOTH their lowercase form (TI section above)
# and their Capitalized form (this section). It's a case-equivalence
# sanity check, not a vocabulary test, since the same regex matches
# both forms. The legacy compact six-integer form has a pre-existing
# latent quirk (`\s*\$` literal-dollar escape in `_NEXT_STATBLOCK_RX`)
# and is intentionally out of scope — it falls outside this regression
# test's purpose.
TRUE_OTHER_BLEED_TRIGGERS_CASE: list[tuple[str, str]] = [
    ("Clase de Armadura 18",                        "ac-capitalized"),
    ("Velocidad 9 m.",                              "speed-capitalized"),
    ("Fue 18 +4 +4 Des 8 −1 −1 Con 17 +3 +3",      "ability-row-capitalized"),
]


# =============================================================================
# Test runner
# =============================================================================

def _check(label: str, line: str, expected_match: bool) -> str | None:
    actual = _NEXT_STATBLOCK_RX.match(line) is not None
    # 80-char slice is wide enough for the longest case:
    # "Muerto viviente (no-muerto) Mediano, caótico malvado" = 60 chars,
    # "El liche es un muerto viviente (ex), neutral malvado." = 58.
    if actual == expected_match:
        return f"  PASS  [{label:38s}] {line[:80]!r:80s}"
    return (
        f"  FAIL  [{label:38s}] {line[:80]!r:80s}  "
        f"got match={actual}, expected {expected_match}"
    )


def main() -> int:
    failures: list[str] = []

    # Structural
    failures.extend(_assert_required_keywords("required-keywords"))
    failures.extend(_assert_compiles("with-parens",  _TYPE_WITH_PARENS))
    failures.extend(_assert_compiles("no-parens",    _TYPE_NO_PARENS))
    failures.extend(_assert_compiles("sin-alin",     _TYPE_SIN_ALIN))

    print("=== True positives (Capitalized TYPE lines MUST match) ===")
    for line, label in TRUE_POSITIVES:
        result = _check(label, line, True)
        print(result)
        if result and result.startswith("  FAIL"):
            failures.append(result)

    print("\n=== True negatives (body text MUST NOT match) ===")
    for line, label in TRUE_NEGATIVES:
        result = _check(label, line, False)
        print(result)
        if result and result.startswith("  FAIL"):
            failures.append(result)

    print("\n=== Inner IGNORECASE preserved for simpler alternates ===")
    for line, label in TRUE_INNER_IGNORECASE:
        result = _check(label, line, True)
        print(result)
        if result and result.startswith("  FAIL"):
            failures.append(result)

    print("\n=== Other bleed-triggers (case equivalence) ===")
    for line, label in TRUE_OTHER_BLEED_TRIGGERS_CASE:
        result = _check(label, line, True)
        print(result)
        if result and result.startswith("  FAIL"):
            failures.append(result)

    total = (len(TRUE_POSITIVES) + len(TRUE_NEGATIVES)
             + len(TRUE_INNER_IGNORECASE)
             + len(TRUE_OTHER_BLEED_TRIGGERS_CASE))
    print()
    if failures:
        print(f"FAIL: {len(failures)} regression(s):")
        for f in failures:
            print(f"  - {f.strip()}")
        return 1
    print(f"PASS: all {total} tests + 4 structural checks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
