"""Generate dnd5e-2024 monster files in strict MonsterDetail flat shape.

Per `backend/src/monsters/monster.types.ts`, each monster file emits ONLY the flat
keys (no `srd` wrapper, no HTML strings). The backend repository at
`monsters.repository.ts` returns raw JSON as-is when `!raw?.srd`, so by emitting
the flat shape directly we skip the regex parser and produce properly-typed data:

  armorClass:  { value, type? }
  hitPoints:    { average, roll? }
  speed:        { walk?, fly?, swim?, climb?, burrow? }   # English keys always
  abilities:    { str, dex, con, int, wis, cha }           # English keys always
  traits/actions: [{ name, text }]   # TextBlock[]

Run from `backend/`.

NOTE: This is the same shape used by the `CustomManualsService` campaign-monsters DB
fallback path (`monsters.service.ts → loadFromDb`), so DB and file-based monsters
share the same consumer-facing shape.
"""

import json
import pathlib
from typing import Iterable, List, Tuple, Optional

OUT = pathlib.Path("data/manuals/dnd5e-2024/monsters")
EN = OUT / "en"
ES = OUT / "es"
EN.mkdir(parents=True, exist_ok=True)
ES.mkdir(parents=True, exist_ok=True)


# Compact tuple format per monster
#   (slug, name, size, type_en, type_es, align_en, align_es,
#    ac_value, ac_desc_en, ac_desc_es,
#    hp_avg, hp_dice,
#    speed_walk, speed_fly, speed_climb, speed_swim, speed_burrow,  # ints or None
#    str, dex, con, int_, wis, cha,
#    skills_en_csv, skills_es_csv,                   # comma-separated bonuses
#    senses_en, senses_es,
#    languages_en, languages_es,
#    cr_string, xp,
#    [ (name_en, name_es, text_en, text_es), ... ],  # traits
#    [ (name_en, name_es, text_en, text_es), ... ])  # actions
M: List[Tuple] = []

# ---------- 1. Goblin ----------
M.append((
    "goblin", "Goblin", "Small",
    "humanoid (goblinoid)", "humanoide (goblin)",
    "neutral evil", "malvado neutral",
    15, "leather armor, shield", "armadura de cuero, escudo",
    7, "2d6",
    30, None, None, None, None,
    8, 14, 10, 10, 8, 8,
    "Stealth +6", "Sigilo +6",
    "darkvision 60 ft., passive Perception 9",
    "visión en la oscuridad 18 m, Percepción pasiva 9",
    "Common, Goblin", "Común, Goblin",
    "1/4", 50,
    [("Nimble Escape", "Escape ágil",
      "The goblin can take the Disengage or Hide action as a bonus action on each of its turns.",
      "El goblin puede tomar la acción Desengancharse o Esconderse como acción adicional en cada uno de sus turnos.")],
    [("Scimitar", "Cimitarra",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 5 (1d6 + 2) cortante."),
     ("Shortbow", "Arco corto",
      "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.",
      "Ataque de arma a distancia: +4 al impacto, alcance 24/96 m, un objetivo. Impacto: 5 (1d6 + 2) perforante.")]
))

# ---------- 2. Kobold ----------
M.append((
    "kobold", "Kobold", "Small",
    "humanoid (kobold)", "humanoide (kobold)",
    "lawful evil", "legal malvado",
    12, "leather armor", "armadura de cuero",
    5, "2d6 - 2",
    30, None, None, None, None,
    7, 15, 9, 8, 7, 8,
    "Stealth +4", "Sigilo +4",
    "darkvision 60 ft., passive Perception 8",
    "visión en la oscuridad 18 m, Percepción pasiva 8",
    "Common, Draconic", "Común, Dracónico",
    "1/8", 25,
    [("Sunlight Sensitivity", "Sensibilidad a la luz solar",
      "While in sunlight, the kobold has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.",
      "Bajo luz solar, el kobold tiene desventaja en tiradas de ataque y en pruebas de Sabiduría (Percepción) basadas en vista.")],
    [("Dagger", "Daga",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 4 (1d4 + 2) perforante."),
     ("Sling", "Honda",
      "Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 4 (1d4 + 2) bludgeoning damage.",
      "Ataque de arma a distancia: +4 al impacto, alcance 9/36 m, un objetivo. Impacto: 4 (1d4 + 2) contundente.")]
))

# ---------- 3. Orc ----------
M.append((
    "orc", "Orc", "Medium",
    "humanoid (orc)", "humanoide (orco)",
    "chaotic evil", "caótico malvado",
    13, "hide armor, shield", "armadura de cuero, escudo",
    15, "2d8 + 6",
    30, None, None, None, None,
    16, 12, 16, 7, 11, 10,
    "Intimidation +2", "Intimidación +2",
    "darkvision 60 ft., passive Perception 10",
    "visión en la oscuridad 18 m, Percepción pasiva 10",
    "Common, Orc", "Común, Orco",
    "1/2", 100,
    [("Aggressive", "Agresivo",
      "As a bonus action, the orc can move up to its speed toward a hostile creature it can see.",
      "Como acción adicional, el orco puede moverse hasta su velocidad hacia una criatura hostil visible.")],
    [("Greataxe", "Hacha grande",
      "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +5 al impacto, alcance 1,5 m, un objetivo. Impacto: 9 (1d12 + 3) cortante."),
     ("Javelin", "Jabalina",
      "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 6 (1d6 + 3) piercing damage.",
      "Ataque de arma cuerpo a cuerpo o a distancia: +5 al impacto, alcance 1,5 m o 9/36 m, un objetivo. Impacto: 6 (1d6 + 3) perforante.")]
))

# ---------- 4. Hobgoblin ----------
M.append((
    "hobgoblin", "Hobgoblin", "Medium",
    "humanoid (goblinoid)", "humanoide (goblin)",
    "lawful evil", "legal malvado",
    18, "chain mail, shield", "cota de malla, escudo",
    11, "2d8 + 2",
    30, None, None, None, None,
    13, 12, 12, 10, 10, 9,
    "", "",
    "darkvision 60 ft., passive Perception 10",
    "visión en la oscuridad 18 m, Percepción pasiva 10",
    "Common, Goblin", "Común, Goblin",
    "1/2", 100,
    [("Martial Advantage", "Ventaja marcial",
      "Once per turn, the hobgoblin can deal an extra 7 (2d6) damage to a creature it hits with a weapon attack if that creature is within 5 feet of an ally of the hobgoblin that is incapacitated.",
      "Una vez por turno, el hobgoblin puede infligir 7 (2d6) puntos extra de daño a una criatura golpeada con un ataque con arma si hay un aliado incapacitado a 1,5 m de ella.")]
    ,
    [("Longsword", "Espada larga",
      "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.",
      "Ataque de arma cuerpo a cuerpo: +3 al impacto, alcance 1,5 m, un objetivo. Impacto: 5 (1d8 + 1) cortante, o 6 (1d10 + 1) cortante con dos manos."),
     ("Longbow", "Arco largo",
      "Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8 + 1) piercing damage.",
      "Ataque de arma a distancia: +3 al impacto, alcance 45/180 m, un objetivo. Impacto: 5 (1d8 + 1) perforante.")]
))

# ---------- 5. Bugbear ----------
M.append((
    "bugbear", "Bugbear", "Medium",
    "humanoid (goblinoid)", "humanoide (goblin)",
    "chaotic evil", "caótico malvado",
    16, "hide armor, shield", "armadura de cuero, escudo",
    27, "5d8 + 10",
    30, None, None, None, None,
    15, 14, 13, 8, 11, 9,
    "Stealth +6, Survival +3", "Sigilo +6, Supervivencia +3",
    "darkvision 60 ft., passive Perception 10",
    "visión en la oscuridad 18 m, Percepción pasiva 10",
    "Common, Goblin", "Común, Goblin",
    "1", 200,
    [("Brute", "Bruto",
      "A melee weapon deals one extra die of damage on a hit (included in attack).",
      "Un ataque cuerpo a cuerpo con arma añade un dado extra de daño en el impacto (ya incluido)."),
     ("Surprise Attack", "Ataque sorpresa",
      "If the bugbear surprises a creature and hits it with an attack on the first turn of combat, the attack deals an extra 7 (2d6) damage.",
      "Si el bugbear sorprende a una criatura y la golpea en el primer turno de combate, el ataque inflige 7 (2d6) puntos extra de daño.")]
    ,
    [("Morningstar", "Lucero del alba",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 11 (2d8 + 2) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 11 (2d8 + 2) perforante."),
     ("Javelin", "Jabalina",
      "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 9 (2d6 + 2) piercing damage in melee or 5 (1d6 + 2) at range.",
      "Ataque de arma cuerpo a cuerpo o a distancia: +4 al impacto, alcance 1,5 m o 9/36 m, un objetivo. Impacto: 9 (2d6 + 2) en cuerpo a cuerpo o 5 (1d6 + 2) a distancia.")]
))

# ---------- 6. Skeleton ----------
M.append((
    "skeleton", "Skeleton", "Medium",
    "undead", "no muerto",
    "lawful evil", "legal malvado",
    13, "armor scraps", "restos de armadura",
    13, "2d8 + 4",
    30, None, None, None, None,
    10, 14, 15, 6, 8, 5,
    "", "",
    "darkvision 60 ft., passive Perception 9",
    "visión en la oscuridad 18 m, Percepción pasiva 9",
    "understands all languages it knew in life but can't speak", "entiende todos los idiomas que conocía en vida pero no puede hablar",
    "1/4", 50,
    [],  # no traits in standard skeleton
    [("Shortsword", "Espada corta",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 5 (1d6 + 2) perforante."),
     ("Shortbow", "Arco corto",
      "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.",
      "Ataque de arma a distancia: +4 al impacto, alcance 24/96 m, un objetivo. Impacto: 5 (1d6 + 2) perforante.")]
))

# ---------- 7. Zombie ----------
M.append((
    "zombie", "Zombie", "Medium",
    "undead", "no muerto",
    "neutral evil", "neutral malvado",
    8, "undead fortitude", "fortaleza no muerta",
    22, "3d8 + 9",
    20, None, None, None, None,
    13, 6, 16, 3, 6, 5,
    "", "",
    "darkvision 60 ft., passive Perception 8",
    "visión en la oscuridad 18 m, Percepción pasiva 8",
    "understands languages it knew in life but can't speak", "entiende los idiomas que conocía en vida pero no puede hablar",
    "1/4", 50,
    [("Undead Fortitude", "Fortaleza no muerta",
      "If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 hit point instead.",
      "Si el daño reduce al zombi a 0 puntos de golpe, debe hacer una salvación de Constitución con DC 5 + el daño recibido, salvo que el daño sea radiante o de un golpe crítico. En éxito, queda con 1 punto de golpe.")]
    ,
    [("Slam", "Garrazo",
      "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage.",
      "Ataque de arma cuerpo a cuerpo: +3 al impacto, alcance 1,5 m, un objetivo. Impacto: 4 (1d6 + 1) contundente.")]
))

# ---------- 8. Ghoul ----------
M.append((
    "ghoul", "Ghoul", "Medium",
    "undead", "no muerto",
    "chaotic evil", "caótico malvado",
    12, "", "",
    22, "5d8",
    30, None, None, None, None,
    13, 15, 10, 7, 10, 6,
    "", "",
    "darkvision 60 ft., passive Perception 10",
    "visión en la oscuridad 18 m, Percepción pasiva 10",
    "Common", "Común",
    "1", 200,
    [],  # traits come in 2024 SRD generally
    [("Bite", "Mordisco",
      "Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 8 (2d6 + 1) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +2 al impacto, alcance 1,5 m, una criatura. Impacto: 8 (2d6 + 1) perforante."),
     ("Claws", "Garras",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) slashing damage. If the target is a creature other than an elf or undead, it must succeed on a DC 10 Constitution saving throw or be paralyzed for 1 minute.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 7 (2d4 + 2) cortante. Si no es elfo ni no-muerto, debe superar salvación de Constitución CD 10 o quedar paralizado 1 minuto.")]
))

# ---------- 9. Ogre ----------
M.append((
    "ogre", "Ogre", "Large",
    "giant", "gigante",
    "chaotic evil", "caótico malvado",
    11, "hide armor", "armadura de cuero",
    59, "7d10 + 21",
    40, None, None, None, None,
    19, 8, 16, 5, 7, 7,
    "", "",
    "darkvision 60 ft., passive Perception 8",
    "visión en la oscuridad 18 m, Percepción pasiva 8",
    "Common, Giant", "Común, Gigante",
    "2", 450,
    [],
    [("Greatclub", "Gran garrote",
      "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.",
      "Ataque de arma cuerpo a cuerpo: +6 al impacto, alcance 1,5 m, un objetivo. Impacto: 13 (2d8 + 4) contundente."),
     ("Javelin", "Jabalina",
      "Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 11 (2d6 + 4) piercing damage.",
      "Ataque de arma cuerpo a cuerpo o a distancia: +6 al impacto, alcance 1,5 m o 9/36 m, un objetivo. Impacto: 11 (2d6 + 4) perforante.")]
))

# ---------- 10. Troll ----------
M.append((
    "troll", "Troll", "Large",
    "giant", "gigante",
    "chaotic evil", "caótico malvado",
    15, "natural armor", "armadura natural",
    84, "8d10 + 40",
    40, None, None, None, None,
    18, 13, 20, 7, 9, 7,
    "Perception +2", "Percepción +2",
    "darkvision 60 ft., passive Perception 12",
    "visión en la oscuridad 18 m, Percepción pasiva 12",
    "Giant", "Gigante",
    "5", 1800,
    [("Regeneration", "Regeneración",
      "The troll regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait doesn't function at the start of the troll's next turn. The troll dies only if it starts its turn with 0 hit points and can't regenerate.",
      "El trol recupera 10 PG al inicio de su turno. Si recibió daño de ácido o fuego, esta dote no funciona al inicio de su siguiente turno. Solo muere si empieza su turno con 0 PG y no puede regenerarse.")]
    ,
    [("Multiattack", "Ataque múltiple",
      "The troll makes three attacks: one with its bite and two with its claws.",
      "El trol realiza tres ataques: uno con su mordisco y dos con sus garras."),
     ("Bite", "Mordisco",
      "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 4) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +7 al impacto, alcance 1,5 m, un objetivo. Impacto: 7 (1d6 + 4) perforante."),
     ("Claw", "Garra",
      "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +7 al impacto, alcance 1,5 m, un objetivo. Impacto: 11 (2d6 + 4) cortante.")]
))

# ---------- 11. Owlbear ----------
M.append((
    "owlbear", "Owlbear", "Large",
    "monstrosity", "monstruosidad",
    "unaligned", "sin alineamiento",
    13, "natural armor", "armadura natural",
    59, "7d10 + 21",
    40, None, None, None, None,
    20, 12, 17, 3, 12, 7,
    "Perception +3", "Percepción +3",
    "darkvision 60 ft., passive Perception 13",
    "visión en la oscuridad 18 m, Percepción pasiva 13",
    "", "",
    "3", 700,
    [("Keen Sight and Smell", "Vista y olfato agudos",
      "The owlbear has advantage on Wisdom (Perception) checks that rely on sight or smell.",
      "El búho-oso tiene ventaja en pruebas de Sabiduría (Percepción) basadas en vista u olfato.")]
    ,
    [("Multiattack", "Ataque múltiple",
      "The owlbear makes two attacks: one with its beak and one with its claws.",
      "El búho-oso hace dos ataques: uno con su pico y otro con sus garras."),
     ("Beak", "Pico",
      "Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 10 (1d10 + 4) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +7 al impacto, alcance 1,5 m, una criatura. Impacto: 10 (1d10 + 4) perforante."),
     ("Claws", "Garras",
      "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 4) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +7 al impacto, alcance 1,5 m, un objetivo. Impacto: 14 (2d8 + 4) cortante.")]
))

# ---------- 12. Wolf ----------
M.append((
    "wolf", "Wolf", "Medium",
    "beast", "bestia",
    "unaligned", "sin alineamiento",
    13, "natural armor", "armadura natural",
    11, "2d8 + 2",
    40, None, None, None, None,
    12, 15, 12, 3, 12, 6,
    "Perception +3, Stealth +4", "Percepción +3, Sigilo +4",
    "passive Perception 13",
    "Percepción pasiva 13",
    "", "",
    "1/4", 50,
    [("Keen Hearing and Smell", "Oído y olfato agudos",
      "The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
      "El lobo tiene ventaja en pruebas de Sabiduría (Percepción) basadas en oído u olfato."),
     ("Pack Tactics", "Tácticas de manada",
      "The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      "El lobo tiene ventaja en una tirada de ataque si al menos un aliado está a 1,5 m de la criatura y no está incapacitado.")]
    ,
    [("Bite", "Mordisco",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 7 (2d4 + 2) perforante. Si es una criatura, debe superar salvación de Fuerza CD 11 o quedar derribada.")]
))

# ---------- 13. Brown Bear ----------
M.append((
    "brown-bear", "Brown Bear", "Large",
    "beast", "bestia",
    "unaligned", "sin alineamiento",
    11, "natural armor", "armadura natural",
    34, "4d10 + 12",
    40, None, None, None, None,
    18, 10, 16, 2, 13, 7,
    "Perception +3", "Percepción +3",
    "passive Perception 13",
    "Percepción pasiva 13",
    "", "",
    "1", 200,
    [("Keen Smell", "Olfato agudo",
      "The bear has advantage on Wisdom (Perception) checks that rely on smell.",
      "El oso tiene ventaja en pruebas de Sabiduría (Percepción) basadas en olfato.")]
    ,
    [("Multiattack", "Ataque múltiple",
      "The bear makes two attacks: one with its bite and one with its claws.",
      "El oso hace dos ataques: uno con su mordisco y otro con sus garras."),
     ("Bite", "Mordisco",
      "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +5 al impacto, alcance 1,5 m, un objetivo. Impacto: 8 (1d8 + 4) perforante."),
     ("Claws", "Garras",
      "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +5 al impacto, alcance 1,5 m, un objetivo. Impacto: 11 (2d6 + 4) cortante.")]
))

# ---------- 14. Gnoll ----------
M.append((
    "gnoll", "Gnoll", "Medium",
    "humanoid (gnoll)", "humanoide (gnoll)",
    "chaotic evil", "caótico malvado",
    15, "hide armor, shield", "armadura de cuero, escudo",
    22, "5d8",
    30, None, None, None, None,
    14, 12, 11, 6, 9, 5,
    "", "",
    "darkvision 60 ft., passive Perception 9",
    "visión en la oscuridad 18 m, Percepción pasiva 9",
    "Gnoll", "Gnoll",
    "1/2", 100,
    [("Rampage", "Embestida",
      "When the gnoll reduces a creature to 0 hit points with a melee attack on its turn, the gnoll can take a bonus action to move up to half its speed and make a bite attack.",
      "Cuando el gnoll reduce a una criatura a 0 PG con un ataque cuerpo a cuerpo en su turno, puede usar acción adicional para moverse hasta la mitad de su velocidad y hacer un mordisco.")]
    ,
    [("Bite", "Mordisco",
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.",
      "Ataque de arma cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, un objetivo. Impacto: 4 (1d4 + 2) perforante."),
     ("Spear", "Lanza",
      "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d6 + 2) piercing damage, or 6 (1d8 + 2) if used with two hands.",
      "Ataque de arma cuerpo a cuerpo o a distancia: +4 al impacto, alcance 1,5 m o 6/18 m, un objetivo. Impacto: 5 (1d6 + 2), o 6 (1d8 + 2) con dos manos.")]
))

# ---------- 15. Specter ----------
M.append((
    "specter", "Specter", "Medium",
    "undead", "no muerto",
    "chaotic evil", "caótico malvado",
    12, "", "",
    22, "5d8",
    0, 50, None, None, None,  # flies 50 ft.
    1, 14, 11, 10, 10, 11,
    "", "",
    "darkvision 60 ft., passive Perception 10",
    "visión en la oscuridad 18 m, Percepción pasiva 10",
    "understands languages it knew in life but can't speak", "entiende los idiomas que conocía en vida pero no puede hablar",
    "1", 200,
    [("Incorporeal Movement", "Movimiento incorpóreo",
      "The specter can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
      "El espectro puede atravesar criaturas y objetos como terreno difícil. Si termina su turno dentro de un objeto recibe 5 (1d10) puntos de daño de fuerza.")]
    ,
    [("Life Drain", "Drenaje de vida",
      "Melee Spell Attack: +4 to hit, reach 5 ft., one creature. Hit: 9 (2d8) necrotic damage. The target must succeed on a DC 10 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest.",
      "Ataque de conjuro cuerpo a cuerpo: +4 al impacto, alcance 1,5 m, una criatura. Impacto: 9 (2d8) necrótico. La víctima debe superar salvación de Constitución CD 10 o ve reducida su PG máximos por el daño. La reducción dura hasta un descanso largo.")]
))

# ---------- 16. Wraith ----------
M.append((
    "wraith", "Wraith", "Medium",
    "undead", "no muerto",
    "neutral evil", "neutral malvado",
    13, "", "",
    67, "9d8 + 27",
    0, 60, None, None, None,
    6, 16, 16, 12, 14, 15,
    "", "",
    "darkvision 60 ft., passive Perception 12",
    "visión en la oscuridad 18 m, Percepción pasiva 12",
    "the languages it knew in life", "los idiomas que conocía en vida",
    "5", 1800,
    [("Incorporeal Movement", "Movimiento incorpóreo",
      "The wraith can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
      "El wraith puede atravesar criaturas y objetos como terreno difícil. Recibe 5 (1d10) de daño de fuerza si termina su turno dentro de un objeto."),
     ("Sunlight Sensitivity", "Sensibilidad a la luz solar",
      "While in sunlight, the wraith has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.",
      "Bajo luz solar, el wraith tiene desventaja en tiradas de ataque y en pruebas de Sabiduría (Percepción) basadas en vista.")]
    ,
    [("Life Drain", "Drenaje de vida",
      "Melee Spell Attack: +6 to hit, reach 5 ft., one creature. Hit: 21 (4d8 + 3) necrotic damage. The target must succeed on a DC 14 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest. If this attack reduces a creature to 0 hit points, the target rises as a specter under the wraith's control.",
      "Ataque de conjuro cuerpo a cuerpo: +6 al impacto, alcance 1,5 m, una criatura. Impacto: 21 (4d8 + 3) necrótico. Debe superar Constituición CD 14 o ve reducida su PG máximos. Si reduce a 0, surge un espectro bajo control del wraith."),
     ("Create Specter", "Crear espectro",
      "The wraith targets a humanoid within 10 feet of it that has been dead for no longer than 1 minute. The target rises as a specter under the wraith's control.",
      "El wraith elige un humanoide muerto hace menos de 1 minuto a 3 m. Surge como un espectro bajo su control.")]
))

# ---------- 17. Vampire Spawn ----------
M.append((
    "vampire-spawn", "Vampire Spawn", "Medium",
    "undead", "no muerto",
    "neutral evil", "neutral malvado",
    15, "natural armor", "armadura natural",
    82, "11d8 + 33",
    30, None, 30, None, None,
    16, 16, 16, 11, 10, 12,
    "Perception +2, Stealth +4", "Percepción +2, Sigilo +4",
    "darkvision 60 ft., passive Perception 12",
    "visión en la oscuridad 18 m, Percepción pasiva 12",
    "the languages it knew in life", "los idiomas que conocía en vida",
    "5", 1800,
    [("Regeneration", "Regeneración",
      "The vampire regains 10 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant or fire damage, this trait doesn't function at the start of the vampire's next turn.",
      "El vampiro recupera 10 PG al inicio de su turno si tiene al menos 1 PG y no está bajo luz solar o agua corriente. Si recibe daño radiante o de fuego, esta dote no funciona en su siguiente turno."),
     ("Spider Climb", "Trepar como araña",
      "The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
      "El vampiro trepa superficies difíciles, incluso boca abajo en techos, sin necesidad de prueba."),
     ("Vampire Weaknesses", "Debilidades del vampiro",
      "The vampire has the following flaws: forbiddance (can't enter a residence uninvited), running water, stake to the heart, sunlight hypersensitivity (disadvantage on attack rolls and Perception in sunlight).",
      "El vampiro presenta las siguientes flaquezas: prohibición (no puede entrar en una residencia sin invitación), agua corriente, estaca en el corazón, hipersensibilidad a la luz solar (desventaja en ataque y Percepción bajo luz solar).")]
    ,
    [("Multiattack", "Ataque múltiple",
      "The vampire makes two attacks, only one of which can be a bite attack.",
      "El vampiro hace dos ataques, solo uno puede ser un mordisco."),
     ("Unarmed Strike", "Golpe desarmado",
      "Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 8 (1d8 + 4) bludgeoning damage. Instead of dealing bludgeoning damage, the vampire can grapple the target (escape DC 14).",
      "Ataque de arma cuerpo a cuerpo: +7 al impacto, alcance 1,5 m, una criatura. Impacto: 8 (1d8 + 4) contundente. En vez de contundente, puede agarrar al objetivo (escapar CD 14)."),
     ("Bite", "Mordisco",
      "Melee Weapon Attack: +7 to hit, reach 5 ft., one willing creature, or a creature that is grappled by the vampire, incapacitated, or restrained. Hit: 7 (1d6 + 4) piercing damage plus 7 (2d6) necrotic damage. The target's hit point maximum is reduced by an amount equal to the necrotic damage taken, and the vampire regains hit points equal to that amount.",
      "Ataque de arma cuerpo a cuerpo: +7 al impacto, alcance 1,5 m, una criatura voluntariamente o agarrada/incapacitada/inmovilizada. Impacto: 7 (1d6 + 4) perforante + 7 (2d6) necrótico. Los PG máximos del objetivo se reducen por el daño necrótico y el vampiro recupera tantos PG.")]
))

# ---------- 18. Bandit ----------
M.append((
    "bandit", "Bandit", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any non-lawful alignment", "cualquier alineamiento no legal",
    12, "leather armor", "armadura de cuero",
    11, "2d8 + 2",
    30, None, None, None, None,
    11, 12, 12, 10, 10, 10,
    "", "",
    "passive Perception 10",
    "Percepción pasiva 10",
    "any one language (usually Common)", "cualquier idioma (normalmente Común)",
    "1/8", 25,
    [],
    [("Scimitar", "Cimitarra",
      "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +3 al impacto, alcance 1,5 m, un objetivo. Impacto: 4 (1d6 + 1) cortante."),
     ("Light Crossbow", "Ballesta ligera",
      "Ranged Weapon Attack: +3 to hit, range 80/320 ft., one target. Hit: 4 (1d6 + 1) piercing damage.",
      "Ataque de arma a distancia: +3 al impacto, alcance 24/96 m, un objetivo. Impacto: 4 (1d6 + 1) perforante.")]
))

# ---------- 19. Guard ----------
M.append((
    "guard", "Guard", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any alignment", "cualquier alineamiento",
    16, "chain shirt, shield", "camisa de malla, escudo",
    11, "2d8 + 2",
    30, None, None, None, None,
    13, 12, 12, 10, 11, 10,
    "Perception +2", "Percepción +2",
    "passive Perception 12",
    "Percepción pasiva 12",
    "any one language (usually Common)", "cualquier idioma (normalmente Común)",
    "1/8", 25,
    [],
    [("Spear", "Lanza",
      "Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage, or 5 (1d8 + 1) if used with two hands.",
      "Ataque de arma cuerpo a cuerpo o a distancia: +3 al impacto, alcance 1,5 m o 6/18 m, un objetivo. Impacto: 4 (1d6 + 1), o 5 (1d8 + 1) con dos manos.")]
))

# ---------- 20. Knight (NPC veteran) ----------
M.append((
    "knight", "Knight", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any alignment", "cualquier alineamiento",
    18, "plate armor", "armadura de placas",
    52, "8d8 + 16",
    30, None, None, None, None,
    16, 11, 14, 11, 11, 15,
    "", "",
    "passive Perception 10",
    "Percepción pasiva 10",
    "any one language (usually Common)", "cualquier idioma (normalmente Común)",
    "3", 700,
    [("Brave", "Valiente",
      "The knight has advantage on saving throws against being frightened.",
      "El caballero tiene ventaja en salvaciones contra ser asustado.")]
    ,
    [("Multiattack", "Ataque múltiple",
      "The knight makes two melee attacks.",
      "El caballero hace dos ataques cuerpo a cuerpo."),
     ("Greatsword", "Espada de dos manos",
      "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +5 al impacto, alcance 1,5 m, un objetivo. Impacto: 10 (2d6 + 3) cortante."),
     ("Heavy Crossbow", "Ballesta pesada",
      "Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.",
      "Ataque de arma a distancia: +2 al impacto, alcance 30/120 m, un objetivo. Impacto: 5 (1d10) perforante."),
     ("Leadership (Recharges after a Short or Long Rest)", "Liderazgo (recarga tras descanso corto o largo)",
      "For 1 minute, the knight can utter a special command or warning whenever a nonhostile creature that it can see within 30 feet of it makes an attack roll or saving throw. The creature can add a d4 to its roll provided it can hear and understand the knight.",
      "Durante 1 minuto, el caballero puede dar un comando especial o advertencia cuando una criatura no hostil que pueda ver a 9 m hace una tirada de ataque o salvación. La criatura suma 1d4 a su tirada, siempre que pueda oírlo y entenderlo.")]
))

# ---------- 21. Veteran ----------
M.append((
    "veteran", "Veteran", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any alignment", "cualquier alineamiento",
    17, "splint armor, shield", "armadura de tiras, escudo",
    58, "9d8 + 27",
    30, None, None, None, None,
    16, 13, 14, 10, 11, 10,
    "Athletics +5, Perception +2", "Atletismo +5, Percepción +2",
    "passive Perception 12",
    "Percepción pasiva 12",
    "any one language (usually Common)", "cualquier idioma (normalmente Común)",
    "3", 700,
    [],
    [("Multiattack", "Ataque múltiple",
      "The veteran makes two weapon attacks.",
      "El veterano hace dos ataques con arma."),
     ("Longsword", "Espada larga",
      "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) if used with two hands.",
      "Ataque de arma cuerpo a cuerpo: +5 al impacto, alcance 1,5 m, un objetivo. Impacto: 7 (1d8 + 3) cortante, o 8 (1d10 + 3) con dos manos."),
     ("Heavy Crossbow", "Ballesta pesada",
      "Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target. Hit: 6 (1d10 + 1) piercing damage.",
      "Ataque de arma a distancia: +3 al impacto, alcance 30/120 m, un objetivo. Impacto: 6 (1d10 + 1) perforante.")]
))

# ---------- 22. Cultist ----------
M.append((
    "cultist", "Cultist", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any non-good alignment", "cualquier alineamiento no bueno",
    12, "leather armor", "armadura de cuero",
    9, "2d8",
    30, None, None, None, None,
    11, 12, 10, 11, 10, 10,
    "Deception +2, Religion +4", "Engaño +2, Religión +4",
    "passive Perception 10",
    "Percepción pasiva 10",
    "any one language (usually Common)", "cualquier idioma (normalmente Común)",
    "1/8", 25,
    [],
    [("Scimitar", "Cimitarra",
      "Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 4 (1d6 + 1) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +3 al impacto, alcance 1,5 m, una criatura. Impacto: 4 (1d6 + 1) cortante.")]
))

# ---------- 23. Acolyte ----------
M.append((
    "acolyte", "Acolyte", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any alignment", "cualquier alineamiento",
    10, "", "",
    9, "2d8",
    30, None, None, None, None,
    10, 10, 10, 10, 14, 11,
    "Medicine +4, Religion +2", "Medicina +4, Religión +2",
    "passive Perception 12",
    "Percepción pasiva 12",
    "any one language (usually Common)", "cualquier idioma (normalmente Común)",
    "1/4", 50,
    [("Spellcasting", "Lanzamiento de conjuros",
      "The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks). The acolyte has following cleric spells prepared: Cantrips (at will): light, sacred flame, thaumaturgy; 1st level (3 slots): cure wounds, sanctuary.",
      "El acólito es un lanzador de conjuros de nivel 1. Su habilidad de lanzamiento es Sabiduría (CD de salvación 12, +4 a impacto con ataques de conjuro). Tiene preparados los siguientes conjuros de clérigo: Cantrips (a voluntad): luz, llamas sagradas, taumaturgia; nivel 1 (3 espacios): curar heridas, santuario.")]
    ,
    [("Club", "Garrote",
      "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.",
      "Ataque de arma cuerpo a cuerpo: +2 al impacto, alcance 1,5 m, un objetivo. Impacto: 2 (1d4) contundente.")]
))

# ---------- 24. Mage (NPC) ----------
M.append((
    "mage", "Mage", "Medium",
    "humanoid (any race)", "humanoide (cualquier raza)",
    "any alignment", "cualquier alineamiento",
    12, "mage armor", "armadura de mago",
    27, "5d8 + 5",
    30, None, None, None, None,
    9, 14, 11, 17, 12, 11,
    "Arcana +7", "Arcanismo +7",
    "passive Perception 11",
    "Percepción pasiva 11",
    "any four languages", "cualquier cuatro idiomas",
    "6", 2300,
    [("Spellcasting", "Lanzamiento de conjuros",
      "The mage is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 16, +8 to hit with spell attacks). The mage has the following wizard spells prepared: Cantrips (at will): fire bolt, light, mage hand, prestidigitation; 1st level (4 slots): detect magic, mage armor, magic missile, shield; 2nd level (3 slots): misty step, suggestion; 3rd level (3 slots): counterspell, fireball, fly; 4th level (3 slots): greater invisibility, ice storm; 5th level (1 slot): cone of cold.",
      "El mago es un lanzador de nivel 9. Su habilidad de lanzamiento es Inteligencia (CD 16, +8 a impacto). Tiene preparados los siguientes conjuros de mago: Cantrips (a voluntad): descarga de fuego, luz, mano de mago, prestidigitación; nivel 1 (4 espacios): detectar magia, armadura de mago, misil mágico, escudo; nivel 2 (3 espacios): paso brumoso, sugerencia; nivel 3 (3 espacios): contrahechizo, bola de fuego, volar; nivel 4 (3 espacios): invisibilidad mayor, tormenta de hielo; nivel 5 (1 espacio): cono de frío.")]
    ,
    [("Dagger", "Daga",
      "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.",
      "Ataque de arma cuerpo a cuerpo o a distancia: +5 al impacto, alcance 1,5 m o 6/18 m, un objetivo. Impacto: 4 (1d4 + 2) perforante.")]
))

# ---------- 25. Young Red Dragon ----------
M.append((
    "young-red-dragon", "Young Red Dragon", "Large",
    "dragon", "dragón",
    "chaotic evil", "caótico malvado",
    18, "natural armor", "armadura natural",
    178, "17d10 + 85",
    40, 80, None, None, None,
    23, 10, 19, 14, 11, 17,
    "Perception +4, Stealth +4", "Percepción +4, Sigilo +4",
    "blindsight 30 ft., darkvision 120 ft., passive Perception 14",
    "vista ciega 9 m, visión en la oscuridad 36 m, Percepción pasiva 14",
    "Common, Draconic", "Común, Dracónico",
    "10", 5900,
    [],
    [("Multiattack", "Ataque múltiple",
      "The young red dragon makes three attacks: one with its bite and two with its claws.",
      "El dragón rojo joven hace tres ataques: uno con su mordisco y dos con sus garras."),
     ("Bite", "Mordisco",
      "Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 3 (1d6) fire damage.",
      "Ataque de arma cuerpo a cuerpo: +10 al impacto, alcance 3 m, un objetivo. Impacto: 17 (2d10 + 6) perforante + 3 (1d6) de fuego."),
     ("Claw", "Garra",
      "Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage.",
      "Ataque de arma cuerpo a cuerpo: +10 al impacto, alcance 1,5 m, un objetivo. Impacto: 13 (2d6 + 6) cortante."),
     ("Fire Breath (Recharge 5–6)", "Aliento de fuego (recarga 5–6)",
      "The dragon exhales fire in a 30-foot cone. Each creature in that area must make a DC 17 Dexterity saving throw, taking 56 (16d6) fire damage on a failed save, or half as much damage on a successful one.",
      "El dragón exhala fuego en un cono de 9 m. Cada criatura en el área debe hacer salvación de Destreza CD 17, recibiendo 56 (16d6) de daño de fuego en fallo o mitad en éxito.")]
))


def write_for_lang(row, idx, lang):
    """Emit one Monster file for the given language index (0=en, 1=es)."""
    (slug, name, size,
     type_en, type_es,
     align_en, align_es,
     ac_val, ac_desc_en, ac_desc_es,
     hp_avg, hp_dice,
     spd_walk, spd_fly, spd_climb, spd_swim, spd_burrow,
     s_, d_, co, i_, w_, ch,
     sk_en, sk_es,
     sens_en, sens_es,
     lang_en, lang_es,
     cr, xp,
     traits, actions) = row

    # Pull current language-specific fields
    type_ = [type_en, type_es][idx]
    align = [align_en, align_es][idx]
    ac_desc = [ac_desc_en, ac_desc_es][idx] or None
    sk_list = [s.strip() for s in ([sk_en, sk_es][idx]).split(",") if s.strip()]
    senses = [sens_en, sens_es][idx]
    langs = [lang_en, lang_es][idx]
    is_en = (idx == 0)

    speed = {}
    if spd_walk is not None: speed["walk"] = spd_walk
    if spd_fly is not None: speed["fly"] = spd_fly
    if spd_climb is not None: speed["climb"] = spd_climb
    if spd_swim is not None: speed["swim"] = spd_swim
    if spd_burrow is not None: speed["burrow"] = spd_burrow

    abilities = {"str": s_, "dex": d_, "con": co, "int": i_, "wis": w_, "cha": ch}

    out = {
        "id": slug,
        "slug": slug,
        "lang": ["en", "es"][idx],
        "source": "SRD 5.2 (2024)",
        "name": name,
        "size": size,
        "type": type_,
        "alignment": align,
        "armorClass": {"value": ac_val, "type": ac_desc} if ac_desc else {"value": ac_val},
        "hitPoints": {"average": hp_avg, "roll": hp_dice},
        "speed": speed,
        "abilities": abilities,
        "savingThrows": [],
        "skills": sk_list,
        "damageVulnerabilities": [],
        "damageResistances": [],
        "damageImmunities": [],
        "conditionImmunities": [],
        "senses": senses,
        "languages": langs,
        "challengeRating": cr,
        "experiencePoints": xp,
        "traits": [{"name": t[0 if is_en else 1], "text": t[2 if is_en else 3]} for t in traits],
        "actions": [{"name": a[0 if is_en else 1], "text": a[2 if is_en else 3]} for a in actions],
}

    return out


def main():
    written = 0
    for m in M:
        for idx, lang in enumerate(["en", "es"]):
            doc = write_for_lang(m, idx, lang)
            target = (EN if lang == "en" else ES) / f"{m[0]}.json"
            target.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            written += 1
    print(f"Wrote {written} monster files ({len(M)} × EN+ES).")


if __name__ == "__main__":
    main()
