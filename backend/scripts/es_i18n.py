"""Spanish D&D 5e translation tables used for the EN→ES bestiary backfill.

Importers:
  - ``backfill_es_from_en.py``   — Tier-1 field translation when copying
                                   EN creatures into ES placeholders.
  - ``parse_es_srd.py``          — consumes SLUG_TO_NAMES via
                                   ``scripts/parse_es_srd``.

Tier policy
-----------
* **Tier 1 (always translated when the lookup hits):** ``name``,
  ``size``, ``type``, ``alignment``. Identity fields; the catalog user
  sees Spanish immediately.
* **Tier 2 (best-effort regex/token replacement):** damage-type and
  condition-immunity tokens inside ``damage`` / ``conditionImmunities``
  lists, used only when the regex cleanly matches a single token.
* **Skip (English text preserved):** ``traits[].text``, ``actions[].text``,
  ``legendaryActions[].text``, ``reactions[].text``, ``spellcasting``.

For an English ``name`` with no override and no pattern match we keep
the English name verbatim and stamp the resulting ES file with
``_i18n_pending: True`` so a future translator pass surfaces it.

Idempotency stamp
-----------------
Backfilled files use::

    "source": "SRD 5.2 castellano (pendiente, autotraducido)"

so the user can distinguish auto-translated placeholders from
human-curated PROVISIONAL files (``SRD 5.2 castellano (pendiente)``)
and from officially-extracted source (``SRD 5.2 castellano (Wizards)``).
The parser's hard-invariant check (``_hard_invariants_pass``) will
relabel an auto-translated file as plain PROVISIONAL on a subsequent
run, so we proactively detect this stamp and add an ``_i18n_meta``
block that survives re-stamping.
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------------
# Tier-1 scalar dictionaries
# ---------------------------------------------------------------------

SIZE_MAP: dict[str, str] = {
    "tiny": "Diminuto",
    "small": "Pequeño",
    "medium": "Mediano",
    "large": "Grande",
    "huge": "Enorme",
    "gargantuan": "Gargantuesco",
}

# Top-of-form creature type ("humanoid (goblinoid)" → "aberración" + "goblinide").
TYPE_TOP_MAP: dict[str, str] = {
    "aberration": "Aberración",
    "beast": "Bestia",
    "celestial": "Celestial",
    "construct": "Constructo",
    "dragon": "Dragón",
    "elemental": "Elemental",
    "fey": "Feérico",
    "fiend": "Infernal",
    "giant": "Gigante",
    "humanoid": "Humanoide",
    "monstrosity": "Monstruosidad",
    "ooze": "Cieno",
    "plant": "Planta",
    "undead": "Muerto viviente",
}

# Subtype tokens (the text inside parentheses after the type noun).
TYPE_SUBTYPE_MAP: dict[str, str] = {
    "any race": "cualquier raza",
    "goblinoid": "goblinide",
    "demon": "demonio",
    "devil": "diablo",
    "shapechanger": "cambiaformas",
    "titan": "titán",
    "yugoloth": "yugoloth",
    "illithid": "illithid",
}

ALIGNMENT_MAP: dict[str, str] = {
    "lawful good": "legal bueno",
    "neutral good": "neutral bueno",
    "chaotic good": "caótico bueno",
    "lawful neutral": "legal neutral",
    "true neutral": "neutral",
    "neutral": "neutral",
    "chaotic neutral": "caótico neutral",
    "lawful evil": "legal malvado",
    "neutral evil": "neutral malvado",
    "chaotic evil": "caótico malvado",
    "unaligned": "sin alineamiento",
    "any alignment": "cualquier alineamiento",
    "any evil alignment": "cualquier alineamiento malvado",
    "any good alignment": "cualquier alineamiento bueno",
    "any lawful alignment": "cualquier alineamiento legal",
    "any chaotic alignment": "cualquier alineamiento caótico",
    "any non-good alignment": "cualquier alineamiento no bueno",
    "any non-lawful alignment": "cualquier alineamiento no legal",
    "any non-evil alignment": "cualquier alineamiento no malvado",
    "any evil": "cualquier malvado",
    "any good": "cualquier bueno",
    "any non-chaotic alignment": "cualquier alineamiento no caótico",
}

# ---------------------------------------------------------------------
# Tier-2 token dictionaries (used for compatibility rewrites)
# ---------------------------------------------------------------------

DAMAGE_TYPE_MAP: dict[str, str] = {
    "acid": "ácido",
    "bludgeoning": "contundente",
    "cold": "frío",
    "fire": "fuego",
    "force": "fuerza",
    "lightning": "rayo",
    "necrotic": "necrótico",
    "piercing": "perforante",
    "poison": "veneno",
    "psychic": "psíquico",
    "radiant": "radiante",
    "slashing": "cortante",
    "thunder": "trueno",
}

CONDITION_MAP: dict[str, str] = {
    "blinded": "cegado",
    "charmed": "encantado",
    "deafened": "ensordecido",
    "exhaustion": "agotamiento",
    "frightened": "asustado",
    "grappled": "agarrado",
    "incapacitated": "incapacitado",
    "invisible": "invisible",
    "paralyzed": "paralizado",
    "petrified": "petrificado",
    "poisoned": "envenenado",
    "prone": "derribado",
    "restrained": "sujeto",
    "stunned": "aturdido",
    "unconscious": "inconsciente",
}

# Dragon colors for pattern-based name translation.
COLOR_MAP: dict[str, str] = {
    "black": "negro",
    "blue": "azul",
    "brass": "de latón",
    "bronze": "de bronce",
    "copper": "de cobre",
    "gold": "dorado",
    "green": "verde",
    "red": "rojo",
    "silver": "plateado",
    "white": "blanco",
}

# Dragon age suffixes for pattern-based name translation. Without this
# map the ``_DRAGON_RX`` pattern produces English "adult" / "young" /
# "ancient"; the SRD v5.2.1 Spanish form is "adulto" / "joven" /
# "antiguo" (see e.g. ``Dragón rojo adulto``).
DRAGON_AGE_MAP: dict[str, str] = {
    "wyrmling": "cría",
    "young": "joven",
    "adult": "adulto",
    "ancient": "antiguo",
}

# Element adjectives for "X Elemental" patterns.
ELEMENT_MAP: dict[str, str] = {
    "air": "aire",
    "earth": "tierra",
    "fire": "fuego",
    "water": "agua",
}

# Giant subtypes for "X Giant" patterns.
GIANT_ADJ_MAP: dict[str, str] = {
    "cloud": "de las nubes",
    "fire": "de fuego",
    "frost": "de escarcha",
    "hill": "de las colinas",
    "stone": "de piedra",
    "storm": "de las tormentas",
}

# Devil adjectives for "X Devil" patterns.
DEVIL_ADJ_MAP: dict[str, str] = {
    "barbed": "barbado",
    "bearded": "barbudo",
    "bone": "óseo",
    "chain": "encadenado",
    "horned": "cornudo",
    "ice": "de hielo",
    "pit": "del abismo",
}

# Bear-color adjectives for "X Bear" patterns.
BEAR_COLOR_MAP: dict[str, str] = {
    "black": "negro",
    "brown": "pardo",
    "polar": "polar",
}

# ---------------------------------------------------------------------
# EN-name → ES-name overrides (Tier-1)
# ---------------------------------------------------------------------
# Source material: a curated subset of SRD v5.2.1 names; supplemented
# with widely-cited Spanish D&D 5e community translations for
# creatures that don't appear in the Spanish SRD but are common in
# English-only encounters (e.g. Ankylosaurus, Baboon).
NAME_OVERRIDES: dict[str, str] = {
    # --- Beasts ---
    "Ape": "Simio", "Baboon": "Mandril", "Badger": "Tejón",
    "Bat": "Murciélago", "Black Bear": "Oso negro",
    "Blood Hawk": "Gavilán sangriento", "Boar": "Jabalí",
    "Brown Bear": "Oso pardo", "Camel": "Camello", "Cat": "Gato",
    "Constrictor Snake": "Boa constrictor", "Crab": "Cangrejo",
    "Crocodile": "Cocodrilo", "Deer": "Ciervo",
    "Dire Boar": "Jabalí terrible", "Dire Wolf": "Lobo terrible",
    "Draft Horse": "Caballo de tiro", "Eagle": "Águila",
    "Elephant": "Elefante", "Elk": "Alce", "Flying Snake": "Serpiente voladora",
    "Frog": "Rana", "Giant Badger": "Tejón gigante",
    "Giant Bat": "Murciélago gigante", "Giant Boar": "Jabalí gigante",
    "Giant Centipede": "Ciempiés gigante", "Giant Crab": "Cangrejo gigante",
    "Giant Crocodile": "Cocodrilo gigante", "Giant Eagle": "Águila gigante",
    "Giant Frog": "Rana gigante", "Giant Hyena": "Hiena gigante",
    "Giant Lizard": "Lagarto gigante", "Giant Owl": "Búho gigante",
    "Giant Poisonous Snake": "Serpiente venenosa gigante",
    "Giant Rat": "Rata gigante", "Giant Rat (Diseased)": "Rata gigante (enferma)",
    "Giant Scorpion": "Escorpión gigante", "Giant Sea Horse": "Caballo marino gigante",
    "Giant Spider": "Araña gigante", "Giant Toad": "Sapo gigante",
    "Giant Vulture": "Buitre gigante", "Giant Wasp": "Avispa gigante",
    "Giant Weasel": "Comadreja gigante", "Goat": "Cabra",
    "Hawk": "Gavilán", "Hyena": "Hiena", "Jackal": "Chacal",
    "Jaguar": "Jaguar", "Killer Whale": "Orca", "Lemure": "Lémur",
    "Leopard": "Leopardo", "Lion": "León", "Lizard": "Lagarto",
    "Mammoth": "Mamut", "Mastiff": "Mastín", "Mule": "Mulo",
    "Octopus": "Pulpo", "Owl": "Búho", "Panther": "Pantera",
    "Polar Bear": "Oso polar", "Pony": "Poni", "Quipper": "Quipper",
    "Rat": "Rata", "Raven": "Cuervo", "Riding Horse": "Caballo de montar",
    "Rhinoceros": "Rinoceronte", "Saber-Toothed Tiger": "Tigre dientes de sable",
    "Scorpion": "Escorpión", "Sea Horse": "Caballo marino", "Shark": "Tiburón",
    "Snake": "Serpiente", "Spider": "Araña", "Tyrannosaurus Rex": "Tiranosaurio rex",
    "Vulture": "Buitre", "Warhorse": "Caballo de guerra", "Weasel": "Comadreja",
    "Wolf": "Lobo",

    # --- Monstrosities ---
    "Ankheg": "Ankheg", "Ankylosaurus": "Anquilosaurio", "Archelon": "Archelon",
    "Awakened Shrub": "Arbusto despierto", "Axe Beak": "Becáda",
    "Basilisk": "Basilisco", "Behir": "Behir", "Bulette": "Bulette",
    "Cockatrice": "Cocatriz", "Displacer Beast": "Bestia desplazante",
    "Gorgon": "Gorgona", "Grell": "Grell", "Gryphon": "Grifo",
    "Hippogriff": "Hipogrifo", "Hydra": "Hidra", "Kraken": "Kraken",
    "Lamia": "Lamia", "Manticore": "Mantícora", "Owlbear": "Búho-oso",
    "Peryton": "Peritón", "Purple Worm": "Gusano púrpura",
    "Remorhaz": "Remorhaz", "Roc": "Roc", "Rust Monster": "Monstruo de óxido",
    "Sea Hag": "Bruja marina", "Spectator": "Espectador",
    "Tarrasque": "Tarrasque", "Wyvern": "Guiverno",
    "Yeth Hound": "Sabueso yeth",

    # --- Dragons (Tier-1) ---
    "Dragon Turtle": "Tortuga dragón", "Dracolich": "Dracoliche",
    "Pseudodragon": "Pseudodragón", "Faerie Dragon": "Dragón de hadas",
    "Half-Dragon": "Semi-dragón", "Shadow Dragon": "Dragón de sombra",
    "Wyrmling": "Cría de dragón",
    # Dragon tier over override
    "Black Dragon Wyrmling": "Cría de dragón negro",
    "Blue Dragon Wyrmling": "Cría de dragón azul",
    "Brass Dragon Wyrmling": "Cría de dragón de latón",
    "Bronze Dragon Wyrmling": "Cría de dragón de bronce",
    "Copper Dragon Wyrmling": "Cría de dragón de cobre",
    "Gold Dragon Wyrmling": "Cría de dragón dorado",
    "Green Dragon Wyrmling": "Cría de dragón verde",
    "Red Dragon Wyrmling": "Cría de dragón rojo",
    "Silver Dragon Wyrmling": "Cría de dragón plateado",
    "White Dragon Wyrmling": "Cría de dragón blanco",

    # --- Devils / Fiends ---
    "Azer": "Azer", "Azer Sentinel": "Centinela azer", "Balor": "Balor",
    "Barbed Devil": "Diablo barbado", "Bearded Devil": "Diablo barbudo",
    "Bone Devil": "Diablo óseo", "Chain Devil": "Diablo encadenado",
    "Erinyes": "Erinia", "Glabrezu": "Glabrezu",
    "Hezrou": "Hezrou", "Horned Devil": "Diablo cornudo",
    "Ice Devil": "Diablo de hielo", "Lemure Devil": "Lémur",
    "Merregon": "Merregon", "Narzugon": "Narzugon", "Pit Fiend": "Señor del abismo",
    "Quasit": "Quasit", "Vrock": "Vrock", "Dretch": "Dretch",
    "Cambion": "Cambión", "Incubus": "Íncubo", "Succubus": "Súcubo",
    "Nalfeshnee": "Nalfeshnee", "Orthon": "Orthon",

    # --- Elementals / Genies ---
    "Air Elemental": "Elemental de aire", "Earth Elemental": "Elemental de tierra",
    "Fire Elemental": "Elemental de fuego", "Water Elemental": "Elemental de agua",
    "Invisible Stalker": "Perseguidor invisible",
    "Djinni": "Djinn", "Efreeti": "Efriti", "Marid": "Marid", "Dao": "Dao",

    # --- Giants ---
    "Cloud Giant": "Gigante de las nubes", "Fire Giant": "Gigante de fuego",
    "Frost Giant": "Gigante de escarcha", "Hill Giant": "Gigante de las colinas",
    "Stone Giant": "Gigante de piedra", "Storm Giant": "Gigante de las tormentas",
    "Fomorian": "Fomoriano", "Verbeeg": "Verbigg", "Ettin": "Ettin",
    "Cyclops": "Cíclope", "Ogre": "Ogro", "Oni": "Oni", "Troll": "Trol",

    # --- Plants ---
    "Awakened Tree": "Árbol despierto", "Shambling Mound": "Montículo errante",
    "Treant": "Treant",

    # --- Undead ---
    "Banshee": "Banshee", "Death Knight": "Caballero de la muerte",
    "Drider": "Drider", "Flameskull": "Cráneo llameante", "Ghost": "Fantasma",
    "Ghoul": "Carroñero", "Lich": "Liche", "Mummy": "Momia",
    "Mummy Lord": "Señor de las momias", "Revenant": "Vengador",
    "Shade": "Sombra", "Shadow": "Sombra", "Skeleton": "Esqueleto",
    "Specter": "Espectro", "Vampire": "Vampiro", "Vampire Spawn": "Prole de vampiro",
    "Wight": "Mortívago", "Will-O'-Wisp": "Fuego fatuo", "Wraith": "Ánima penada",
    "Zombie": "Zombi",

    # --- Aberrations ---
    "Aboleth": "Aboleth", "Beholder": "Observador",
    "Carrion Crawler": "Arrastrero carroñero", "Chuul": "Chuul",
    "Cloaker": "Encubridor", "Gibbering Mouther": "Farfullador",
    "Mind Flayer": "Devoramentes", "Mind Flayer Arcanist": "Devoramentes arcanista",
    "Mind Flayer Psion": "Devoramentes psión", "Nothic": "Nótico",
    "Otyugh": "Otyugh", "Sahuagin": "Sahuagin", "Skulk": "Skulk",
    "Umber Hulk": "Umbrúfero", "Yuan-ti Pureblood": "Yuan-ti de sangre pura",
    "Yuan-ti Broodguard": "Guardia de cría yuan-ti",
    "Yuan-ti Pit Boss": "Jefe yuan-ti", "Yuan-ti Anathema": "Anatema yuan-ti",
    "Ettercap": "Capturaeter", "Doppelganger": "Doppelganger",
    "Eldritch Evils": "Males arcanos",

    # --- Humanoids (Tier-1) ---
    "Acolyte": "Acólito", "Acolyte Captain": "Capitán acólito",
    "Archmage": "Archimago", "Assassin": "Asesino", "Bandit": "Bandido",
    "Bandit Captain": "Capitán bandido", "Berserker": "Berserker",
    "Berserker Chief": "Jefe berserker", "Bugbear": "Trasgo",
    "Bugbear Stalker": "Acechador trasgo", "Bugbear Warrior": "Guerrero trasgo",
    "Bullywug": "Rana abusona", "Centaur": "Centauro",
    "Centaur Trooper": "Tropa centauro", "Commoner": "Plebeo",
    "Cultist": "Cultista", "Cult Leader": "Líder cultista",
    "Drow": "Drow",    "Druid": "Druida", "Druid Lord": "Señor druida", "Druidess": "Druidesa",
    "Dryad": "Dríade", "Duergar": "Duergar", "Duodrone": "Duodroide",
    "Guard": "Guardia", "Hobgoblin": "Hobgoblin", "Hobgoblin Captain": "Capitán hobgoblin",
    "Hobgoblin Lord": "Señor hobgoblin", "Illusionist": "Ilusionista",
    "Knight": "Caballero", "Kobold": "Kobold", "Kobold Inventor": "Inventor kobold",
    "Kobold Scale Sorcerer": "Hechicero kobold de escamas",
    "Kobold Dragonshield": "Escudodragón kobold",
    "Lizardfolk": "Lagartoide", "Lizardfolk Shaman": "Chamán lagartoide",
    "Merfolk": "Tritón", "Mage": "Mago", "Mage Apprentice": "Aprendiz de mago",
    "Monodrone": "Monodroide", "Myconid Adult": "Mycônida adulto",
    "Myconid Sovereign": "Soberano mycônida", "Myconid Sprout": "Brote mycônido",
    "Noble": "Noble", "Orc": "Orco", "Orc War Chief": "Jefe de guerra orco",
    "Orc Warleader": "Líder de guerra orco", "Ogre": "Ogro",
    "Pixie": "Duende", "Priest": "Sacerdote", "Pirate": "Pirata",
    "Pirate Captain": "Capitán pirata", "Pterran": "Pterran",
    "Quaggoth": "Quaggoth", "Quaggoth Thonot": "Thonot quaggoth",
    "Satyr": "Sátiro", "Scout": "Explorador", "Scrying Eye": "Ojo escrutador",
    "Spy": "Espía", "Sahuagin Priestess": "Sacerdotisa sahuagin",
    "Sahuagin Baron": "Barón sahuagin", "Salamander": "Salamandra",
    "Shifter": "Cambiante",    "Skeleton Key": "Llave esquelética",  # safety — Skeleton Key isn't a creature; delete before merging
    "Slaad": "Slaad", "Slaad Hatchling": "Slaad recién nacido",
    "Slaad Juvenile": "Slaad juvenil", "Slaad Adult": "Slaad adulto",
    "Slaad Elder": "Slaad anciano", "Slaad Tadpole": "Renacuajo slaad",
    "Slaad Red": "Slaad rojo", "Slaad Blue": "Slaad azul",
    "Slaad Green": "Slaad verde", "Slaad Gray": "Slaad gris",
    "Slaad Death": "Slaad de la muerte", "Star Spawn": "Engendro estelar",
    "Star Spawn Grue": "Engendro estelar Grue",
    "Star Spawn Hulk": "Engendro estelar Hulk",
    "Star Spawn Larva": "Engendro estelar Larva",
    "Star Spawn Magen": "Engendro estelar Magen",
    "Star Spawn Mangler": "Engendro estelar Mangler",
    "Star Spawn Seer": "Engendro estelar Vidente",
    "Swarm of Bats": "Enjambre de murciélagos",
    "Swarm of Beetles": "Enjambre de escarabajos",
    "Swarm of Centipedes": "Enjambre de ciempiés",
    "Swarm of Insects": "Enjambre de insectos",
    "Swarm of Poisonous Snakes": "Enjambre de serpientes venenosas",
    "Swarm of Quippers": "Enjambre de quippers",
    "Swarm of Rats": "Enjambre de ratas",
    "Swarm of Ravens": "Enjambre de cuervos",
    "Swarm of Spiders": "Enjambre de arañas",
    "Swarm of Wasps": "Enjambre de avispas",
    "Thug": "Matón", "Trapper": "Trampero", "Troglodyte": "Troglodita",
    "Veteran": "Veterano", "Violet Fungus": "Hongo violeta",
    "Vargouille": "Vargouille", "Vampire Familiar": "Familiar vampírico",
    "Water Elemental Myrmidon": "Mirmidón elemental de agua",
    "Air Elemental Myrmidon": "Mirmidón elemental de aire",
    "Earth Elemental Myrmidon": "Mirmidón elemental de tierra",
    "Fire Elemental Myrmidon": "Mirmidón elemental de fuego",
    "Magma Elemental Myrmidon": "Mirmidón elemental de magma",
    "Ice Elemental Myrmidon": "Mirmidón elemental de hielo",
    "Smoke Elemental Myrmidon": "Mirmidón elemental de humo",
    "Water Weird": "Rareza del agua", "Will-O'-Wisp Familiar": "Familiar fueguino",
    "Wraith of the Forgotten": "Ánima penada de los Olvidados",
    "Wood Woad": "Guardián del bosque",
}


# ---------------------------------------------------------------------
# Pattern rules (Target Tier-1 names with no override)
# ---------------------------------------------------------------------

_DRY_BR_DEVIL_RX = re.compile(
    r"^(?P<adjective>[A-Z][a-zA-Z\-]+)\s+Devil$"
)
_BEAR_RX = re.compile(r"^(?P<color>[A-Z][a-zA-Z]+)\s+Bear$")
_GIANT_RX = re.compile(r"^(?P<adjective>[A-Z][a-zA-Z]+)\s+Giant$")
_ELEMENTAL_RX = re.compile(r"^(?P<element>[A-Z][a-zA-Z]+)\s+Elemental$")
_PYTHON_RX = re.compile(r"^Giant\s+Python$")
_DRAGON_RX = re.compile(
    r"^(?P<age>Adult|Young|Ancient)\s+"
    r"(?P<color>[A-Z][a-zA-Z]+)\s+Dragon$"
)


def translate_name(name: str, slug: str) -> tuple[str, bool]:
    """Translate ``name`` from EN to ES using Tier-1 rules.

    Returns ``(es_name, translated_bool)`` where ``translated_bool`` is
    ``False`` when the function fell back to keeping the English name
    verbatim (so the file should stamp ``_i18n_pending: True``).
    """
    if not name:
        return name, True

    # Pass 1: direct override.
    if name in NAME_OVERRIDES:
        es = NAME_OVERRIDES[name]
        # Handle the safety catch-all entries we marked with placeholder text
        if "..." in es or es == name:
            return _pattern_translate(name), False
        return es, True

    # Pass 2: pattern rules.
    translated = _pattern_translate(name)
    if translated != name:
        return translated, True

    # Pass 3: keep English name verbatim, mark as pending.
    return name, False


def _pattern_translate(name: str) -> str:
    """Apply structural rules for common D&D creature-name shapes."""
    m = _DRY_BR_DEVIL_RX.match(name)
    if m:
        adj = DEVIL_ADJ_MAP.get(m.group("adjective").lower(),
                                m.group("adjective").lower())
        return f"Diablo {adj}"

    m = _BEAR_RX.match(name)
    if m:
        color = BEAR_COLOR_MAP.get(m.group("color").lower(),
                                   m.group("color").lower())
        return f"Oso {color}"

    m = _GIANT_RX.match(name)
    if m:
        adj = GIANT_ADJ_MAP.get(m.group("adjective").lower(),
                                m.group("adjective").lower())
        return f"Gigante {adj}"

    m = _ELEMENTAL_RX.match(name)
    if m:
        elem = ELEMENT_MAP.get(m.group("element").lower(),
                               m.group("element").lower())
        return f"Elemental de {elem}"

    if _PYTHON_RX.match(name):
        return "Pitón gigante"

    m = _DRAGON_RX.match(name)
    if m:
        age = DRAGON_AGE_MAP.get(m.group("age").lower(),
                                 m.group("age").lower())
        color = COLOR_MAP.get(m.group("color").lower(),
                              m.group("color").lower())
        return f"Dragón {color} {age}"

    # No pattern matched → caller keeps EN name.
    return name


def translate_size(size_en: str | None) -> tuple[str | None, bool]:
    if not size_en:
        return size_en, True
    return SIZE_MAP.get(size_en.lower(), size_en), True


def translate_alignment(alignment_en: str | None) -> tuple[str | None, bool]:
    if not alignment_en:
        return alignment_en, True
    return ALIGNMENT_MAP.get(alignment_en.strip().lower(),
                             alignment_en), True


def translate_type(type_en: str | None) -> tuple[str | None, bool]:
    """Translate ``type_en`` of the form ``"humanoid (goblinoid)"``.

    Returns the locally-conventional Spanish form
    (``"humanoide (goblinide)"``). Returns ``(None, True)`` when the
    input was ``None``.
    """
    if not type_en:
        return type_en, True
    # Split "humanoid (goblinoid)" into top + sub
    m = re.match(r"^(?P<top>[A-Za-z]+)(?:\s*\((?P<sub>[^)]+)\))?$",
                 type_en.strip())
    if not m:
        return type_en, True
    top = TYPE_TOP_MAP.get(m.group("top").lower(), m.group("top").capitalize())
    sub = m.group("sub")
    if not sub:
        return top, True
    sub_translated = TYPE_SUBTYPE_MAP.get(sub.lower(), sub.lower())
    return f"{top} ({sub_translated})", True


def translate_damage_list(items: list[str]) -> list[str]:
    """Best-effort damage-type token replacement (Tier-2)."""
    out: list[str] = []
    for it in items:
        if it in DAMAGE_TYPE_MAP:
            out.append(DAMAGE_TYPE_MAP[it])
        elif it in CONDITION_MAP:
            out.append(CONDITION_MAP[it])
        else:
            out.append(it)
    return out


# ---------------------------------------------------------------------
# Translator facade (called from backfill_es_from_en)
# ---------------------------------------------------------------------

def translate_basics(en: dict) -> dict:
    """Translate the 4 identity fields in ``en`` to ES equivalents.

    Returns a dict with ``name``, ``size``, ``type``, ``alignment``
    plus ``_i18n_pending`` (bool) indicating that any field had to fall
    back to English text. The caller is responsible for stamping
    ``_i18n_pending`` into the resulting JSON if True.
    """
    pending = False
    name_es, _ = translate_name(en.get("name", ""), en.get("slug", ""))
    if name_es == en.get("name", ""):
        pending = True
    size_es, _ = translate_size(en.get("size"))
    type_es, _ = translate_type(en.get("type"))
    align_es, _ = translate_alignment(en.get("alignment"))
    return {
        "name": name_es,
        "size": size_es,
        "type": type_es,
        "alignment": align_es,
        "_i18n_pending": pending,
    }
