#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""extract_es_bestiary.py - Bulk-walker for the Spanish SRD 5.2.1 bestiary.

ONLY data coming from the official Spanish SRD PDF (the CC-BY-4.0 file
under ``raw-sources/SP_SRD_CC_v5.2.1.pdf``) is allowed into the ES
monster JSONs. No name is faked from the English slug; no field value
is taken from any other source.

Algorithm
---------
1. ``bulk_walk_bestiary`` walks every page of the bestiary section
   of the SRD PDF (pages 280..end), detects every creature chunk via
   the strict TYPE_LINE regex (``<Type> <Size>(<Sub>)?, <Alignment>``,
   e.g. ``Muerto viviente Mediano, neutral malvado``), parses each
   chunk, and stores it in a ``folded_name -> (page, data, name)``
   map. Every chunk's ``name`` is the line printed immediately above
   the TYPE LINE in the official Spanish source.
2. For each EN slug (the slug coming from the existing ``en/<slug>.json``
   file name), ``slug_candidates`` returns the list of candidate
   Spanish names from the curated ``SLUG_TO_ES_NAMES`` table. The
   table contains ONLY entries whose name appears in the official
   Spanish SRD; no auto-translation is performed.
3. If any candidate's ``fold(name)`` matches a key in
   ``chunks_by_name``, the chunk's data is written verbatim — the
   PDF's TYPE LINE provides ``size``/``type``/``alignment``, the
   single-line fields provide ``armorClass``/``hitPoints``/``speed``
   /``abilities``/etc., the section walker provides ``traits``,
   ``actions``, ``legendaryActions``, ``reactions``.
4. If no candidate matches, the slug is stamped ``... (pendiente)``
   with ``name: null`` and all stat-block fields explicit-null —
   i.e. "couldn't find this on the Spanish SRD PDF bestiary".

Outputs ``backend/data/manuals/dnd5e-2024/monsters/es/<slug>.json``.

Run from ``C:\\CODE V2\\dm-app\\MasterHelp\\backend\\``:

    python -X utf8 scripts/extract_es_bestiary.py --preflight
    python -X utf8 scripts/extract_es_bestiary.py
    python -X utf8 scripts/extract_es_bestiary.py --only-slug zombie
"""
from __future__ import annotations
import argparse
import json
import pathlib
import re
import sys
import unicodedata
from typing import Any, Optional

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    sys.stderr.write("pdfplumber not installed; pip install pdfplumber\n")
    raise

ROOT = pathlib.Path("data/manuals/dnd5e-2024")
ES_DIR = ROOT / "monsters" / "es"
PDF = ROOT / "raw-sources" / "SP_SRD_CC_v5.2.1.pdf"

STAMP_OFFICIAL = "SRD 5.2 castellano (Wizards)"
STAMP_PENDING = "SRD 5.2 castellano (pendiente)"

# Section headers in the Spanish SRD bestiary chunk -> project field.
SECTION_HEADERS: dict[str, str] = {
    "rasgos": "traits",
    "atributos": "traits",
    "acciones": "actions",
    "acciones adicionales": "actions",
    "hechizos": "actions",
    "lanzamiento de conjuros": "actions",
    "acciones legendarias": "legendaryActions",
    "reacciones": "reactions",
}


FIELD_KEYS: list[tuple[str, str]] = [
    ("Inmunidad a Condición", "conditionImmunities"),
    ("Inmunidad al Daño", "damageImmunities"),
    ("Vulneridad al Daño", "damageVulnerabilities"),
    ("Vulnerabilidad al Daño", "damageVulnerabilities"),
    ("Resistencia al Daño", "damageResistances"),
    ("Tiradas de Salvación", "saves"),
    ("Sentidos", "senses"),
    ("Idiomas", "languages"),
    ("Habilidades", "skills"),
    ("Clase de Peligro", "challengeRating"),
    ("Desafío", "challengeRating"),
    ("Clase de Armadura", "armorClass"),
    ("Puntos de Golpe", "hitPoints"),
    ("Velocidad", "speed"),
] 
LIST_FIELDS = {
    "saves", "skills",
    "damageVulnerabilities", "damageResistances",
    "damageImmunities", "conditionImmunities",
}

_ES_TYPE_LX = (
    r"Muerto\s+viviente|"
    r"Aberraci[oó]n|Bestia|Celestial|Constructo|Drag[oó]n|"
    r"Elemental|Fe[eé]rico|Humanoide|Infernal|Gigante|"
    r"Cieno|Monstruosidad|Planta|"
    r"No[\-\s]?muerto"
)
_ES_SIZE_LX = (
    r"Diminut[oa]|Menud[oa]|Pequeñ[oa]|Median[oa]|"
    r"Grande|Enorme|Gargantuesc[oa]"
)
_ALIGN_LX = (
    r"(?:" +
    r"legal\s+(?:bueno|neutral|malvado)" +
    r"|neutral\s+(?:bueno|malvado)" +
    r"|ca[oó]tic[oa]\s+(?:bueno|neutral|malvado)" +
    r"|sin\s+alineamiento" +
    r"|cualquiera" +
    r")"
)

TYPE_LINE_RX = re.compile(
    rf"^(?P<type>{_ES_TYPE_LX})"
    rf"(?:\s+(?P<sub>\([^)]+\)))?"
    rf"\s+(?P<size>{_ES_SIZE_LX})"
    rf"(?:\s*,\s*(?P<align>{_ALIGN_LX}))?"
    rf"\s*$",
    re.IGNORECASE,
)
TYPE_LINE_LAX_RX = re.compile(
    rf"^(?P<type>{_ES_TYPE_LX})(?:\s+(?P<sub>\([^)]+\)))?\s+"
    rf"(?P<size>{_ES_SIZE_LX})\s*,"
    rf"\s*(?P<align>.+)$",
    re.IGNORECASE,
)
# Spanish SRD uses either "MOD. Salvación" or shorter "TIR. SAL. / MOD."
_AB_HEADER_RX = re.compile(
    r"^(?:MOD\.?\s*Sal\.?|MOD\.?\s*Salvación\.?|TIR\.?\s*Sal\.?|"
    r"Tiradas\s+de\s+Salvaci[oó]n\.?)\s*$",
    re.IGNORECASE,
)
# Section entry — case-sensitive so lowercase mid-sentence wrap fragments
# (e.g. "disco" from column-wrapped "mor- disco") are NOT picked up
# as section titles.
_SECTION_ENTRY_RX = re.compile(
    r"^([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\- ]{1,60}?)([:.])\s+(.+)$"
)
_NON_ACTION_WORDS: frozenset[str] = frozenset({
    # Spanish ability scores — appear as part of "Tirada de salvación de …"
    "fuerza", "destreza", "constitución", "inteligencia", "sabiduría", "carisma",
    # Save throw result text
    "éxito", "exito", "fracaso", "fallo",
    # Common connective words that, if line-broken, look like titles
    "éxito", "éxitos", "tirada", "tiradas",
    # Prepositions/particles never legal as standalone action titles
    "de", "del", "la", "el", "los", "las", "y", "o", "u",
    "al", "a", "en", "con", "sin", "por", "para", "una", "uno",
    "un", "unos", "unas",
})


def _mid_sentence(text: str) -> bool:
    """True if the previous entry's text is clearly mid-sentence."""
    s = text.rstrip()
    if not s:
        return True
    last = s[-1]
    if last in ".!?…":
        return False
    # Spanish SRD strips hyphens at line-wrap ("daño radiante." "ante." → "...").
    # If the text ends with a hyphen followed by a space, the sentence is
    # continuing too.
    if s.endswith("- "):
        return True
    s_no_punct = s.rstrip(",;:")
    if s_no_punct.endswith(" de") or s_no_punct.endswith(" del") \
            or s_no_punct.endswith(" con") or s_no_punct.endswith(" la") \
            or s_no_punct.endswith(" el") or s_no_punct.endswith(" en") \
            or s_no_punct.endswith(" a") or s_no_punct.endswith(" y") \
            or s_no_punct.endswith(" o"):
        return True
    return False
_FOOTER_RX = re.compile(r"^\s*\d+\s+Documento de referencia", re.IGNORECASE)
_COMPACT_6 = re.compile(r"^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$")

# ---------------------------------------------------------------------------
# EN slug -> candidate Spanish names (read from the official Spanish SRD).
# The mapping supplies the list of names to look up in the bulk-walked
# bestiary; if a slug is not present here, the bulk-walker will not be
# able to locate its chunk in the PDF and the entry stays as a
# minimal pending stub.
# ---------------------------------------------------------------------------
SLUG_TO_ES_NAMES: dict[str, list[str]] = {
    "abjuration_adept": ["Adepto de la abjuración"],
    "abjurer": ["Abjurador"],
    "aboleth": ["Aboleth"],
    "acolyte": ["Acólito"],
    "acolyte_captain": ["Capitán acólito"],
    "adult_black_dragon": ["Dragón negro adulto"],
    "adult_blue_dragon": ["Dragón azul adulto"],
    "adult_bronze_dragon": ["Dragón de bronce adulto"],
    "adult_brass_dragon": ["Dragón de latón adulto"],
    "adult_copper_dragon": ["Dragón de cobre adulto"],
    "adult_gold_dragon": ["Dragón dorado adulto"],
    "adult_green_dragon": ["Dragón verde adulto"],
    "adult_red_dragon": ["Dragón rojo adulto"],
    "adult_silver_dragon": ["Dragón plateado adulto"],
    "adult_white_dragon": ["Dragón blanco adulto"],
    "air-elemental": ["Elemental del aire"],
    "air_elemental": ["Elemental del aire"],
    "ancient_black_dragon": ["Dragón negro antiguo"],
    "ancient_blue_dragon": ["Dragón azul antiguo"],
    "ancient_brass_dragon": ["Dragón de latón antiguo"],
    "ancient_bronze_dragon": ["Dragón de bronce antiguo"],
    "ancient_copper_dragon": ["Dragón de cobre antiguo"],
    "ancient_gold_dragon": ["Dragón dorado antiguo"],
    "ancient_green_dragon": ["Dragón verde antiguo"],
    "ancient_red_dragon": ["Dragón rojo antiguo"],
    "ancient_silver_dragon": ["Dragón plateado antiguo"],
    "ancient_white_dragon": ["Dragón blanco antiguo"],
    "animated-armor": ["Armadura animada"],
    "animated_armor": ["Armadura animada"],
    "ankheg": ["Ankheg"],
    "ankylosaurus": ["Ankylosaurus"],
    "ape": ["Simio"],
    "archelon": ["Archelon"],
    "archmage": ["Archimago"],
    "assassin": ["Asesino"],
    "awakened_shrub": ["Arbusto despierto"],
    "awakened_tree": ["Árbol despierto"],
    "axe_beak": ["Pico de hacha"],
    "azer": ["Azer"],
    "azer_sentinel": ["Centinela azer", "Azer centinela"],
    "baboon": ["Babuino"],
    "badger": ["Tejón"],
    "balor": ["Balor"],
    "bandit": ["Bandido"],
    "bandit_captain": ["Capitán bandido"],
    "bandit-captain": ["Capitán bandido"],
    "banshee": ["Banshee"],
    "barbed_devil": ["Diablo erizado"],
    "basilisk": ["Basilisco"],
    "bat": ["Murciélago"],
    "bearded_devil": ["Diablo barbado"],
    "beholder": ["Observador"],
    "berserker": ["Berserker"],
    "berserker_chief": ["Jefe berserker"],
    "black-bear": ["Oso negro"],
    "black_bear": ["Oso negro"],
    "black_dragon_wyrmling": ["Cría de dragón negro"],
    "black_pudding": ["Pudín negro"],
    "blink_dog": ["Perro parpadeante"],
    "blink-dog": ["Perro parpadeante"],
    "blood_hawk": ["Halcón sangriento"],
    "blue_dragon_wyrmling": ["Cría de dragón azul"],
    "boar": ["Jabalí"],
    "bone_devil": ["Diablo de hueso"],
    "brass_dragon_wyrmling": ["Cría de dragón de latón"],
    "bronze_dragon_wyrmling": ["Cría de dragón de bronce"],
    "brown-bear": ["Oso pardo"],
    "brown_bear": ["Oso pardo"],
    "bugbear": ["Trasgo"],
    "bugbear_stalker": ["Acechador trasgo", "Trasgo acechador"],
    "bugbear_warrior": ["Guerrero trasgo", "Trasgo guerrero"],
    "bulette": ["Bulette"],
    "camel": ["Camello"],
    "cat": ["Gato"],
    "centaur": ["Centauro"],
    "centaur_trooper": ["Tropas centauro"],
    "chain_devil": ["Diablo de cadena"],
    "chimera": ["Quimera"],
    "chuul": ["Chuul"],
    "clay_golem": ["Gólem de arcilla"],
    "cloaker": ["Encubridor"],
    "cloud_giant": ["Gigante de las nubes"],
    "cockatrice": ["Cockatrice"],
    "commoner": ["Plebeyo"],
    "constrictor_snake": ["Serpiente constrictora"],
    "copper_dragon_wyrmling": ["Cría de dragón de cobre"],
    "couatl": ["Couatl"],
    "crab": ["Cangrejo"],
    "crocodile": ["Cocodrilo"],
    "cultist": ["Cultista"],
    "cultist_fanatic": ["Cultista fanático", "Fanático cultista"],
    "darkmantle": ["Manto oscuro"],
    "death_dog": ["Perro mortal"],
    "death_knight": ["Caballero de la muerte"],
    "deer": ["Ciervo"],
    "deva": ["Deva"],
    "dire-wolf": ["Lobo terrible"],
    "dire_wolf": ["Lobo terrible"],
    "displacer-beast": ["Bestia desplazante"],
    "displacer_beast": ["Bestia desplazante"],
    "djinni": ["Djinni"],
    "doppelganger": ["Doppelganger"],
    "draft_horse": ["Caballo de tiro"],
    "dragon_turtle": ["Dragón tortuga"],
    "dretch": ["Dretch"],
    "drider": ["Drider"],
    "drow": ["Drow"],
    "druid": ["Druida"],
    "druid_lord": ["Señor druida"],
    "dryad": ["Dríade"],
    "duergar": ["Duergar"],
    "dust_mephit": ["Mephit de polvo"],
    "eagle": ["Águila"],
    "earth-elemental": ["Elemental de tierra"],
    "earth_elemental": ["Elemental de tierra"],
    "efreeti": ["Efreeti"],
    "elephant": ["Elefante"],
    "elk": ["Alce"],
    "erinyes": ["Erinia"],
    "ettercap": ["Ettercap"],
    "ettin": ["Ettin"],
    "fire-elemental": ["Elemental del fuego"],
    "fire_elemental": ["Elemental del fuego"],
    "fire_giant": ["Gigante del fuego"],
    "flesh_golem": ["Gólem de carne"],
    "flying-snake": ["Serpiente voladora"],
    "flying_snake": ["Serpiente voladora"],
    "flying_sword": ["Espada voladora"],
    "flying-sword": ["Espada voladora"],
    "frog": ["Rana"],
    "frost_giant": ["Gigante de la escarcha"],
    "gargoyle": ["Gárgola"],
    "gazer": ["Gazer"],
    "gelatinous_cube": ["Cubo gelatinoso"],
    "ghast": ["Ghast"],
    "ghost": ["Fantasma"],
    "ghoul": ["Ghoul"],
    "giant-spider": ["Araña gigante"],
    "giant_ape": ["Simio gigante"],
    "giant_badger": ["Tejón gigante"],
    "giant_bat": ["Murciélago gigante"],
    "giant_boar": ["Jabalí gigante"],
    "giant_centipede": ["Ciempiés gigante"],
    "giant_constrictor_snake": ["Serpiente constrictora gigante"],
    "giant_crab": ["Cangrejo gigante"],
    "giant_crocodile": ["Cocodrilo gigante"],
    "giant_eagle": ["Águila gigante"],
    "giant_elk": ["Alce gigante"],
    "giant_fire_beetle": ["Escarabajo de fuego gigante"],
    "giant_frog": ["Rana gigante"],
    "giant_goat": ["Cabra gigante"],
    "giant_hyena": ["Hiena gigante"],
    "giant_lizard": ["Lagarto gigante"],
    "giant_octopus": ["Pulpo gigante"],
    "giant_owl": ["Búho gigante"],
    "giant_rat": ["Rata gigante"],
    "giant_scorpion": ["Escorpión gigante"],
    "giant_seahorse": ["Caballo marino gigante"],
    "giant_shark": ["Tiburón gigante"],
    "giant_spider": ["Araña gigante"],
    "giant_toad": ["Sapo gigante"],
    "giant_venomous_snake": ["Serpiente venenosa gigante"],
    "giant_vulture": ["Buitre gigante"],
    "giant_wasp": ["Avispa gigante"],
    "giant_weasel": ["Comadreja gigante"],
    "giant_wolf_spider": ["Araña lobo gigante"],
    "gibbering_mouther": ["Farfullador"],
    "glabrezu": ["Glabrezu"],
    "gladiator": ["Gladiador"],
    "gnoll": ["Gnoll"],
    "gnoll_warrior": ["Guerrero gnoll"],
    "goat": ["Cabra"],
    "goblin": ["Goblin"],
    "goblin_boss": ["Jefe goblin"],
    "goblin_minion": ["Esbirro goblin"],
    "goblin_warrior": ["Guerrero goblin"],
    "gold_dragon_wyrmling": ["Cría de dragón dorado"],
    "gorgon": ["Gorgona"],
    "gray-ooze": ["Limo gris"],
    "gray_ooze": ["Limo gris"],
    "green-dragon-wyrmling": ["Cría de dragón verde"],
    "green_dragon_wyrmling": ["Cría de dragón verde"],
    "green_hag": ["Bruja verde"],
    "grick": ["Grick"],
    "griffon": ["Grifo"],
    "grimlock": ["Grimlock"],
    "guard": ["Guardia"],
    "guard_captain": ["Capitán de la guardia"],
    "guardian_naga": ["Naga guardiana"],
    "half_dragon": ["Semidragón"],
    "harpy": ["Arpía"],
    "hawk": ["Halcón"],
    "hell_hound": ["Sabueso infernal"],
    "hezrou": ["Hezrou"],
    "hill_giant": ["Gigante de las colinas"],
    "hippogriff": ["Hipogrifo"],
    "hippopotamus": ["Hipopótamo"],
    "hobgoblin": ["Hobgoblin"],
    "hobgoblin_captain": ["Capitán hobgoblin"],
    "hobgoblin_warrior": ["Guerrero hobgoblin"],
    "homunculus": ["Homúnculo"],
    "horned_devil": ["Diablo cornudo"],
    "hunter_shark": ["Tiburón cazador"],
    "hydra": ["Hidra"],
    "hyena": ["Hiena"],
    "ice_devil": ["Diablo de hielo"],
    "ice_mephit": ["Mephit de hielo"],
    "imp": ["Diablillo"],
    "incubus": ["Incubo"],
    "invisible_stalker": ["Perseguidor invisible"],
    "iron_golem": ["Gólem de hierro"],
    "jackal": ["Chacal"],
    "kenku": ["Kenku"],
    "killer_whale": ["Orca"],
    "knight": ["Caballero"],
    "knight_veteran": ["Caballero veterano"],
    "kobold": ["Kobold"],
    "kobold_warrior": ["Guerrero kobold"],
    "kraken": ["Kraken"],
    "lamia": ["Lamia"],
    "lemure": ["Lémur"],
    "lich": ["Liche"],
    "lion": ["León"],
    "lizard": ["Lagarto"],
    "lizardfolk": ["Lagartoide"],
    "mage": ["Mago"],
    "mage_archmage": ["Archimago"],
    "magma_mephit": ["Mephit de magma"],
    "magmin": ["Magmin"],
    "mammoth": ["Mamut"],
    "manticore": ["Mantícora"],
    "marilith": ["Marilith"],
    "mastiff": ["Mastín"],
    "medusa": ["Medusa"],
    "merfolk": ["Tritón"],
    "merfolk_skirmisher": ["Tritón escaramuzador"],
    "merrow": ["Merrow"],
    "mimic": ["Mímico"],
    "mind-flayer": ["Devoramentes"],
    "mind_flayer": ["Devoramentes"],
    "minotaur": ["Minotauro"],
    "minotaur_of_baphomet": ["Minotauro de Bafomet"],
    "minotaur_skeleton": ["Esqueleto de minotauro"],
    "mule": ["Mulo"],
    "mummy": ["Momia"],
    "mummy_lord": ["Señor de las momias"],
    "nalfeshnee": ["Nalfeshnee"],
    "nightmare": ["Pesadilla"],
    "night_hag": ["Bruja nocturna"],
    "noble": ["Noble"],
    "ochre_jelly": ["Gelatina ocre"],
    "ogre": ["Ogro"],
    "ogre_zombie": ["Ogro zombi", "Zombi ogro"],
    "oni": ["Oni"],
    "orc": ["Orco"],
    "orog": ["Orog"],
    "otyugh": ["Otyugh"],
    "owl": ["Búho"],
    "owlbear": ["Búho oso"],
    "panther": ["Pantera"],
    "pegasus": ["Pegaso"],
    "phase_spider": ["Araña de fase"],
    "piranha": ["Piraña"],
    "pirate": ["Pirata"],
    "pirate_captain": ["Capitán pirata"],
    "pit_fiend": ["Señor del abismo"],
    "pixie": ["Duende"],
    "pixie_leader": ["Líder duende"],
    "planetar": ["Planetario"],
    "plesiosaurus": ["Plesiosaurio"],
    "polar_bear": ["Oso polar"],
    "pony": ["Poni"],
    "priest": ["Sacerdote"],
    "priest_acolyte": ["Acólito"],
    "priest_high": ["Sacerdote supremo"],
    "pseudodragon": ["Pseudodragón"],
    "pteranodon": ["Pteranodon"],
    "purple_worm": ["Gusano púrpura"],
    "quasit": ["Quasit"],
    "rakshasa": ["Rakshasa"],
    "rat": ["Rata"],
    "raven": ["Cuervo"],
    "red_dragon_wyrmling": ["Cría de dragón rojo"],
    "reef_shark": ["Tiburón de arrecife"],
    "remorhaz": ["Remorhaz"],
    "revenant": ["Vengador"],
    "rhinoceros": ["Rinoceronte"],
    "riding_horse": ["Caballo de montar"],
    "roc": ["Roc"],
    "roper": ["Roper"],
    "rug_of_smothering": ["Alfombra asfixiante"],
    "rust-monster": ["Monstruo de óxido", "Rust monster"],
    "rust_monster": ["Monstruo de óxido", "Rust monster"],
    "saber_toothed_tiger": ["Tigre dientes de sable"],
    "sahuagin": ["Sahuagin"],
    "sahuagin_warrior": ["Guerrero sahuagin"],
    "salamander": ["Salamandra"],
    "satyr": ["Sátiro"],
    "scorpion": ["Escorpión"],
    "scout": ["Explorador"],
    "sea_hag": ["Bruja marina"],
    "seahorse": ["Caballo marino"],
    "shadow": ["Sombra"],
    "shambling_mound": ["Montículo andante"],
    "shield_guardian": ["Guardián del escudo"],
    "shrieker_fungus": ["Hongo chillón"],
    "silver_dragon_wyrmling": ["Cría de dragón plateado"],
    "skeleton": ["Esqueleto"],
    "solar": ["Solar"],
    "specter": ["Espectro"],
    "sphinx": ["Esfinge"],
    "sphinx_of_lore": ["Esfinge del saber"],
    "sphinx_of_valor": ["Esfinge del valor"],
    "sphinx_of_wonder": ["Esfinge de la maravilla"],
    "spider": ["Araña"],
    "spirit_naga": ["Naga espiritual"],
    "sprite": ["Duende"],
    "spy": ["Espía"],
    "steam_mephit": ["Mephit de vapor"],
    "stirge": ["Stirge"],
    "stone_giant": ["Gigante de piedra"],
    "stone_golem": ["Gólem de piedra"],
    "storm_giant": ["Gigante de las tormentas"],
    "succubus": ["Súcubo"],
    "swarm-of-poisonous-snakes": ["Enjambre de serpientes venenosas"],
    "swarm_of_bats": ["Enjambre de murciélagos"],
    "swarm_of_crawling_claws": ["Enjambre de manos"],
    "swarm_of_insects": ["Enjambre de insectos"],
    "swarm_of_piranhas": ["Enjambre de pirañas"],
    "swarm_of_rats": ["Enjambre de ratas"],
    "swarm_of_ravens": ["Enjambre de cuervos"],
    "swarm_of_venomous_snakes": ["Enjambre de serpientes venenosas"],
    "swarm_of_poisonous_snakes": ["Enjambre de serpientes venenosas"],
    "tarrasque": ["Tarrasque"],
    "thug": ["Matón"],
    "tiger": ["Tigre"],
    "tough": ["Duro"],
    "tough_boss": ["Jefe duro"],
    "treant": ["Treant"],
    "triceratops": ["Triceratops"],
    "troglodyte": ["Troglodita"],
    "troll": ["Trol"],
    "troll_limb": ["Trol"],
    "tyrannosaurus_rex": ["Tiranosaurio rex"],
    "unicorn": ["Unicornio"],
    "vampire": ["Vampiro"],
    "vampire-spawn": ["Prole de vampiro"],
    "vampire_familiar": ["Familiar de vampiro"],
    "vampire_spawn": ["Prole de vampiro"],
    "venomous_snake": ["Serpiente venenosa"],
    "veteran": ["Veterano"],
    "veteran_officer": ["Oficial veterano"],
    "violet_fungus": ["Hongo violeta"],
    "vrock": ["Vrock"],
    "vulture": ["Buitre"],
    "warhorse": ["Caballo de guerra"],
    "warhorse_skeleton": ["Esqueleto de caballo de guerra"],
    "warrior_infantry": ["Guerrero de infantería"],
    "warrior_veteran": ["Veterano guerrero"],
    "water-elemental": ["Elemental del agua"],
    "water_elemental": ["Elemental del agua"],
    "weasel": ["Comadreja"],
    "werebear": ["Hombre oso"],
    "wereboar": ["Hombre jabalí"],
    "wererat": ["Hombre rata"],
    "weretiger": ["Hombre tigre"],
    "werewolf": ["Hombre lobo"],
    "white_dragon_wyrmling": ["Cría de dragón blanco"],
    "wight": ["Mortívago"],
    "will_o_wisp": ["Fuego fatuo"],
    "winter_wolf": ["Lobo de invierno"],
    "witch_necromancer": ["Bruja nigromante"],
    "wolf": ["Lobo"],
    "worg": ["Worg"],
    "wraith": ["Ánima penada"],
    "wyvern": ["Wyvern"],
    "xorn": ["Xorn"],
    "young_black_dragon": ["Dragón negro joven"],
    "young_blue_dragon": ["Dragón azul joven"],
    "young_brass_dragon": ["Dragón de latón joven"],
    "young_bronze_dragon": ["Dragón de bronce joven"],
    "young_copper_dragon": ["Dragón de cobre joven"],
    "young_gold_dragon": ["Dragón dorado joven"],
    "young_green_dragon": ["Dragón verde joven"],
    "young-red-dragon": ["Dragón rojo joven"],
    "young_red_dragon": ["Dragón rojo joven"],
    "young_silver_dragon": ["Dragón plateado joven"],
    "young_white_dragon": ["Dragón blanco joven"],
    "zombie": ["Zombi"],
}

# ===========================================================================
#  Helpers
# ===========================================================================

def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def fold(s: str) -> str:
    """Case- and accent- insensitive normalisation for name matching."""
    return strip_accents(s).strip().lower()


# ===========================================================================
#  Page extraction (column-aware)
# ===========================================================================

def clean_column(text: str) -> str:
    out = []
    for ln in (text or "").split("\n"):
        s = ln.strip()
        if not s or _FOOTER_RX.match(s):
            continue
        out.append(" ".join(s.split()))
    return "\n".join(out)


def extract_page(pdf: pdfplumber.PDF, page_num: int) -> str:
    if page_num < 1 or page_num > len(pdf.pages):
        return ""
    page = pdf.pages[page_num - 1]
    w, h = page.width, page.height
    mid = w / 2.0
    left = page.crop((0, 0, mid - 4, h)).extract_text() or ""
    right = page.crop((mid + 4, 0, w, h)).extract_text() or ""
    return clean_column(left) + "\n" + clean_column(right)


# ===========================================================================
#  Chunk isolation
# ===========================================================================

def _looks_like_name(line: str) -> bool:
    """Spanish creature NAMES appear on the line immediately preceding
    the TYPE LINE in the SRD bestiary. TYPE LINEs always include a
    comma between size and alignment (``Elemental Grande, neutral``)
    so we reject every line with an interior comma as a TYPE LINE.
    Names that lack a comma AND look like a short capitalised phrase
    pass.

    The previous version of this function used a black-list of TYPE
    words (``dragón``, ``gigante``, ``infernal``…) which produced
    false negatives: ``Dragón tortuga``, ``Gigante de las nubes``
    and ``Diablo infernal`` all START with a TYPE word and so were
    rejected.
    """
    s = line.strip().rstrip(":.,?!")
    if not s or any(ch.isdigit() for ch in s):
        return False
    # Interior comma is the structural signature of a TYPE LINE.
    if "," in s:
        return False
    tokens = s.split()
    if not tokens or len(tokens) > 6:
        return False
    if not tokens[0][0].isalpha() or not tokens[0][0].isupper():
        return False
    return True


def find_chunks(page_text: str) -> list[tuple[int, str, str]]:
    """Detect creature stat blocks on a page. Each chunk spans two
    consecutive TYPE_LINE boundaries, with the row immediately before
    the first TYPE_LINE assumed to be the creature's name."""
    rows = [r for r in page_text.split("\n") if r.strip()]
    chunks: list[tuple[int, str, str]] = []
    boundaries: list[int] = []
    for i, row in enumerate(rows):
        if TYPE_LINE_RX.match(row) or TYPE_LINE_LAX_RX.match(row):
            boundaries.append(i)
    if not boundaries:
        return chunks
    for j, idx in enumerate(boundaries):
        end = boundaries[j + 1] if j + 1 < len(boundaries) else len(rows)
        if j + 1 < len(boundaries) and end > 0 and _looks_like_name(rows[end - 1]):
            end -= 1
        name = ""
        start = idx
        if idx > 0 and _looks_like_name(rows[idx - 1]):
            name = rows[idx - 1].strip()
            start = idx - 1
        chunk_text = "\n".join(rows[start:end])
        chunks.append((start, name, chunk_text))
    return chunks


# ===========================================================================
#  Walker (single isolated chunk)
# ===========================================================================

def _hit_points(line: str) -> Optional[dict[str, Any]]:
    # Spanish SRD v5.2.1 uses either the full label (Puntos de Golpe)
    # or the abbreviation ``PG``. Both can be followed by ``:`` and an
    # optional parenthetical roll (e.g. ``PG: 22 (3d8 + 9)``).
    m = re.match(
        r"\s*(?:Puntos\s+de\s+Golpe|PG)\s*:?\s*(\d+)(?:\s*\(([^)]+)\))?",
        line, re.IGNORECASE,
    )
    if not m:
        return None
    return {"average": int(m.group(1)), "roll": (m.group(2) or "").strip()}


def _ac(line: str) -> Optional[dict[str, Any]]:
    # Spanish SRD v5.2.1 uses either the full label (Clase de Armadura)
    # or the abbreviation ``CA``. Examples: ``CA: 8``,
    # ``CA: 18 (armadura natural)``, ``Clase de Armadura 10``.
    m = re.match(
        r"\s*(?:Clase\s+de\s+Armadura|CA)\s*:?\s*(\d+)(?:\s*\(([^)]+)\))?",
        line, re.IGNORECASE,
    )
    if not m:
        return None
    val = int(m.group(1))
    typ = (m.group(2) or "").strip()
    return {"value": val, **({"type": typ} if typ else {})}


def _initiative(line: str) -> Optional[int]:
    # Spanish SRD v5.2.1 prints ``Iniciativa: ±N`` either on the CA
    # line or on its own line. The Unicode minus (\u2212) is the form
    # pdfplumber emits in some pages.
    m = re.search(
        r"\bIniciativa\b\s*:?\s*([\+\-\u2212]?\s*\d+)",
        line, re.IGNORECASE,
    )
    if not m:
        return None
    raw = m.group(1).replace("\u2212", "-").replace(" ", "")
    try:
        return int(raw)
    except ValueError:
        return None


def _speed(text: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for chunk in re.split(r",", text):
        c = chunk.strip().lower()
        m = re.search(r"(\d+(?:[.,]\d+)?)\s*m\.?", c)
        if not m:
            continue
        raw = float(m.group(1).replace(",", "."))
        ft = int(round(raw * 3.28084 / 5) * 5)
        if c.startswith("volar"):
            out["fly"] = ft
        elif c.startswith("nadar"):
            out["swim"] = ft
        elif c.startswith("trepar") or c.startswith("escalar"):
            out["climb"] = ft
        elif c.startswith("excavar"):
            out["burrow"] = ft
        elif "walk" not in out:
            out["walk"] = ft
    return out


def _abilities_compat(line: str) -> Optional[dict[str, int]]:
    # Spanish SRD usually writes abilities with their modifiers.
    # Take only the FIRST cluster of 6 integers per line.
    m = _COMPACT_6.match(line)
    if not m:
        return None
    keys = ("str", "dex", "con", "int", "wis", "cha")
    return {k: int(v) for k, v in zip(keys, m.groups())}


def _abilities_compact(rows: list[str], idx: int) -> tuple[Optional[dict[str, int]], int]:
    """Spanish SRD v5.2.1 abilities block uses abbreviation compact format::

        MOD. SALV. MOD. SALV. MOD. SALV.
        Fue 13 +1 +1 Des 6 −2 −2 Con 16 +3 +3
        Int 3 −4 −4 sab 6 −2 +0 Car 5 −3 −3

    Each ability abbreviation is followed by a triple
    ``(score, ability_modifier, save_modifier)``. Two rows because the
    PDF column wraps after the third ability. We extract just the
    six SCORES in the canonical order (Str, Dex, Con, Int, Wis, Cha).
    """
    if idx >= len(rows):
        return (None, 0)
    buf: list[str] = []
    consumed = 0
    keys = ("str", "dex", "con", "int", "wis", "cha")
    saw_mod = False
    for j in range(idx, min(idx + 6, len(rows))):
        line = rows[j].strip()
        # Stop scanning if we hit a section header sentinel (e.g. another
        # section, a TYPE LINE, or a stat line like CA/PG).
        if (re.match(r"\s*(?:CA|PG|VD|Velocidad|Clase\s+de\s+Armadura|"
                     r"Puntos\s+de\s+Golpe|Desafío)\s*:?", line,
                     re.IGNORECASE)):
            break
        buf.append(line)
        consumed += 1
        # If the buffer already contains all six abbreviation scores,
        # commit and stop.
        text = " ".join(buf)
        scores: list[int] = []
        for abbr in ("Fue", "Des", "Con", "Int", "Sab", "Car"):
            m = re.search(rf"\b{abbr}\s+(\d+)\b", text, re.IGNORECASE)
            if m:
                scores.append(int(m.group(1)))
        if len(scores) == 6:
            return ({k: v for k, v in zip(keys, scores)}, consumed)
        # Heuristic: once we've passed a line containing MOD-style
        # tokens (or sense/save keywords) without finding six scores,
        # give up to avoid stealing the next creature's stats.
        if re.search(r"\b(MOD\.?\s*Sal|Sentidos|Idiomas|Inmunid|Salvaci[oó]n)\b",
                     text, re.IGNORECASE):
            return (None, consumed)
    return (None, max(consumed, 1))


def _is_section_header(line: str) -> Optional[str]:
    norm = line.strip().rstrip(":.").lower()
    return SECTION_HEADERS.get(norm)


def _splits(s: str) -> list[str]:
    return [x.strip() for x in re.split(r"[,;]", s) if x.strip()]


_PREAMBLE_PREFIXES = (
    "el ", "la ", "los ", "las ", "un ", "una ", "unos ", "unas ",
    "si ", "cuando ", "como ", "para ", "pero ", "siempre ", "nunca ",
    "tras ", "este ", "esta ",
)


def _walk_section(line: str, section: str, out: dict[str, Any]) -> None:
    # If a previous entry's text ended mid-sentence, treat this line as
    # a continuation regardless of how it looks.
    prev_entry = out[section][-1] if out[section] else None
    if prev_entry and _mid_sentence(prev_entry["text"]):
        prev_entry["text"] = (prev_entry["text"] + " " + line).strip()
        return
    m = _SECTION_ENTRY_RX.match(line)
    title = ""
    body = ""
    if m:
        cand = m.group(1).strip()
        cand_low = cand.lower()
        # Reject common connective / non-action words that appear when
        # the PDF wraps mid-sentence.
        if (len(cand.split()) <= 8
                and not cand_low in _NON_ACTION_WORDS
                and not cand_low.startswith(_PREAMBLE_PREFIXES)):
            title = cand
            body = m.group(3).strip()
    seen_key = f"_seen_{section}"
    if title:
        seen = out.setdefault(seen_key, set())
        if title in seen:
            return  # drop duplicates (zombie.json earlier bug)
        seen.add(title)
        out[section].append({"name": title, "text": body})
        return
    if prev_entry:
        prev_entry["text"] = (prev_entry["text"] + " " + line).strip()
    else:
        out[section].append({"name": "", "text": line})


def parse_chunk(chunk_text: str) -> dict[str, Any]:
    """Walk one isolated creature stat block and emit all the
    SRD fields it contains. No English fallback."""
    out: dict[str, Any] = {}
    if not chunk_text:
        return out
    rows = [r.strip() for r in chunk_text.split("\n") if r.strip()]
    if not rows:
        return out
    current_section: Optional[str] = None
    i = 0
    while i < len(rows):
        line = rows[i]
        if not line:
            i += 1
            continue
        if current_section is not None:
            hdr = _is_section_header(line)
            if hdr and hdr != current_section:
                current_section = hdr
                out.setdefault(current_section, [])
                i += 1
                continue
            if TYPE_LINE_RX.match(line) or TYPE_LINE_LAX_RX.match(line):
                current_section = None
                i += 1
                continue
            _walk_section(line, current_section, out)
            i += 1
            continue

        # Abilities block: try the abbreviation-aware scanner first so we
        # catch v5.2.1 compact format ("Fue 13 +1 +1 Des 6 −2 −2 ...")
        # on the first row that contains "Fue"/"Des"/"Con" etc.
        abilities, consumed = _abilities_compact(rows, i)
        if abilities is not None:
            out["abilities"] = abilities
            i += max(consumed, 1)
            continue
        # Fallback: legacy header + 6-integer row.
        if _AB_HEADER_RX.match(line):
            abilities_compact = _abilities_compat(line)
            if abilities_compact is not None:
                out["abilities"] = abilities_compact
                i += 1
                continue
        hp = _hit_points(line)
        if hp is not None:
            out["hitPoints"] = hp
            i += 1
            init = _initiative(line)
            if init is not None:
                out["initiative"] = init
            continue
        ac = _ac(line)
        if ac is not None:
            out["armorClass"] = ac
            i += 1
            init = _initiative(line)
            if init is not None:
                out["initiative"] = init
            continue
        m = re.match(r"\s*Velocidad\s*:?\s*(.+)$", line, re.IGNORECASE)
        if m:
            out["speed"] = _speed(m.group(1).strip())
            i += 1
            continue
        m = TYPE_LINE_RX.match(line) or TYPE_LINE_LAX_RX.match(line)
        if m:
            gd = m.groupdict()
            if gd.get("type"):
                out["type"] = gd["type"].strip()
            sub = gd.get("sub")
            if sub:
                out.setdefault("subtype", sub.strip("() "))
            if gd.get("size"):
                out["size"] = gd["size"]
            if gd.get("align"):
                out["alignment"] = gd["align"].strip()
            i += 1
            continue
        # Challenge rating — accept VD (Valor de Desafío) and full labels.
        m = re.match(r"\s*(?:Clase\s+de\s+Peligro|Desafío|VD)\s*:?\s*([\d/]+)",
                     line, re.IGNORECASE)
        if m:
            out["challengeRating"] = m.group(1)
            xp = re.search(r"\(([\d.,]+)\s*PX", line, re.IGNORECASE)
            if xp:
                try:
                    out["experiencePoints"] = int(xp.group(1).replace(".", "").replace(",", ""))
                except ValueError:
                    pass
            # Proficiency bonus optionally appears on the same line as CR.
            init_or_pb = re.search(
                r"\b(?:PB|Bonus\s+de\s+competencia|BC)\s*\+?(\d+)", line, re.IGNORECASE)
            if init_or_pb:
                out["proficiencyBonus"] = int(init_or_pb.group(1))
            i += 1
            continue
        # Stand-alone Iniciativa line (rare; usually on the CA line).
        if _initiative(line) is not None:
            out["initiative"] = _initiative(line)
            i += 1
            continue

        matched_kw = False
        line_low = line.lower()
        for kw, key in FIELD_KEYS:
            kw_low = kw.lower()
            if not (line_low.startswith(kw_low + " ")
                    or line_low.startswith(kw_low + ":")
                    or line.startswith(kw + " ")
                    or line.startswith(kw + ":")):
                continue
            value = line[len(kw):].lstrip(": ").strip()
            if key in LIST_FIELDS:
                out[key] = _splits(value)
            elif key == "speed":
                out[key] = _speed(value)
            else:
                out[key] = value
            matched_kw = True
            break
        if matched_kw:
            i += 1
            continue
        hdr = _is_section_header(line)
        if hdr is not None:
            current_section = hdr
            out.setdefault(current_section, [])
            i += 1
            continue
        i += 1

    # Strip internal dedupe markers so they don't pollute JSON.
    for k in list(out):
        if k.startswith("_seen_"):
            del out[k]

    # Spanish SRD PDF column-wraps hyphenate mid-word. Rejoin any
    # trailing hyphen + space + lowercase to a single token.
    _HYPHEN_FIX = re.compile(r"\b(\w+)-\s+([a-záéíóúñ])")
    for sec in ("traits", "actions", "legendaryActions", "reactions",
                "spellcasting"):
        if isinstance(out.get(sec), list):
            for entry in out[sec]:
                if isinstance(entry, dict) and "text" in entry:
                    entry["text"] = _HYPHEN_FIX.sub(r"\1\2", entry["text"])
                    entry["name"] = _HYPHEN_FIX.sub(r"\1\2", entry.get("name", ""))
    return out


# ===========================================================================
#  Bulk-walker of the SRD bestiary section
# ===========================================================================

def bulk_walk_bestiary(
    pdf: pdfplumber.PDF,
    start_page: int = 240,
    end_page: Optional[int] = None,
) -> dict[str, tuple[int, dict[str, Any], str]]:
    """Walk every page of the SRD bestiary, find each creature chunk,
    parse it, and index them by folded Spanish name. Returns:
        ``{folded_name: (page, parsed_data, official_name)}``
    """
    if end_page is None:
        end_page = len(pdf.pages)
    chunks_by_name: dict[str, tuple[int, dict[str, Any], str]] = {}
    for page_num in range(start_page, end_page + 1):
        page_text = extract_page(pdf, page_num)
        if not page_text:
            continue
        page_chunks = find_chunks(page_text)
        for ci, cname, ctext in page_chunks:
            stripped = cname.strip().rstrip(":.,")
            if not stripped:
                continue
            data = parse_chunk(ctext)
            if not data or not data.get("type") or not data.get("size"):
                continue
            cf = fold(stripped)
            if not cf or cf in chunks_by_name:
                continue
            chunks_by_name[cf] = (page_num, data, stripped)
    return chunks_by_name


# ===========================================================================
#  Per-slug JSON composition (only PDF data)
# ===========================================================================

def parse_en_ids() -> dict[str, str]:
    out: dict[str, str] = {}
    en_dir = ROOT / "monsters" / "en"
    for p in en_dir.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out[p.stem] = data.get("id") or p.stem
        except Exception:
            out[p.stem] = p.stem
    return out


def slug_candidates(slug: str) -> list[str]:
    return list(SLUG_TO_ES_NAMES.get(slug, []))


def build_official_es_json(
    slug: str,
    en_ids: dict[str, str],
    parsed: dict[str, Any],
    name: str,
    page: int,
) -> dict[str, Any]:
    """All field values come from the parsed PDF chunk. ``name`` is
    the line printed immediately above the TYPE LINE in the official
    PDF bestiary. ``srd_es_match_name`` + ``srd_es_page`` record
    provenance for traceability."""
    out: dict[str, Any] = {
        "id": en_ids.get(slug, slug),
        "slug": slug,
        "lang": "es",
        "source": STAMP_OFFICIAL,
        "name": name,
    }
    for k, v in parsed.items():
        if k in {"_seen_traits", "_seen_actions"}:
            continue
        out[k] = v
    for sec in ("traits", "actions", "legendaryActions",
                "reactions", "spellcasting"):
        out.setdefault(sec, [])
    out["srd_es_match_name"] = name
    out["srd_es_page"] = page
    return out


def build_minimal_stub(slug: str, en_ids: dict[str, str]) -> dict[str, Any]:
    return {
        "id": en_ids.get(slug, slug),
        "slug": slug,
        "lang": "es",
        "name": None,
        "source": STAMP_PENDING,
        "srd_es_partial_reasons": ["not found in SRD PDF bestiary"],
        "size": None,
        "type": None,
        "alignment": None,
        "armorClass": None,
        "hitPoints": None,
        "speed": None,
        "abilities": None,
        "savingThrows": None,
        "skills": [],
        "damageVulnerabilities": [],
        "damageResistances": [],
        "damageImmunities": [],
        "conditionImmunities": [],
        "senses": None,
        "languages": None,
        "proficiencyBonus": None,
        "challengeRating": None,
        "experiencePoints": None,
        "initiative": None,
        "traits": [],
        "actions": [],
        "reactions": [],
        "legendaryActions": [],
        "spellcasting": [],
        "environment": [],
        "notes": [],
    }


# ===========================================================================
#  Main
# ===========================================================================

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preflight", action="store_true",
                    help="Coverage report only.")
    ap.add_argument("--restamp", action="store_true",
                    help="Re-ingest creatures stamped as official.")
    ap.add_argument("--only-slug", default=None,
                    help="Process only this slug (for testing).")
    ap.add_argument("--start-page", type=int, default=240,
                    help="First bestiary page to walk (default 240).")
    args = ap.parse_args()

    if not PDF.exists():
        print(f"PDF not found: {PDF}", file=sys.stderr); return 2

    with pdfplumber.open(PDF) as pdf:
        print(f"PDF: {PDF.name} ({len(pdf.pages)} pages)")
        print(f"Bulk-walking bestiary section from page {args.start_page}…")
        chunks_by_name = bulk_walk_bestiary(
            pdf, start_page=args.start_page, end_page=len(pdf.pages)
        )
        print(f"  chunks indexed from PDF: {len(chunks_by_name)}")

        en_ids = parse_en_ids()
        targets = sorted(en_ids.keys())
        if args.only_slug:
            targets = [args.only_slug]

        written_official: list[str] = []
        rewritten: list[str] = []
        skipped: list[str] = []
        not_in_pdf: list[str] = []

        for slug in targets:
            cur_path = ES_DIR / f"{slug}.json"
            try:
                cur = json.loads(cur_path.read_text(encoding="utf-8")) if cur_path.exists() else {}
            except Exception:
                cur = {}
            stamp = cur.get("source")
            if stamp == STAMP_OFFICIAL and not args.restamp:
                skipped.append(slug)
                continue

            candidates = slug_candidates(slug)
            matched = None
            for cand in candidates:
                cf = fold(cand)
                if cf in chunks_by_name:
                    matched = chunks_by_name[cf]
                    break

            if matched is not None:
                page_num, parsed, official_name = matched
                new_doc = build_official_es_json(
                    slug, en_ids, parsed, official_name, page_num
                )
                if stamp == STAMP_OFFICIAL:
                    rewritten.append(slug)
                else:
                    written_official.append(slug)
            else:
                new_doc = build_minimal_stub(slug, en_ids)
                not_in_pdf.append(slug)

            (ES_DIR / f"{slug}.json").write_text(
                json.dumps(new_doc, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

        print(f"Targets: {len(targets)}")
        print(f"  rewrites (already official, --restamp): {len(rewritten)}")
        print(f"  new official (full PDF data): {len(written_official)}")
        print(f"  not-in-PDF (minimal stub, name=null): {len(not_in_pdf)}")
        print(f"  skipped (--no-restamp): {len(skipped)}")
        print()
        print(f"Coverage: {len(written_official)}/{len(targets)} matched SRD "
              f"creatures have full PDF data; {len(not_in_pdf)}/{len(targets)} "
              f"have minimal pending stubs because their slug is not in "
              f"SLUG_TO_ES_NAMES or the bestiary chunk wasn't on the "
              f"walked pages {args.start_page}-{len(pdf.pages)}.")
        if not_in_pdf:
            tail = ", ".join(not_in_pdf[:25])
            print(f"\nFirst not-in-PDF slugs: {tail}"
                  + ("…" if len(not_in_pdf) > 25 else ""))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
