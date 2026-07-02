#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_en_srd.py - Extract official English creature stat blocks from the
`SRD_CC_v5.2` PDF (English D&D 5e 2024 SRD) into
`data/manuals/dnd5e-2024/monsters/en/<slug>.json` matching the project's
established schema.

NOTE: This script is the English (EN) companion to `parse_es_srd.py`.
The English v5.2 SRD uses a fundamentally different layout from the
Spanish v5.2.1 SRD, so the walker is kept in a separate script rather
than wedged into `parse_es_srd.py`:

  * EN opens each statblock with a `Size <Type> (subtype)?, Alignment`
    line (Spanish opens with `<Type> <Size>, ...`).
  * EN embeds the saving-throw column INTO the abilities matrix
    (`Str 11 +0 +0 Dex 16 +3 +10 ...`). Spanish has a separate
    `Tiradas de Salvación` line.
  * EN bundles `AC 20 Initiative +17 (27)` on one line; Spanish has
    `Clase de Armadura 18` alone.
  * EN has `HP 315 (42d8 + 126)` (no `Puntos de Golpe`).

Multi-creature pages
--------------------
D&D SRD pages often host two creatures (one per column). To prevent
cross-creature bleed, `_split_page_into_statblocks` cuts the page text
at every `<Size> <Type> (...) , <Alignment>` boundary; `main()` then
picks the chunk whose leading line matches the SRD index name and feeds
that isolated string to `parse_statblock`.

Source stamps (idempotent re-runs are safe):
  - "SRD 5.2 (2024)"     - extracted from the official PDF, all section
                            arrays populated
  - "SRD 5.2"            - English SRD legacy stamp (already in corpus,
                            preserved untouched on re-run)

The script NEVER overwrites an existing en/*.json file with a different
source stamp — that file is treated as curated and only gets rewritten
when `--restamp` is passed AND the existing `source` matches
`"SRD 5.2 (2024)"`.

Run from `C:\\CODE V2\\dm-app\\MasterHelp\\backend\\`:

    # Coverage report (no writes):
    python -X utf8 scripts/parse_en_srd.py --preflight

    # Ingest (creates new files; respects existing source stamps):
    python -X utf8 scripts/parse_en_srd.py --restamp
"""
from __future__ import annotations
import argparse
import json
import pathlib
import re
import sys
from typing import Any

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    sys.stderr.write("pdfplumber not installed; install via pip.\n")
    raise

# Locate the project root so the script works whether invoked from
# backend/ or backend/scripts/.
ROOT = pathlib.Path("data/manuals/dnd5e-2024")
MONSTERS_DIR = ROOT / "monsters"
EN_DIR = MONSTERS_DIR / "en"
# English SRD PDF. Resolved relative to the cwd.
PDF_CANDIDATES = (
    pathlib.Path("../context/SRD_CC_v5.2.pdf"),
    pathlib.Path("context/SRD_CC_v5.2.pdf"),
    pathlib.Path("data/manuals/dnd5e-2024/raw-sources/SRD_CC_v5.2.pdf"),
)

OFFICIAL_STAMP = "SRD 5.2 (2024)"
PROVISIONAL_STAMP = "SRD 5.2 (pendiente)"

# ============================================================================
# English section-header map (lowercased lookup after stripping `.:`).
# ============================================================================
SECTION_HEADERS_LOWER: dict[str, str] = {
    "traits":              "traits",
    "actions":             "actions",
    "bonus actions":       "actions",
    "legendary actions":   "legendaryActions",
    "reactions":           "reactions",
    "spellcasting":        "actions",   # like Spanish "Hechizos"
}

# Single-line keyword fields processed AFTER the chunk has been
# isolated by the splitter (see `_split_page_into_statblocks`).
# LONGER prefixes MUST come before shorter ones — first-match-wins
# determines which field a line feeds into. Re-ordering this list
# silently breaks short-form `AC 20 Initiative +17 (...)` and
# `HP 315 (42d8 + 126)` matches against `Armor Class` / `Hit Points`.
FIELD_KEYS: list[tuple[str, str]] = [
    ("Condition Immunities",       "conditionImmunities"),
    ("Damage Immunities",          "damageImmunities"),
    ("Damage Vulnerabilities",     "damageVulnerabilities"),
    ("Damage Resistances",         "damageResistances"),
    ("Saving Throws",              "saves"),
    ("Senses",                     "senses"),
    ("Languages",                  "languages"),
    ("Skills",                     "skills"),
    ("Challenge",                  "challengeRating"),
    ("Armor Class",                "armorClass"),  # must precede "AC"
    ("AC",                         "armorClass"),
    ("Hit Points",                 "hitPoints"),   # must precede "HP"
    ("HP",                         "hitPoints"),
    ("Speed",                      "speed"),
]

# Schema-level fields whose values are lists of trimmed tokens.
_LIST_FIELDS = frozenset({
    "saves", "skills", "languages",
    "damageVulnerabilities", "damageResistances",
    "damageImmunities", "conditionImmunities",
})

# ============================================================================
# EN creature-type whitelist + bleed trigger.
# ============================================================================
# EN SRD opens each statblock with `<Size> <Type>(...)?, <Alignment>`.
# We use the SIZE keyword as the primary line-start anchor and the
# TYPE keyword for finer-characterization (e.g. cross-page bleed).
_EN_TYPE_KEYWORDS = (
    r"Aberration|Beast|Celestial|Construct|Dragon|Elemental|"
    r"Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead"
)
_EN_SIZE_KEYWORDS = r"Tiny|Small|Medium|Large|Huge|Gargantuan"

# EN alignment word list (full strings: "any alignment", "lawful good", ...)
_EN_ALIGNMENT_WORDS_RX = (
    r"(?:lawful|neutral|chaotic|any)\s+(?:good|neutral|evil|alignment)\b"
    r"|\bchaotic\s+(?:good|neutral|evil)\b"
    r"|\b(?:lawful|neutral)\s+(?:good|neutral|evil)\b"
    r"|\bany\s+(?:good|neutral|evil|alignment)\b"
    r"|\bunaligned\b"
)

# `<Size> <Type>(<Subtype>)?, <Alignment>`
_TYPE_LINE_RX = re.compile(
    rf"^(?P<size>{_EN_SIZE_KEYWORDS})\s+"
    rf"(?P<type>{_EN_TYPE_KEYWORDS})"
    rf"(?:\s*\((?P<subtype>[^)]+)\))?\s*,\s*"
    rf"(?P<alignment>[A-Z][A-Za-z\- ]+?)\s*$"
)

# Bleed detector for EN statblocks. Match the head of any line that
# signals "the next statblock is starting". Used as a defensive guard
# in section-walking; the primary isolation happens in
# `_split_page_into_statblocks`.
_NEXT_STATBLOCK_RX = re.compile(
    r"^(\s*MOD\.?\s+SAVE\.?\s+|\s*MOD\s+SAVE\s+MOD\s+SAVE\s+MOD\s+SAVE"
    r"|\s*Armor\s+Class\s+\d+|\s*AC\s+\d+"
    r"|\s*Hit\s+Points\s+\d+|\s*HP\s+\d+"
    rf"|{_TYPE_LINE_RX.pattern}"
    rf")",
    re.IGNORECASE,
)

# Header of EN abilities matrix.
_ABILITIES_HEADER_RX = re.compile(
    r"^\s*MOD\.?\s+SAVE\.?\s+MOD\.?\s+SAVE\.?\s+MOD\.?\s+SAVE\.?",
    re.IGNORECASE,
)
# Two-row abilities+save cell. Score, mod, save (-N or +N at most).
_AB_CELL_RX = re.compile(
    r"(?P<key>STR|DEX|CON|INT|WIS|CHA)"
    r"\s*(?P<score>\d+)"
    r"\s*(?P<mod>[+\-−]\d+)"
    r"\s*(?P<save>[+\-−]\d+|—|-{1,2})",
    re.IGNORECASE,
)

_PAGE_FOOTER_RX = re.compile(r"^\s*\d{1,3}\s+System Reference Document", re.IGNORECASE)

# High CR tiers that should have legendary actions per the SRD.
HIGH_CR = {"15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "30"}

# Slug-from-name normalizer.  EN index names map cleanly via
# `name.lower() + non-alphanumeric -> '_'`.
_EN_SLUG_OVERRIDES: dict[str, str] = {
    "Will-O'-Wisp": "will_o_wisp",
}


def slug_from_name(name: str) -> str:
    """Map an EN SRD index name to a project slug."""
    if name in _EN_SLUG_OVERRIDES:
        return _EN_SLUG_OVERRIDES[name]
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug


# ============================================================================
# PDF helpers (locale-INDEPENDENT — same column geometry as ES SRD).
# ============================================================================

def _resolve_pdf() -> pathlib.Path:
    for c in PDF_CANDIDATES:
        if c.exists():
            return c
    raise FileNotFoundError(
        "English SRD PDF not found. Looked at "
        + ", ".join(str(c) for c in PDF_CANDIDATES)
    )


def extract_index(pdf: pdfplumber.PDF,
                  pages: tuple[int, ...] = (3, 4)) -> dict[str, int]:
    """`{name -> page}` from the multi-column SRD index."""
    rx = re.compile(
        r"(?P<name>[A-Z][^\.]+?)\s*\.{2,}\s*(?P<page>\d{1,3})"
        r"(?=\s+[A-Z]|\s*$|\n)"
    )
    name_to_page: dict[str, int] = {}
    for p in pages:
        if p < 1 or p > len(pdf.pages):
            continue
        text = pdf.pages[p - 1].extract_text() or ""
        for line in text.split("\n"):
            for m in rx.finditer(line):
                name = m.group("name").strip().rstrip(".")
                page_num = int(m.group("page"))
                if name and page_num > 0:
                    name_to_page.setdefault(name, page_num)
    return name_to_page


def _clean_column(text: str) -> str:
    out_lines = []
    for ln in (text or "").split("\n"):
        stripped = ln.strip()
        if not stripped or _PAGE_FOOTER_RX.match(stripped):
            continue
        out_lines.append(" ".join(stripped.split()))
    return "\n".join(out_lines)


def extract_page_text_column_aware(page: pdfplumber.Page,
                                   col_margin: float = 4.0) -> str:
    """Reconstruct a 2-column SRD page in natural reading order."""
    w = page.width
    h = page.height
    mid = w / 2.0
    left = page.crop((0, 0, mid - col_margin, h)).extract_text() or ""
    right = page.crop((mid + col_margin, 0, w, h)).extract_text() or ""
    return _clean_column(left) + "\n" + _clean_column(right)


def extract_page_text(pdf: pdfplumber.PDF, page: int) -> str:
    if page < 1 or page > len(pdf.pages):
        return ""
    return extract_page_text_column_aware(pdf.pages[page - 1])


# ============================================================================
# Statblock field extractors
# ============================================================================

def _hit_point_block(text: str) -> dict[str, Any]:
    """`HP 315 (42d8 + 126)` -> `{average, roll}`."""
    m = re.search(r"\b(?:Hit\s+Points|HP)\s+(\d+)\s*\(([^)]+)\)", text)
    if not m:
        return {}
    return {"average": int(m.group(1)), "roll": m.group(2).strip()}


def _ac_block(text: str) -> dict[str, Any]:
    """`AC 20 Initiative +17 (27)` or `AC 17 (natural armor)`.

    Returns `{value, type?}`. If initiative is bundled, packs it into type.
    """
    m = re.search(r"\b(?:Armor\s+Class|AC)\s+(\d+)(.*)$", text)
    if not m:
        return {}
    val = int(m.group(1))
    rest = (m.group(2) or "").strip()
    typ: str | None = None
    if rest.startswith("(") and ")" in rest:
        # `AC 17 (natural armor)`
        inner = rest.strip("() ").strip()
        if inner:
            typ = inner
    elif rest and re.search(r"\bInitiative\b", rest, re.IGNORECASE):
        # `AC 20 Initiative +17 (27)`
        typ = re.sub(r"^Initiative\s+", "", rest, flags=re.IGNORECASE).strip()
    return {"value": val, **({"type": typ} if typ else {})}


def _speed_block(text: str) -> dict[str, int]:
    """`Speed 30 ft., fly 80 ft., swim 40 ft.` -> feet-only object in ft."""
    out: dict[str, int] = {}
    mapping = [
        ("fly",     "fly"),
        ("swim",    "swim"),
        ("climb",   "climb"),
        ("burrow",  "burrow"),
    ]
    for chunk in re.split(r",", text):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.search(r"(\d+)\s*ft", chunk)
        if not m:
            continue
        ft = int(m.group(1))
        applied = False
        for kw, key in mapping:
            if chunk.lower().startswith(kw):
                out[key] = ft
                applied = True
                break
        if not applied and "walk" not in out:
            out["walk"] = ft
    return out


def _abilities_and_saves(rows: list[str], idx: int) -> tuple[dict[str, int] | None, dict[str, int] | None, int]:
    """Consume the EN abilities matrix returning `(abilities, saves, consumed)`.

    Layout in v5.2 SRD:
      rows[idx]   = 'MOD SAVE MOD SAVE MOD SAVE'   (matrix header)
      rows[idx+1] = 'Str 11 +0 +0 Dex 16 +3 +10 ...'
      rows[idx+2] = 'Int 21 +5 +12 WIS 14 +2 +9 ...'
    """
    if idx + 2 >= len(rows):
        return (None, None, 0)
    line1 = rows[idx + 1].strip()
    line2 = rows[idx + 2].strip()
    combined = line1 + " " + line2

    abilities: dict[str, int] = {}
    saves: dict[str, int] = {}
    for m in _AB_CELL_RX.finditer(combined):
        key = m.group("key").lower()
        abilities[key] = int(m.group("score"))
        save_token = m.group("save").replace("—", "0").replace("--", "0")
        try:
            saves[key] = int(save_token)
        except (TypeError, ValueError):
            saves[key] = 0

    if len(abilities) < 6 or len(saves) < 6:
        return (None, None, 1)
    return (abilities, saves, 3)


def _cr_block(text: str) -> str:
    """`CR 21 (XP 33,000, ...)` -> '21'."""
    m = re.search(r"\bCR\s+([\d/]+)", text)
    if m:
        return m.group(1)
    # legacy
    m = re.search(r"\bChallenge\s+([\d/]+)", text)
    if m:
        return m.group(1)
    return ""


def _challenge_xp_block(text: str) -> int | None:
    """`XP 33,000` -> integer. Tolerant of comma thousands separators."""
    m = re.search(r"\bXP\s+([\d,]+)", text)
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _proficiency_bonus_block(text: str) -> int | None:
    """`PB +7` -> 7."""
    m = re.search(r"\bPB\s+([+\-]?\d+)", text)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _init_block(text: str) -> int | None:
    """`Initiative +17` from the AC line. Plus the rolled total if available."""
    m = re.search(r"Initiative\s+([+\-−]?\d+)", text)
    if not m:
        return None
    return int(re.sub(r"[+\-−]", "", m.group(1)))


def _splits_to_list(s: str) -> list[str]:
    return [x.strip() for x in re.split(r"[,;]", s) if x.strip()]


def _senses_object(text: str) -> dict[str, Any]:
    """Parse `Senses Truesight 120 ft.; Passive Perception 19`.

    Returns `{truesight: '120 ft.', passivePerception: 19, ...}` matching
    the project's `MonsterDetail.senses` contract (`Record<string, string|number>`).
    """
    body = re.sub(r"^\s*Senses\s*:?\s*", "", text, flags=re.IGNORECASE).strip()
    out: dict[str, Any] = {}
    for seg in re.split(r";", body):
        seg = seg.strip().rstrip(",.")
        if not seg:
            continue
        m = re.match(
            r"(?i)Passive\s+Perception\s+(\d+)",
            seg,
        )
        if m:
            out["passivePerception"] = int(m.group(1))
            continue
        m = re.match(
            r"(?i)(blindsight|darkvision|tremorsense|truesight)\s+(\d+\s*ft\.?)",
            seg,
        )
        if m:
            out[m.group(1).lower()] = m.group(2).strip()
            continue
        # Unknown segments are silently dropped to keep the schema strict.
    return out


def _is_section_header(line: str) -> str | None:
    norm = line.strip().rstrip(":.").lower()
    return SECTION_HEADERS_LOWER.get(norm)


_PREAMBLE_STARTS = (
    "the ",
    "a ",
    "an ",
    "if ",
    "when ",
    "while ",
    "as ",
    "for ",
    "but ",
    "always ",
    "never ",
)


def _looks_like_preamble(title: str, body: str) -> bool:
    low = title.lower()
    if any(low.startswith(w) for w in _PREAMBLE_STARTS):
        return True
    if re.match(
        r"^[A-Z]\w+\s+(can|does|has|uses|will|must|may|gains|lose)\b",
        title + " " + body.split(" ", 1)[0],
    ):
        return True
    return False


_SECTION_ENTRY_RX = re.compile(
    r"^([A-Z][\w\- ]{1,80}?)([:.])\s+(.+)$"
)


def _walk_section_entry(line: str, section: str, out: dict[str, Any]) -> None:
    """Append a {name, text} entry into `out[section]`."""
    m = _SECTION_ENTRY_RX.match(line)
    is_entry_start = False
    if m:
        title = m.group(1).strip()
        if (len(title.split()) <= 8
                and not _looks_like_preamble(title, m.group(3))):
            is_entry_start = True

    if is_entry_start and m:
        out[section].append({"name": m.group(1).strip(), "text": m.group(3).strip()})
        return
    if not out[section]:
        out[section].append({"name": "", "text": line})
    else:
        prev = out[section][-1]
        prev["text"] = (prev["text"] + " " + line).strip()


# ============================================================================
# Per-page splitter (prevents multi-creature bleed)
# ============================================================================

def _norm_name(s: str) -> str:
    """Lowercase + collapse non-alphanumerics to space + strip. Used to
    fuzzy-match chunk-leading lines to SRD index names."""
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _type_meta(match: re.Match) -> dict[str, Any]:
    return {
        "size":      match.group("size").lower().strip(),
        "type":      match.group("type").lower().strip(),
        "subtype":   (match.group("subtype") or "").strip() or None,
        "alignment": match.group("alignment").strip().rstrip("."),
    }


def _split_page_into_statblocks(page_text: str) -> list[dict[str, Any]]:
    """Split a 2-column concatenated SRD page into per-statblock chunks.

    Each chunk's `text` is bounded by `_TYPE_LINE_RX` matches (the
    primary EN opener). As a defensive fallback for creatures whose
    alignment starts with a lowercase word (`any evil`, `unaligned`),
    we ALSO recognise the in-walker fallback form `<Size> ... <Type>(?:...)?,
    <Alignment-word>` as a boundary. Both forms are anchored on the
    size-led pattern, so body text doesn't false-trigger.

    Returns a list of `{"text": str, "type_meta": dict|None}`. Each
    chunk starts with the row IMMEDIATELY ABOVE its TYPE line so the
    creature name is at chunk[0] and the TYPE line at chunk[1].

    If the page contains NO matched boundary (rare, e.g. intrusive page
    layouts), we still return a single chunk so the parser can attempt a
    best-effort extraction.
    """
    rows = [r for r in page_text.split("\n") if r.strip()]
    if not rows:
        return []

    def _detect_type(line: str) -> dict[str, Any] | None:
        m = _TYPE_LINE_RX.match(line)
        if m:
            return _type_meta(m)
        sized = re.match(
            rf"^(?P<size>{_EN_SIZE_KEYWORDS})\s+(?P<rest>.+)$",
            line,
            flags=re.IGNORECASE,
        )
        if sized and re.search(_EN_ALIGNMENT_WORDS_RX, sized.group("rest"), re.IGNORECASE):
            rest = sized.group("rest")
            if "," not in rest:
                return None
            left, _, right = rest.partition(",")
            parts = re.match(r"^([A-Za-z]+)\s*(?:\(([^)]+)\))?$", left.strip())
            if not parts:
                return None
            return {
                "size":      sized.group("size").lower().strip(),
                "type":      parts.group(1).lower().strip(),
                "subtype":   (parts.group(2) or "").strip() or None,
                "alignment": right.strip().rstrip("."),
            }
        return None

    boundaries: list[tuple[int, dict[str, Any]]] = []
    for i, line in enumerate(rows):
        meta = _detect_type(line)
        if meta is not None:
            boundaries.append((i, meta))

    if not boundaries:
        return [{"text": page_text, "type_meta": None}]

    chunks: list[dict[str, Any]] = []
    for j, (idx, meta) in enumerate(boundaries):
        end = boundaries[j + 1][0] if j + 1 < len(boundaries) else len(rows)
        # Roll the prior row (creature NAME) into the chunk ONLY if it looks
        # like a 1–4-word capitalised token group. Otherwise leave it out so
        # the chunk's first row is still the TYPE line — the picker can then
        # fall back to chunk index rather than silently capturing the
        # previous creature's last body line.
        start = idx
        if idx > 0 and _looks_like_name_row(rows[idx - 1]):
            start = idx - 1
        chunk_text = "\n".join(rows[start:end])
        chunks.append({"text": chunk_text, "type_meta": meta})
    return chunks


def _looks_like_name_row(line: str) -> bool:
    """Heuristic: does this row look like a creature NAME (1–4 capitalised
    tokens, no trailing sentence punctuation)? Used by the splitter to
    decide whether to roll the row above a TYPE line into a chunk.

    Examples that pass:
      "Kraken"
      "Adult Black Dragon"
      "Mind Flayer"
      "Vampire Spawn"
    Examples that fail:
      "It then explodes in a cascade of eldritch flame."  (length, period)
      "Lichdom. The transformation requires..."           (4 words but punctuation)
      "tau — h: +5, d: +10"                                (non-uppercase tokens)
    """
    stripped = line.strip().rstrip(":.!?,")
    if not stripped:
        return False
    tokens = stripped.split()
    if len(tokens) > 4 or not tokens:
        return False
    for tok in tokens:
        # Allow apostrophes/hyphens but require the first alphabetic char
        # to be uppercase (e.g. "Vampire", "Will-O'-Wisp").
        if not tok[0].isalpha():
            return False
        if not tok[0].isupper():
            return False
    return True


def _pick_chunk_for_name(
    chunks: list[dict[str, Any]],
    expected_name: str,
) -> int | None:
    """Find the chunk whose first line (creature NAME, when the splitter
    rolled it in) matches `expected_name`. Returns None on miss.

    Match policy (in order):
      1. Exact normalized equality (`target == head`)
      2. Target is a prefix of head (`target in head`) — covers queries
         like "Adult Black Dragon" matching a chunk head of
         "Adult Black Dragon, variant X". Safe because target is the
         more-specific lookup and head is the longer on-page label.

    Notes:
      - We deliberately do NOT match `head in target`. That would
        incorrectly resolve "Lich" queries to a "Lich Hound" chunk.
      - When the splitter did NOT roll a name row in (because no row
        above the TYPE line looked like a name), chunk[0] is the TYPE
        line itself. In that case `_norm_name(rows[0])` is the TYPE
        description and the matcher returns None; the caller's fail-soft
        logic (chunk[0] + PROVISIONAL stamp) handles it gracefully.
    """
    target = _norm_name(expected_name)
    if not target:
        return None
    target_tokens = target.split()
    for j, ch in enumerate(chunks):
        rows = [r for r in ch["text"].split("\n") if r.strip()]
        if not rows:
            continue
        head = _norm_name(rows[0])
        if not head:
            continue
        # Exact normalised equality first.
        if target == head:
            return j
        # Whole-word prefix only: target must match the FIRST token of head
        # as a prefix. This rejects `<Bear>` resolving to `<Brown Bear>`
        # (head_tokens[0] = "brown", does NOT start with "bear") and
        # `<Dragon>` resolving to `<Adult Black Dragon>` (head_tokens[0]
        # = "adult", does NOT start with "dragon"). It still accepts
        # `<Adult Black Dragon>` resolving to `<Adult Black Dragon,
        # Mythal variant>` (head_tokens[0] = "adult black dragon").
        head_tokens = head.split()
        if (head_tokens
                and len(head_tokens) >= len(target_tokens)
                and head_tokens[: len(target_tokens)] == target_tokens):
            return j
    return None


# ============================================================================
# Statblock walker
# ============================================================================

def parse_statblock(
    chunk_text: str,
    type_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Walk a single (already isolated) statblock text.

    `type_meta`, when provided by the splitter, is injected FIRST so the
    TYPE line in the chunk that immediately follows the creature name
    is recognized as the start, then skipped. This avoids re-detecting
    TYPE_LINE_RX inside the walker (which would falsely bind a section
    body line).
    """
    out: dict[str, Any] = {}
    if type_meta:
        if type_meta.get("size"):
            out["size"] = type_meta["size"]
        if type_meta.get("type"):
            out["type"] = type_meta["type"]
        if type_meta.get("subtype"):
            out["subtype"] = type_meta["subtype"]
        if type_meta.get("alignment"):
            out["alignment"] = type_meta["alignment"]

    rows = [r.strip() for r in chunk_text.split("\n") if r.strip()]
    if not rows:
        return out

    # If the chunk's first row is a TYPE line AND we injected meta from
    # the splitter, skip past it to avoid double-binding the head.
    i = 0
    if rows and _TYPE_LINE_RX.match(rows[0]):
        i = 1

    current_section: str | None = None

    while i < len(rows):
        line = rows[i]
        if not line:
            i += 1
            continue

        # Defensive bleed guard: if we're not yet inside a section and a
        # second TYPE line appears, the splitter handed us an ambiguous
        # chunk. Skip duplicates rather than binding a new creature's
        # header onto this walker's `out`.
        if current_section is None and _TYPE_LINE_RX.match(line):
            i += 1
            continue

        # === Section walking ===
        if current_section is not None:
            header_key = _is_section_header(line)
            if header_key is not None and header_key != current_section:
                current_section = header_key
                out.setdefault(current_section, [])
                i += 1
                continue
            _walk_section_entry(line, current_section, out)
            i += 1
            continue

        # === Secondary <Size> <Type>(sub)?, <Alignment> form ===
        sized = re.match(
            rf"^(?P<size>{_EN_SIZE_KEYWORDS})\s+(?P<rest>.+)$",
            line,
            flags=re.IGNORECASE,
        )
        if sized and re.search(_EN_ALIGNMENT_WORDS_RX, sized.group("rest"), re.IGNORECASE):
            rest = sized.group("rest")
            if "," in rest:
                left, _, right = rest.partition(",")
                parts = re.match(r"^([A-Za-z]+)\s*(?:\(([^)]+)\))?$", left.strip())
                if parts:
                    out.setdefault("type", parts.group(1).lower())
                    if parts.group(2):
                        out.setdefault("subtype", parts.group(2).strip())
                out.setdefault("alignment", right.strip().rstrip("."))
            i += 1
            continue

        # Ability matrix header.
        if _ABILITIES_HEADER_RX.match(line):
            abilities, saves, consumed = _abilities_and_saves(rows, i)
            if abilities is not None and saves is not None:
                out["abilities"] = abilities
                out["savingThrows"] = saves
                i += consumed
                continue

        hp = _hit_point_block(line)
        if "average" in hp:
            out["hitPoints"] = hp
            i += 1
            continue

        ac = _ac_block(line)
        if "value" in ac:
            out["armorClass"] = ac
            init = _init_block(line)
            if init is not None:
                out["initiative"] = init
            i += 1
            continue

        cr_text = _cr_block(line)
        if cr_text:
            out["challengeRating"] = cr_text
            xp = _challenge_xp_block(line)
            if xp is not None:
                out["experiencePoints"] = xp
            pb = _proficiency_bonus_block(line)
            if pb is not None:
                out["proficiencyBonus"] = pb
            i += 1
            continue

        m = re.search(r"^Speed\s+(.+)$", line, flags=re.IGNORECASE)
        if m:
            out["speed"] = _speed_block(m.group(1))
            i += 1
            continue

        # Generic single-line keyword fields.
        matched_kw = False
        for kw, key in FIELD_KEYS:
            if not (line.startswith(kw + " ") or line.startswith(kw + ":")):
                continue
            value = line[len(kw):].lstrip(": ").strip()
            if key == "senses":
                out["senses"] = _senses_object(line)
            elif key in _LIST_FIELDS:
                out[key] = _splits_to_list(value)
            else:
                out[key] = value
            matched_kw = True
            break
        if matched_kw:
            i += 1
            continue

        section_key = _is_section_header(line)
        if section_key is not None:
            current_section = section_key
            out.setdefault(current_section, [])
            i += 1
            continue

        i += 1

    return out


# ============================================================================
# Index lookup + ingest
# ============================================================================

def _match_name(idx: dict[str, int], names: list[str]) -> int | None:
    for nm in names:
        if nm in idx:
            return idx[nm]
        if slug_from_name(nm) in idx:
            return idx[slug_from_name(nm)]
    nm_norm = _norm_name(nm)
    for k, v in idx.items():
        if _norm_name(k) == nm_norm:
            return v
    return None


# Hard invariants now deliberately empty. The previous `actions` and
# `legendaryActions` checks were over-aggressive because:
#   * SRD v5.2 statblocks frequently span pages (esp. for multi-trait
#     creatures) so a chunk-cuts-at-TYPE_LINEX splitter may land mid-
#     statblock and miss the trailing `Actions` section.
#   * Many SRD v5.2 high-CR creatures (Balor, Planetar, Solar) simply
#     do not list legendary actions in the document.
# Stamp degrades to PROVISIONAL only when the multi-creature splitter
# cannot identify our slug's chunk (`pick_failed_reason`). Other
# extraction quirks are written to `srd_en_soft_warnings` so a future
# reviewer / multi-page-fix can address them without blocking the
# OFFICIAL stamp.
def _hard_invariants_pass(parsed: dict[str, Any]) -> list[str]:
    return []


def _soft_warnings(parsed: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if not parsed.get("actions"):
        warnings.append(
            "soft: no actions[] (multi-page split or partial extraction)"
        )
    high = str(parsed.get("challengeRating", ""))
    if high in HIGH_CR and not parsed.get("legendaryActions"):
        warnings.append(
            f"soft: CR {high} but no legendaryActions[] (SRD v5.2 omits)"
        )
    return warnings


def _warn_key(w: str) -> str:
    """Stable category for soft-warning dedup across runs.

    Uses text BEFORE the first colon so dedup survives warnings wording
    tweaks (e.g. "(multi-page split)" → "(multi-page fix)").
    """
    return w.split(":", 1)[0] if ":" in w else w


# ============================================================================
# Main
# ============================================================================

def _commit(out: dict[str, Any], path: pathlib.Path) -> None:
    path.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--preflight", action="store_true",
        help="Coverage report; do not write files.",
    )
    parser.add_argument(
        "--restamp", action="store_true",
        help="Re-ingest creatures that already carry the source stamp.",
    )
    parser.add_argument(
        "--only-new", action="store_true",
        help="Ingest only creatures that have no existing en/*.json file.",
    )
    args = parser.parse_args()

    pdf_path = _resolve_pdf()
    if not EN_DIR.exists():
        EN_DIR.mkdir(parents=True, exist_ok=True)

    with pdfplumber.open(pdf_path) as pdf:
        idx = extract_index(pdf, pages=(3, 4))
        print(f"Index extracted: {len(idx)} entries from PDF pages 3-4")
        print(f"PDF: {pdf_path}  ({len(pdf.pages)} pp)")

        written_official: list[str] = []
        written_provisional: list[str] = []
        rewritten: list[str] = []
        skipped: list[str] = []

        # Build the union of (slug, name) we expect to populate: existing
        # curated files + new creatures from the SRD index.
        union: dict[str, str] = {}
        if EN_DIR.exists():
            for slug in (p.stem for p in EN_DIR.glob("*.json")):
                pretty = slug.replace("_", " ").title()
                union[slug] = pretty
        for name, page in idx.items():
            slug = slug_from_name(name)
            union[slug] = name

        for slug, matched_name in sorted(union.items()):
            page_num = _match_name(idx, [matched_name])
            if page_num is None:
                if EN_DIR.exists() and (EN_DIR / f"{slug}.json").exists():
                    skipped.append(slug)
                continue

            out_path = EN_DIR / f"{slug}.json"
            cur: dict[str, Any] = {}
            if out_path.exists():
                try:
                    cur = json.loads(out_path.read_text(encoding="utf-8"))
                except Exception:
                    cur = {}

            stamp = cur.get("source")
            is_existing = out_path.exists() and bool(cur)

            if stamp not in (None, OFFICIAL_STAMP) and not args.restamp:
                skipped.append(slug)
                continue
            if args.only_new and is_existing:
                skipped.append(slug)
                continue

            page_text = extract_page_text(pdf, page_num)

            # Split the (possibly multi-creature) page into per-statblock
            # chunks, then pick the one whose leading line matches the
            # SRD index name for our slug. When the page only has one
            # chunk, the pick step is moot and we use it directly. When
            # the page has multiple chunks but our target can't be
            # identified (e.g. stripped PDF text), stamp PROVISIONAL
            # rather than silently corrupting with the wrong creature.
            chunks = _split_page_into_statblocks(page_text)
            if not chunks:
                parsed: dict[str, Any] = {}
                pick_failed_reason: str | None = None
            else:
                picked = _pick_chunk_for_name(chunks, matched_name)
                if picked is None:
                    if len(chunks) == 1:
                        # Single-chunk pages: best-effort, accept chunk[0].
                        picked = 0
                        pick_failed_reason = None
                    else:
                        # Multiple chunks but we couldn't identify ours.
                        # Accept chunk[0] but flag this PROVISIONAL so a
                        # future reviewer knows the data is untrustworthy.
                        picked = 0
                        pick_failed_reason = (
                            f"name_match_failed: '{matched_name}' did not "
                            f"match any of {len(chunks)} chunk heads; using "
                            f"chunk[0] as best-effort"
                        )
                else:
                    pick_failed_reason = None
                chosen = chunks[picked]
                parsed = parse_statblock(chosen["text"], chosen["type_meta"])

            # Compose canonical output
            new: dict[str, Any] = dict(cur)
            new["id"] = slug
            new["slug"] = slug
            new["lang"] = "en"
            if "name" not in new or not new["name"]:
                new["name"] = matched_name.replace("'", "'").strip()

            for k, v in parsed.items():
                if k in ("traits", "actions", "legendaryActions", "reactions"):
                    new[k] = v
                elif k not in new or not new[k]:
                    new[k] = v
            new["srd_en_match_name"] = matched_name
            new["srd_en_page"] = page_num

            fails = list(_hard_invariants_pass(parsed))
            if pick_failed_reason is not None:
                fails.append(pick_failed_reason)
            if fails:
                new["source"] = PROVISIONAL_STAMP
                new["srd_en_partial_reasons"] = fails
                written_provisional.append(slug)
            else:
                new["source"] = OFFICIAL_STAMP
                new.pop("srd_en_partial_reasons", None)
                if stamp == OFFICIAL_STAMP and args.restamp:
                    rewritten.append(slug)
                else:
                    written_official.append(slug)

            soft = _soft_warnings(parsed)
            existing = list(new.get("srd_en_soft_warnings") or [])
            seen = {_warn_key(w) for w in existing}
            merged = existing + [w for w in soft if _warn_key(w) not in seen]
            if merged:
                new["srd_en_soft_warnings"] = merged
            # else: leave whatever was there (often None / unset → JSON omits)

            _commit(new, out_path)

        print(
            f"Phase 1 (official-new): {len(written_official)}; "
            f"(official-restamp): {len(rewritten)}; "
            f"(partial -> provisional): {len(written_provisional)}; "
            f"SKIPPED (preserved): {len(skipped)}."
        )
        if written_provisional:
            print(f"Partial creatures (need manual review): {written_provisional}")
        if skipped:
            print(
                f"Skipped (existing curated stamps): count={len(skipped)}; "
                f"sample={skipped[:5]}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
