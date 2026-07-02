#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_es_srd.py - Extract official Spanish creature statblocks from the
`SRD_CC_v5.2.1 CASTELLANO` PDF published by Wizards of the Coast
(CC BY 4.0) and write per-creature JSON files to
`data/manuals/dnd5e-2024/monsters/es/<slug>.json` matching the project's
established schema.

Spanish SRD coverage vs EN SRD is materially smaller; many creatures are
NOT in the official Spanish document. For these, the script pre-stamps
`"source": "SRD 5.2 castellano (pendiente)"` so the provenance flag is
honest.

Source stamps (idempotent re-runs are safe):
  - "SRD 5.2 castellano (Wizards)"     - extracted from the official PDF,
                                         all section arrays populated
  - "SRD 5.2 castellano (pendiente)"   - self-translation, awaiting source
                                         OR partial official extraction

Schema contract (per existing `monsters/es/goblin.json`):
    id, slug, lang, source, name, size, type, alignment, armorClass,
    hitPoints:{average,roll}, speed:{walk,fly,swim,climb,burrow,snow},
    abilities:{str,dex,con,int,wis,cha}, saves[], skills[],
    damage{V,I,R}, conditionImmunities[], senses, languages,
    challengeRating, experiencePoints, proficiencyBonus,
    traits:[{name,text}], actions:[{name,text}], legendaryActions?:[...] .

Layout note
-----------
`SRD_CC_v5.2.1 CASTELLANO` uses a two-column layout. Naive
`pdfplumber.extract_text()` interleaves columns and yields garbled stat-
block fragments (kraken + lamia + lémur all jumbled on page 344). This
script reconciles columns first via `extract_page_text_column_aware`
(which crops each page into two halves and concatenates), then walks the
resulting line stream through both single-line field extractors and
section-block walkers (Rasgos/Atributos → traits, Acciones/Acciones
adicionales → actions, Acciones legendarias → legendaryActions,
Reacciones → reactions).
"""
from __future__ import annotations
import argparse
import json
import pathlib
import re
import sys
import unicodedata
from typing import Any

import pdfplumber

ROOT = pathlib.Path("data/manuals/dnd5e-2024")
MONSTERS_DIR = ROOT / "monsters"
ES_DIR = MONSTERS_DIR / "es"
EN_DIR = MONSTERS_DIR / "en"
PDF = ROOT / "raw-sources" / "SP_SRD_CC_v5.2.1.pdf"

OFFICIAL_STAMP = "SRD 5.2 castellano (Wizards)"
PROVISIONAL_STAMP = "SRD 5.2 castellano (pendiente)"

# Single-line statblock field extractors. Order matters: more specific
# keys must come before less specific ones to avoid prefix collisions.
FIELD_KEYS: list[tuple[str, str]] = [
    ("Inmunidad a Condición", "conditionImmunities"),
    ("Inmunidad al Daño",      "damageImmunities"),
    ("Vulnerabilidad al Daño", "damageVulnerabilities"),
    ("Resistencia al Daño",    "damageResistances"),
    ("Tiradas de Salvación",   "saves"),
    ("Sentidos",               "senses"),
    ("Idiomas",                "languages"),
    ("Habilidades",            "skills"),
    ("Clase de Peligro",       "challengeRating"),
    ("Clase de Armadura",      "armorClass"),
    ("Puntos de Golpe",        "hitPoints"),
    ("Velocidad",              "speed"),
]

# Spanish SRD section headers → English schema field. Lookup is
# case-insensitive after stripping trailing punctuation/spaces.
# "Acciones adicionales" (bonus actions) merges into `actions[]` because
# the project schema only has a single `actions` slot.
# "hechizos" and "lanzamiento de conjuros" also map to `actions[]`:
# many SRD creatures (dragons, rakshasas, liches) express their spells
# via a single `Hechizos` block rather than a per-spell `Acciones` list,
# so we capture the whole block as one `actions[]` entry named "Hechizos".
SECTION_HEADERS_LOWER: dict[str, str] = {
    "rasgos": "traits",
    "atributos": "traits",
    "acciones": "actions",
    "acciones adicionales": "actions",
    "hechizos": "actions",
    "lanzamiento de conjuros": "actions",
    "acciones legendarias": "legendaryActions",
    "reacciones": "reactions",
}

# D&D 5e SRD creature-type keywords in Spanish. These anchor the
# TYPE-line bleed trigger so it only fires on actual statblock headers,
# not on body text that incidentally mentions a type. The previous
# broad `[A-ZÁÉÍÓÚÑ][^,]*?...` form would match any capital-leading
# phrase containing a comma + alignment word — for example, a Lich's
# Atributos entry citing "muerto viviente (ex), neutral malvado" used
# to false-trigger and prematurely exit the section walker.
#
# Source: 14 keywords observed in the actual `SP_SRD_CC_v5.2.1.pdf`
# corpus (Bestia ✓ Infernal ✓ Muerto ✓ Monstruosidad ✓ Dragón ✓
# Gigante ✓ Autómata ✓ Feérico ✓ Celestial ✓ Planta ✓ Elemental ✓
# Cieno ✓ Aberración ✓) plus 3 defense-in-depth additions (Constructo,
# Licántropo, Humanoide) so future SRD revisions that introduce other
# type translations still bleed correctly.
_SRD_ES_TYPE_KEYWORDS = (
    r"Aberración|Bestia|Celestial|Autómata|Constructo|Dragón|"
    r"Elemental|Feérico|Infernal|Gigante|Licántropo|Humanoide|"
    r"Monstruosidad|Cieno|Planta|Muerto\s+viviente"
)

# TYPE-line variant anchor. The keyword whitelist uses `(?-i:...)` to
# override the outer `re.IGNORECASE` flag, so Spanish creature types
# match only when properly Capitalized at line start — body text with
# a lowercase type word mid-sentence does not bleed. Centralizing the
# suffix pattern as a helper keeps the keyword list a single source of
# truth (3 alternates × 1 keyword group, no triple-duplication).
def _type_alt(after: str) -> str:
    return rf"(?-i:(?:{_SRD_ES_TYPE_KEYWORDS}))\s+[^,]*?{after}"

_TYPE_WITH_PARENS = _type_alt(
    r"\([^)]*\),\s+(?:legal|neutral|ca[oó]tic[oa])\s+\w+"
)
_TYPE_NO_PARENS = _type_alt(
    r",\s+(?:legal|neutral|ca[oó]tic[oa])\s+\w+"
)
_TYPE_SIN_ALIN = _type_alt(
    r",\s+sin\s+alineamiento\b"
)

# Bleed trigger matched at the head of a line. Any of the following
# patterns marks "the NEXT statblock is starting":
#   * MOD. SALV.   — abilities matrix header (canonical SRD-ES pattern).
#   * Clase de ... — AC field name (defensive; opens a fresh statblock).
#   * Velocidad N  — speed field begins (defensive; opens a fresh
#                    statblock when a creature lacks CA/HP for some
#                    layout reason).
#   * "<Num> <+/−><Mod>" e.g. "Fue 18 +4" — first ability row (catches
#     the multi-line SRD-ES abilities block start).
#   * Six integers on one line — legacy compact form (some non-SRD
#     sources and ancient SRD drafts).
#   * TYPE-line variants — every SRD statblock opens with a
#     "<Type> <Size>(<Subtype>)?, <Alignment>" header. Anchored on the
#     Spanish creature-type keyword whitelist above, this hard-breaks
#     multi-creature pages so the walker doesn't bleed the next
#     creature's CA/HP/Speed into the current sections[] arrays, while
#     correctly rejecting mid-paragraph body text. Examples matched:
#       "Dragón Enorme (cromático), caótico malvado"   (with subtype)
#       "Aberración Grande, neutral malvada"           (no subtype)
#       "Bestia Mediana, sin alineamiento"             (unaligned)
_NEXT_STATBLOCK_RX = re.compile(
    r"^(MOD\.\s+SALV\."
    r"|Clase\s+de\s+Armadura"
    r"|Velocidad\s+\d"
    r"|[A-ZÁÉÍÓÚÑ]{2,4}\s+\d+\s+[+−-]\d+"
    r"|\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s*\$"
    rf"|{_TYPE_WITH_PARENS}"
    rf"|{_TYPE_NO_PARENS}"
    rf"|{_TYPE_SIN_ALIN})",
    re.IGNORECASE,
)

# Standalone abilities matrix header (line begins with this token).
_ABILITIES_HEADER_RX = re.compile(r"^MOD\.\s+SALV\.", re.IGNORECASE)

# Page footer (e.g. "344 Documento de referencia del sistema 5.2.1")
_FOOTER_RX = re.compile(r"^\s*\d{1,3}\s+Documento de referencia",
                        re.IGNORECASE)

# Section entry title: "<Capitalised>[:.] <body>", where the title is
# ≤8 words and starts with a Spanish capital (incl. accented chars).
_SECTION_ENTRY_RX = re.compile(
    r"^([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\- ]{1,80}?)"
    r"([:.])\s+"
    r"(.+)$"
)

_PREAMBLE_STARTS: tuple[str, ...] = (
    "el ", "la ", "los ", "las ", "un ", "una ", "unos ", "unas ",
    "tras ", "este ", "esta ", "estos ", "estas ",
    "si ", "cuando ", "como ", "para ", "pero ",
    "siempre ", "nunca ", "desde ",
)

# High CR tiers that usually need Legendary Actions in the SRD.
HIGH_CR = {"15", "16", "17", "18", "19", "20", "21", "22", "23", "24",
           "25", "26", "30"}

SLUG_TO_NAMES: dict[str, list[str]] = {
    "goblin": ["Goblin"], "orc": ["Orco"], "hobgoblin": ["Hobgoblin"],
    "kobold": ["Kobold"], "gnoll": ["Gnoll"],
    "lizardfolk": ["Lagartoide", "Lagarto gigante"],
    "bugbear": ["Trasgo"], "centaur": ["Centauro"], "minotaur": ["Minotauro"],
    "satyr": ["Sátiro"], "dryad": ["Dríade"], "pixie": ["Duende", "Hada"],
    "blink_dog": ["Perro parpadeante"], "gryphon": ["Grifo"],
    "ape": ["Simio"], "bat": ["Murciélago"], "boar": ["Jabalí"],
    "black_bear": ["Oso negro"], "brown_bear": ["Oso pardo"],
    "polar_bear": ["Oso polar"], "lion": ["León"], "panther": ["Pantera"],
    "wolf": ["Lobo"], "dire_wolf": ["Lobo terrible"],
    "giant_spider": ["Araña gigante"], "giant_frog": ["Rana gigante"],
    "giant_crab": ["Cangrejo gigante"], "giant_owl": ["Búho gigante"],
    "giant_eagle": ["Águila gigante"], "giant_hyena": ["Hiena gigante"],
    "giant_boar": ["Jabalí gigante"],
    "draft_horse": ["Caballo de tiro"], "riding_horse": ["Caballo de montar"],
    "rhinoceros": ["Rinoceronte"], "elephant": ["Elefante"],
    "mammoth": ["Mamut"], "tyrannosaurus_rex": ["Tiranosaurio rex"],
    "mastiff": ["Mastín"],
    "animated_armor": ["Armadura animada"], "flying_sword": ["Espada voladora"],
    "rug_of_smothering": ["Alfombra asfixiante", "Tapete asfixiante"],
    "homunculus": ["Homúnculo"], "shield_guardian": ["Guardián del escudo"],
    "clay_golem": ["Gólem de arcilla"], "stone_golem": ["Gólem de piedra"],
    "iron_golem": ["Gólem de hierro"],
    "iron_coffin_draugr": ["Draugr del ataúd de hierro"],
    "air_elemental": ["Elemental de aire"],
    "earth_elemental": ["Elemental de tierra"],
    "fire_elemental": ["Elemental de fuego"],
    "water_elemental": ["Elemental de agua"],
    "invisible_stalker": ["Perseguidor invisible"],
    "djinni": ["Djinn", "Djinni"], "efreeti": ["Efreet", "Efriti"],
    "ogre": ["Ogro"], "oni": ["Oni"], "troll": ["Trol"],
    "hill_giant": ["Gigante de las colinas"],
    "stone_giant": ["Gigante de piedra"],
    "fire_giant": ["Gigante de fuego"],
    "frost_giant": ["Gigante de escarcha", "Gigante de hielo"],
    "cloud_giant": ["Gigante de las nubes"],
    "storm_giant": ["Gigante de las tormentas"],
    "wraith": ["Ánima penada", "Aparecido"],
    "wight": ["Mortívago"], "specter": ["Espectro"], "shadow": ["Sombra"],
    "zombie": ["Zombi"], "skeleton": ["Esqueleto"], "ghost": ["Fantasma"],
    "banshee": ["Banshee"],
    "kraken": ["Kraken"],
    "lich": ["Liche"], "vampire": ["Vampiro"],
    "mummy": ["Momia"], "mummy_lord": ["Señor de las momias"],
    "revenant": ["Vengador"],
    "will_o_wisp": ["Fuego fatuo"],
    "vampire_spawn": ["Prole de vampiro"],
    "death_knight": ["Caballero de la muerte"],
    "quasit": ["Quasit"], "dretch": ["Dretch"],
    "barbed_devil": ["Diablo barbado", "Diablo erizado"],
    "hezrou": ["Hezrou"], "glabrezu": ["Glabrezu"],
    "erinyes": ["Erinia"], "balor": ["Balor"],
    "pit_fiend": ["Señor del abismo"],
    "basilisk": ["Basilisco"], "hippogriff": ["Hipogrifo"],
    "hydra": ["Hidra"], "purple_worm": ["Gusano púrpura"],
    "remorhaz": ["Remorhaz"], "sphinx": ["Esfinge"],
    "owlbear": ["Búho-oso"], "manticore": ["Mantícora"],
    "tarrasque": ["Tarrasque"], "bulette": ["Bulette"],
    "chimera": ["Quimera"], "behir": ["Behir"],
    "adult_black_dragon": ["Dragón negro adulto"],
    "adult_blue_dragon": ["Dragón azul adulto"],
    "adult_green_dragon": ["Dragón verde adulto"],
    "adult_red_dragon": ["Dragón rojo adulto"],
    "adult_white_dragon": ["Dragón blanco adulto"],
    "young_red_dragon": ["Dragón rojo joven"],
    "young_blue_dragon": ["Dragón azul joven"],
    "ancient_red_dragon": ["Dragón rojo antiguo"],
    "ancient_blue_dragon": ["Dragón azul antiguo"],
    "mind_flayer": ["Devoramentes", "Psiónico"],
    "beholder": ["Observador"],
    "aboleth": ["Aboleth"], "gibbering_mouther": ["Farfullador", "Murmullador"],
    "otyugh": ["Otyugh"], "chuul": ["Chuul"], "cloaker": ["Encubridor"],
    "androsphinx": ["Esfinge andro"],
    "green_hag": ["Bruja verde"],
    "couatl": ["Couatl"], "deva": ["Deva"], "solar": ["Solar"],
    "pegasus": ["Pegaso"], "unicorn": ["Unicornio"],
    "gelatinous_cube": ["Cubo gelatinoso"],
    "ochre_jelly": ["Gelatina ocre"],
    "black_pudding": ["Pudín negro"], "gray_ooze": ["Limo gris"],
    "shambling_mound": ["Montículo errante", "Montículo andante"],
    "awakened_tree": ["Árbol despierto"], "treant": ["Treant"],
    "acolyte": ["Acólito"], "bandit": ["Bandido"],
    "bandit_captain": ["Capitán bandido"], "berserker": ["Berserker"],
    "cultist": ["Cultista"], "guard": ["Guardia"],
    "knight": ["Caballero"], "priest": ["Sacerdote"], "spy": ["Espía"],
    "thug": ["Matón"], "veteran": ["Veterano"], "mage": ["Mago"],
    "assassin": ["Asesino"], "archmage": ["Archimago"],
    "druid": ["Druida"],
}


# =============================================================================
# PDF helpers: index extraction + column-aware page text
# =============================================================================

def extract_index(pdf: pdfplumber.PDF,
                  pages: tuple[int, ...] = (3, 4)) -> dict[str, int]:
    """Parse the Spanish SRD index from `pdf.pages`.

    The index is multi-column, so several entries may share one text
    line: "Lagarto gigante . . . . . . . 388 Rana gigante . . . . . . . 392".
    """
    name_to_page: dict[str, int] = {}
    rx = re.compile(
        r"(?P<name>[A-ZÁÉÍÓÚÑ][^\.]+?)"
        r"\s*\.{2,}\s*"
        r"(?P<page>\d{1,3})"
        r"(?=\s+[A-ZÁÉÍÓÚÑ]|\s*$|\n)"
    )
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
    out_lines: list[str] = []
    for ln in (text or "").split("\n"):
        stripped = ln.strip()
        if not stripped or _FOOTER_RX.match(stripped):
            continue
        out_lines.append(" ".join(stripped.split()))
    return "\n".join(out_lines)


def extract_page_text_column_aware(page: pdfplumber.Page,
                                   col_margin: float = 4.0) -> str:
    """Reconstruct a two-column Spanish SRD page in natural reading order.

    The Spanish SRD stores text in two independent streams per page
    (each column is one stream, top-to-bottom). pdfplumber's `crop` lets
    us trim the page to a single column and run plain `extract_text()`
    against it — much more reliable than word/char clustering heuristics
    which break at line-wrap hyphenation.

    Emits LEFT column fully (top-to-bottom), then RIGHT column fully
    (top-to-bottom), filtering out page-header/footer lines and
    collapsing internal whitespace.
    """
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


# =============================================================================
# Statblock parser: index-based, lookahead-aware field walker
# =============================================================================

def _hit_point_block(text: str) -> dict[str, Any]:
    """Parse 'Puntos de Golpe 135 (18d8 + 54)' into {average, roll}."""
    m = re.search(r"Puntos\s+de\s+Golpe\s+(\d+)\s*\(([^)]+)\)", text)
    if not m:
        return {}
    return {"average": int(m.group(1)), "roll": m.group(2).strip()}


def _speed_block(text: str) -> dict[str, int]:
    """Parse Spanish 'Velocidad 9 m., volar 12 m., trepar 6 m.' → feet block.

    Returns a dict of speed modes mapped to feet: walk, fly, swim, climb,
    burrow. Meters → feet conversion: int(round(raw * 3.28084 / 5) * 5)
    to match the EN SRD's 5-ft granularity used by every pre-existing ES
    file.
    """
    out: dict[str, int] = {}
    mapping = [
        ("a pies",   "walk"),
        ("a pie",    "walk"),
        ("volar",    "fly"),
        ("nadar",    "swim"),
        ("trepar",   "climb"),
        ("excavar",  "burrow"),
    ]
    for chunk in re.split(r",", text):
        chunk = chunk.strip()
        if not chunk:
            continue
        applied = False
        for kw, key in mapping:
            if chunk.startswith(kw):
                m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:m\.?|metros?)", chunk)
                if m:
                    raw = float(m.group(1).replace(",", "."))
                    out[key] = int(round(raw * 3.28084 / 5) * 5)
                applied = True
                break
        if not applied and "walk" not in out:
            m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:m\.?|metros?)", chunk)
            if m:
                raw = float(m.group(1).replace(",", "."))
                out["walk"] = int(round(raw * 3.28084 / 5) * 5)
    return out


def _ability_block(parts: list[str]) -> dict[str, int]:
    """Compact six-integers-on-one-line form. SRD-ES uses 2 rows instead."""
    keys = ("str", "dex", "con", "int", "wis", "cha")
    return {k: int(v) for k, v in zip(keys, parts)}


def _consume_srd_es_abilities(rows: list[str], idx: int) -> tuple[dict[str, int] | None, int]:
    """Consume a Spanish-SRD multi-line abilities block starting at `idx`.

    Layout:
        rows[idx]     = 'MOD. SALV. MOD. SALV. MOD. SALV.'
        rows[idx+1]   = 'Fue 18 +4 +4 Des 8 −1 −1 Con 17 +3 +3'
        rows[idx+2]   = 'Int 7 −2 −2 sab 16 +3 +3 Car 6 −2 −2'

    Returns (abilities_dict, lines_consumed). `lines_consumed` is the
    count of rows consumed including the header, so the caller advances
    by that amount. The keys order is (str, dex, con, int, wis, cha).
    """
    if idx + 2 >= len(rows):
        return (None, 0)
    line1 = rows[idx + 1].strip()
    line2 = rows[idx + 2].strip()
    # Six "<score> <mod>" pairs across the two rows.
    triples = re.findall(r"(\d+)\s+[+−\-]\d+", line1 + " " + line2)
    if len(triples) < 6:
        return (None, 1)
    keys = ("str", "dex", "con", "int", "wis", "cha")
    return ({k: int(triples[i]) for i, k in enumerate(keys)}, 3)


def _splits_to_list(s: str) -> list[str]:
    return [x.strip() for x in re.split(r"[,;]", s) if x.strip()]


def _is_section_header(line: str) -> str | None:
    norm = line.strip().rstrip(":.").lower()
    return SECTION_HEADERS_LOWER.get(norm)


def _looks_like_preamble(title: str, body: str) -> bool:
    """Detect sentences that LOOK like section titles but are preambles."""
    low = title.lower()
    if any(low.startswith(w) for w in _PREAMBLE_STARTS):
        return True
    if re.match(
        r"^[A-ZÁÉÍÓÚÑ]\w+\s+(puede|debe|tiene|usa|emplea|lanza|hace|realiza)\b",
        title + " " + body.split(" ", 1)[0],
    ):
        return True
    return False


def _walk_section_entry(line: str, section: str,
                        out: dict[str, Any]) -> None:
    """Append or extend a section entry based on `line`.

    Entry start = ≤8-word title followed by `: ` or `. ` and body.
    Non-matching lines are appended as continuations of the previous
    entry's text.
    """
    m = _SECTION_ENTRY_RX.match(line)
    is_entry_start = False
    if m:
        title = m.group(1).strip()
        if (len(title.split()) <= 8
                and not _looks_like_preamble(title, m.group(3))):
            is_entry_start = True

    if is_entry_start and m:
        out[section].append({
            "name": m.group(1).strip(),
            "text": m.group(3).strip(),
        })
        return

    if not out[section]:
        out[section].append({"name": "", "text": line})
    else:
        prev = out[section][-1]
        prev["text"] = (prev["text"] + " " + line).strip()


def parse_statblock(text: str) -> dict[str, Any]:
    """Statblock extractor with inline section walking.

    Iterates lines by INDEX so we can lookahead for the SRD-ES
    "MOD. SALV." + 2 rows abilities block. Pre-section lines feed the
    single-line detector (AC, HP, speed, abilities, saves, skills, etc.).
    Once a section header is encountered, switches to the section walker
    that emits `<name, text>` entries until the next statblock opens.
    """
    out: dict[str, Any] = {}
    if not text:
        return out

    rows = [r.strip() for r in text.split("\n") if r.strip()]
    if not rows:
        return out

    current_section: str | None = None
    i = 0
    while i < len(rows):
        line = rows[i]
        if not line:
            i += 1
            continue

        # --- Section walking state ---
        if current_section is not None:
            # Bleed trigger — the next statblock is opening. Reset
            # `current_section` to None and continue so we keep
            # processing the rest of the page in non-section mode
            # (this is critical for multi-creature pages where a TYPE
            # line for the next creature appears mid-statblock).
            if _NEXT_STATBLOCK_RX.match(line):
                current_section = None
                i += 1
                continue
            # Section switch mid-walker: e.g. kraken transitions from
            # `Acciones` to `Acciones legendarias` without a statblock
            # boundary between them. Detect and switch the active
            # section rather than merging the new header into the
            # previous entry's text.
            header_key = _is_section_header(line)
            if header_key is not None and header_key != current_section:
                current_section = header_key
                out.setdefault(current_section, [])
                i += 1
                continue
            _walk_section_entry(line, current_section, out)
            i += 1
            continue

        # --- Single-line statblock extraction (pre-section block) ---

        # Legacy compact abilities form (defensive; rare in SRD-ES).
        if re.fullmatch(r"\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+", line):
            out["abilities"] = _ability_block(line.split())
            i += 1
            continue

        # SRD-ES multi-line abilities block (header + 2 rows).
        if _ABILITIES_HEADER_RX.match(line):
            abilities, consumed = _consume_srd_es_abilities(rows, i)
            if abilities is not None:
                out["abilities"] = abilities
                i += consumed
                continue
            # Malformed — fall through and treat header as a single line.

        hp = _hit_point_block(line)
        if "average" in hp:
            out["hitPoints"] = hp
            i += 1
            continue

        m = re.search(r"Clase\s+de\s+Armadura\s+(\d+)(?:\s*\(([^)]+)\))?",
                      line)
        if m:
            ac_val = int(m.group(1))
            ac_type = (m.group(2) or "").strip()
            out["armorClass"] = (
                {"value": ac_val, "type": ac_type} if ac_type else ac_val
            )
            i += 1
            continue

        m = re.search(r"Velocidad\s+(.+)$", line)
        if m:
            out["speed"] = _speed_block(m.group(1))
            i += 1
            continue

        m = re.search(r"Clase\s+de\s+Peligro\s+([\d/]+)", line)
        if m:
            out["challengeRating"] = m.group(1)
            i += 1
            continue

        # Generic single-line keyword fields (damage, saves, skills, etc.).
        matched_kw = False
        for kw, key in FIELD_KEYS:
            if line.startswith(kw + " ") or line.startswith(kw + ":"):
                value = line[len(kw):].lstrip(": ").strip()
                if key in {
                    "saves", "skills", "senses", "languages",
                    "damageVulnerabilities", "damageResistances",
                    "damageImmunities", "conditionImmunities",
                }:
                    out[key] = _splits_to_list(value)
                else:
                    out[key] = value
                matched_kw = True
                break
        if matched_kw:
            i += 1
            continue

        # New section header? Start walking entries into it.
        section_key = _is_section_header(line)
        if section_key is not None:
            current_section = section_key
            out.setdefault(current_section, [])
            i += 1
            continue

        i += 1

    return out


# =============================================================================
# Index lookup + main ingest loop
# =============================================================================

def _normalize_slug(slug: str) -> str:
    """Normalize a filesystem slug for SLUG_TO_NAMES lookup.

    The filesystem allows hyphens (``acolyte-captain.json``) but
    ``SLUG_TO_NAMES`` keys use underscores (``acolyte_captain``).
    Without this normalization the lookup misses and falls back to a
    Title-Cased English form (``Acolyte Captain``) which is not in the
    Spanish SRD index, sending every such creature to Phase-2
    "relabel" and leaving it stamped as PROVISIONAL forever.
    """
    return slug.replace("-", "_")


def _strip_accents(s: str) -> str:
    """Remove diacritics for accent-tolerant name matching.

    Tolerates SRD index drift such as ``Dragón`` ↔ ``Dragon`` or
    ``Líche`` ↔ ``Liche`` across PDF revisions. Uses the NFD
    decomposition form so combining marks (category Mn) can be filtered
    out efficiently.
    """
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def expected_targets() -> list[tuple[str, list[str]]]:
    """Return ``(slug, names)`` for every existing ES file.

    The slug in the tuple is the **filesystem stem** (preserving
    hyphens) so the downstream ``out_path = ES_DIR / f"{slug}.json"``
    writes overwrite the original file in place. SLUG_TO_NAMES lookup
    uses the underscore-normalized form because the dictionary keys
    use underscores. The fallback Title-Cased name handles both
    separators so e.g. ``acolyte-captain`` falls back to
    ``"Acolyte Captain"`` rather than ``"Acolyte-captain"``.
    """
    existing = sorted(p.stem for p in ES_DIR.glob("*.json"))
    return [
        (
            slug,
            SLUG_TO_NAMES.get(_normalize_slug(slug))
            or [slug.replace("_", " ").replace("-", " ").title()],
        )
        for slug in existing
    ]


def match_name(idx: dict[str, int], names: list[str]) -> int | None:
    """Resolve Spanish SRD page number for any of ``names``.

    Three-pass resolution (most-specific first):

    1. **Exact** — direct lookup against index keys (handles
       ``Elemental de aire`` etc.).
    2. **Case- and whitespace-insensitive** — tolerates capitals and
       stray whitespace drift such as ``"Liche"`` vs ``"LICHE "``.
    3. **Accent-tolerant** — strips diacritics via ``_strip_accents``
       and lowers, accepting e.g. ``"Dragon"`` ↔ ``"Dragón"``.

    Each pass pre-computes the normalized lookup table once so worst-
    case complexity is O(names + idx), not O(names × idx).
    """
    if not idx or not names:
        return None

    # Pass 1: exact match
    name_set = set(names)
    for k, v in idx.items():
        if k in name_set:
            return v

    # Pass 2: case- and whitespace-insensitive
    norm_names = {nm.strip().lower() for nm in names}
    norm_idx = {k: k.strip().lower() for k in idx}
    for k, v in idx.items():
        if norm_idx[k] in norm_names:
            return v

    # Pass 3: accent-tolerant
    acc_names = {_strip_accents(n).strip().lower() for n in names}
    acc_idx = {k: _strip_accents(k).strip().lower() for k in idx}
    for k, v in idx.items():
        if acc_idx[k] in acc_names:
            return v

    return None


def _hard_invariants_pass(parsed: dict[str, Any]) -> list[str]:
    """Return a list of hard-invariance failures (empty == OK to stamp)."""
    fails: list[str] = []
    if not parsed.get("actions"):
        fails.append("no actions[] (no Acciones header parsed)")
    high = str(parsed.get("challengeRating", ""))
    if high in HIGH_CR and not parsed.get("legendaryActions"):
        fails.append(f"CR {high} but no legendaryActions[]")
    return fails


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ingest Spanish SRD into es/ JSON files."
    )
    parser.add_argument(
        "--preflight", action="store_true",
        help="Only print coverage report; do not write files.",
    )
    parser.add_argument(
        "--restamp", action="store_true",
        help="Re-ingest creatures even if they already carry the official stamp.",
    )
    parser.add_argument(
        "--report-path", default=None,
        help="Where to write the JSON coverage report (default: stdout only).",
    )
    args = parser.parse_args()

    if not PDF.exists():
        print(f"PDF not found: {PDF}", file=sys.stderr)
        return 2
    if not ES_DIR.exists():
        print(f"es dir not found: {ES_DIR}", file=sys.stderr)
        return 2

    with pdfplumber.open(PDF) as pdf:
        idx = extract_index(pdf, pages=(3, 4))
        targets = expected_targets()

        present: list[tuple[str, int, str]] = []
        missing: list[tuple[str, list[str]]] = []
        for slug, names in targets:
            page_num = match_name(idx, names)
            if page_num is None:
                missing.append((slug, names))
            else:
                present.append((slug, page_num, names[0] if names else slug))

        print(f"Index extracted: {len(idx)} entries from PDF pages 3-4")
        print(f"Coverage: {len(present)} present / "
              f"{len(missing)} missing of {len(targets)} targets")

        if args.report_path:
            pathlib.Path(args.report_path).write_text(
                json.dumps(
                    {
                        "present": [
                            {"slug": s, "page": p, "name": n}
                            for s, p, n in present
                        ],
                        "missing": [
                            {"slug": s, "candidates": n}
                            for s, n in missing
                        ],
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )

        if args.preflight:
            return 0

        # Phase 1: SRD-present creatures. Each gets OFFICIAL_STAMP ONLY
        # if hard invariants pass; otherwise PROVISIONAL_STAMP (partial).
        warnings: list[str] = []
        written_official: list[str] = []
        rewritten: list[str] = []
        written_provisional: list[str] = []
        for slug, page_num, matched in present:
            page_text = extract_page_text(pdf, page_num)
            parsed = parse_statblock(page_text)
            out_path = ES_DIR / f"{slug}.json"
            cur: dict[str, Any] = {}
            if out_path.exists():
                try:
                    cur = json.loads(out_path.read_text(encoding="utf-8"))
                except Exception:
                    cur = {}

            stamp = cur.get("source")
            if stamp == OFFICIAL_STAMP and not args.restamp:
                continue

            new: dict[str, Any] = dict(cur)
            new["id"] = slug
            new["slug"] = slug
            new["lang"] = "es"
            if "name" not in new:
                new["name"] = matched.title()

            # Section arrays: REPLACE from scratch on restamp / fresh write
            # so re-running always produces the canonical Spanish SRD shape.
            # Single-line fields: only fill if missing (preserve curated
            # human improvements and avoid wiping non-empty existing data).
            for k, v in parsed.items():
                if k in ("traits", "actions", "legendaryActions", "reactions"):
                    new[k] = v
                elif k not in new or not new[k]:
                    new[k] = v
            new["srd_es_match_name"] = matched
            new["srd_es_page"] = page_num

            # Hard invariants decide which stamp.
            fails = _hard_invariants_pass(parsed)
            if fails:
                new["source"] = PROVISIONAL_STAMP
                new["srd_es_partial_reasons"] = fails
                for f in fails:
                    warnings.append(f"WARN [{slug}] partial-official: {f}")
                written_provisional.append(slug)
            else:
                new["source"] = OFFICIAL_STAMP
                new.pop("srd_es_partial_reasons", None)
                (rewritten if stamp == OFFICIAL_STAMP else written_official).append(slug)

            out_path.write_text(
                json.dumps(new, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        # Phase 2: SRD-missing creatures — never rewrote ES content; just
        # relabel source to honest PROVISIONAL_STAMP if not already set.
        # Must mirror the constant defined in backfill_es_from_en.py so
        # auto-translated files survive a re-ingest without losing the
        # ``(pendiente, autotraducido)`` stamp that distinguishes them
        # from manually-authored PROVISIONAL entries.
        AUTOTRANS_STAMP = "SRD 5.2 castellano (pendiente, autotraducido)"
        relabeled: list[str] = []
        for slug, _names in missing:
            out_path = ES_DIR / f"{slug}.json"
            if not out_path.exists():
                continue
            try:
                cur = json.loads(out_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if cur.get("source") in (
                OFFICIAL_STAMP, PROVISIONAL_STAMP, AUTOTRANS_STAMP,
            ):
                continue
            cur["source"] = PROVISIONAL_STAMP
            out_path.write_text(
                json.dumps(cur, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            relabeled.append(slug)

        print(
            f"Phase 1 (official-new): {len(written_official)}; "
            f"(official-restamp): {len(rewritten)}; "
            f"(partial -> provisional): {len(written_provisional)}."
        )
        print(f"Phase 2 (provisional relabel): {len(relabeled)}.")
        if warnings:
            print(f"\nWarnings ({len(warnings)}):")
            for w in warnings[:30]:
                print(f"  {w}")
            if len(warnings) > 30:
                print(f"  ... and {len(warnings) - 30} more")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
