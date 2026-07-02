#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5: Additive merge of ~30 NEW SRD 5.2 (2024) monsters NOT in current bestiary.
Coverage: Beasts (15) + Elementals (3) + Giants (6) + Constructs (6) = 30.

Pattern (proven from monsters v3/v4):
  - Each MONSTER entry uses bilingual dicts {"en":..., "es":...} for text fields
  - localize() walker extracts per-language flat strings
  - additive merge keyed on `id` (idempotent, never overwrites)
  - one JSON file per creature per language: monsters/{en,es}/<slug>.json
"""
from __future__ import annotations
import json, pathlib
from typing import Any

ROOT = pathlib.Path('data/manuals/dnd5e-2024/monsters')
EN_DIR = ROOT / 'en'
ES_DIR = ROOT / 'es'

# proficiency bonus by CR
PB_BY_CR = {0:2, "1/8":2, "1/4":2, "1/2":2, 1:2, 2:2, 3:3, 4:3, 5:3, 6:3, 7:3, 8:3,
            9:4, 10:4, 11:4, 12:4, 13:5, 14:5, 15:5, 16:5, 17:6, 18:6, 19:6, 20:6,
            21:7, 22:7, 23:7, 24:7, 25:8, 26:8, 27:8, 28:8, 29:9, 30:9}
XP_BY_CR = {"0":10,"1/8":25,"1/4":50,"1/2":100,1:200,2:450,3:700,4:1100,5:1800,6:2300,
            7:2900,8:3900,9:5000,10:5900,11:7200,12:8400,13:10000,14:11500,15:13000,
            16:15000,17:18000,18:20000,19:22000,20:25000,21:33000,22:41000,23:50000,
            24:62000,25:75000,26:90000,27:105000,28:120000,29:135000,30:155000}

def pb(cr) -> int: return PB_BY_CR.get(cr, 2)

# Each MONSTER: dict-of-properties bilingual source.
MONSTERS: list[dict[str, Any]] = [
  # ──────────────────────────── BEASTS (15 NEW) ────────────────────────────
  {"id":"bat","slug":"bat","name":{"en":"Bat","es":"Murciélago"},"size":"Tiny","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":1,"roll":"1d4 - 1"},
   "speed":{"walk":5,"fly":40},
   "abilities":{"str":2,"dex":15,"con":8,"int":2,"wis":12,"cha":4},
   "senses":{"en":"blindsight 60 ft., passive Perception 11","es":"visión ciega 18 m, Percepción pasiva 11"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/8",
   "traits":[
     {"name":{"en":"Echolocation","es":"Ecolocalización"},
      "text":{"en":"Can't use blindsight while deafened.","es":"No puede usar visión ciega mientras esté sordo."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+4 to hit, reach 5 ft., one target. Hit: 1 piercing damage.","es":"+4 al impacto, alcance 1,5 m, un objetivo. Impacto: 1 perforante."}} ] },

  {"id":"boar","slug":"boar","name":{"en":"Boar","es":"Jabalí"},"size":"Medium","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":11,"roll":"2d8 + 2"},
   "speed":{"walk":40},
   "abilities":{"str":13,"dex":11,"con":12,"int":2,"wis":9,"cha":5},
   "skills":[" Perception +1 "],
   "senses":{"en":"passive Perception 11","es":"Percepción pasiva 11"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/4",
   "traits":[
     {"name":{"en":"Charge","es":"Carga"},
      "text":{"en":"If moves 20+ ft straight toward target, +2 damage on hit.","es":"Si se mueve 6 m+直线, +2 daño al impacto."}},
     {"name":{"en":"Relentless","es":"Implacable"},
      "text":{"en":"Recharges tusks attack after taking damage.","es":"Recarga ataque de colmillos tras recibir daño."}} ],
   "actions":[
     {"name":{"en":"Tusks","es":"Colmillos"},
      "text":{"en":"+3 to hit, reach 5 ft. Hit: 4 (1d6 + 1) slashing.","es":"+3 al impacto, alcance 1,5 m. Impacto: 4 (1d6 + 1) cortante."}} ] },

  {"id":"mastiff","slug":"mastiff","name":{"en":"Mastiff","es":"Mastín"},"size":"Medium","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":5,"roll":"1d8 + 1"},
   "speed":{"walk":40},
   "abilities":{"str":13,"dex":11,"con":12,"int":3,"wis":12,"cha":7},
   "skills":[" Perception +3 "," Stealth +2 "],
   "senses":{"en":"passive Perception 13","es":"Percepción pasiva 13"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/8",
   "traits":[
     {"name":{"en":"Keen Smell","es":"Olfato Fino"},
      "text":{"en":"Advantage on Perception checks using smell.","es":"Ventaja en Percepción basada en olfato."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+3 to hit. Hit: 4 (1d6 + 1) piercing. DC 11 STR save or knocked prone.","es":"+3 al impacto. Impacto: 4 (1d6 + 1) perforante. Salvación FUE CD 11 o derribado."}} ] },

  {"id":"draft_horse","slug":"draft_horse","name":{"en":"Draft Horse","es":"Caballo de Tiro"},"size":"Large","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":10,"hitPoints":{"average":19,"roll":"3d10 + 3"},
   "speed":{"walk":40},
   "abilities":{"str":18,"dex":10,"con":12,"int":2,"wis":11,"cha":7},
   "senses":{"en":"passive Perception 10","es":"Percepción pasiva 10"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/4",
   "actions":[
     {"name":{"en":"Hooves","es":"Pezuñas"},
      "text":{"en":"+6 to hit. Hit: 7 (2d4 + 4) bludgeoning.","es":"+6 al impacto. Impacto: 7 (2d4 + 4) contundente."}} ] },

  {"id":"riding_horse","slug":"riding_horse","name":{"en":"Riding Horse","es":"Caballo de Montar"},"size":"Large","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":10,"hitPoints":{"average":13,"roll":"2d10 + 2"},
   "speed":{"walk":60},
   "abilities":{"str":16,"dex":10,"con":12,"int":2,"wis":11,"cha":7},
   "senses":{"en":"passive Perception 10","es":"Percepción pasiva 10"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/4",
   "actions":[
     {"name":{"en":"Hooves","es":"Pezuñas"},
      "text":{"en":"+5 to hit. Hit: 6 (2d4 + 3) bludgeoning.","es":"+5 al impacto. Impacto: 6 (2d4 + 3) contundente."}} ] },

  {"id":"lion","slug":"lion","name":{"en":"Lion","es":"León"},"size":"Large","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":26,"roll":"4d10 + 4"},
   "speed":{"walk":50},
   "abilities":{"str":17,"dex":15,"con":13,"int":3,"wis":12,"cha":8},
   "skills":[" Perception +3 "," Stealth +6 "],
   "senses":{"en":"passive Perception 13","es":"Percepción pasiva 13"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"2",
   "traits":[
     {"name":{"en":"Keen Smell","es":"Olfato Fino"},
      "text":{"en":"Advantage on Perception checks using smell.","es":"Ventaja en Percepción basada en olfato."}},
     {"name":{"en":"Pack Tactics","es":"Tácticas de Manada"},
      "text":{"en":"Advantage on attack rolls if an ally is within 5 ft of the target.","es":"Ventaja en ataque si un aliado está a 1,5 m del objetivo."}},
     {"name":{"en":"Pounce","es":"Salto"},
      "text":{"en":"If moves 20+ ft straight, +2d6 extra damage and DC 13 STR save or prone.","es":"Si se mueve 6 m+, +2d6 daño extra y salvación FUE CD 13 o derribado."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+5 to hit. Hit: 7 (1d8 + 3) piercing.","es":"+5 al impacto. Impacto: 7 (1d8 + 3) perforante."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+5 to hit. Hit: 6 (1d6 + 3) slashing.","es":"+5 al impacto. Impacto: 6 (1d6 + 3) cortante."}} ] },

  {"id":"ape","slug":"ape","name":{"en":"Ape","es":"Simio"},"size":"Medium","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":19,"roll":"3d8 + 6"},
   "speed":{"walk":30,"climb":20},
   "abilities":{"str":16,"dex":14,"con":14,"int":6,"wis":12,"cha":7},
   "skills":[" Athletics +5 "," Perception +3 "],
   "senses":{"en":"passive Perception 13","es":"Percepción pasiva 13"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/2",
   "actions":[
     {"name":{"en":"Fist","es":"Puño"},
      "text":{"en":"+5 to hit. Hit: 4 (1d4 + 3) bludgeoning. DC 12 STR or grappled.","es":"+5 al impacto. Impacto: 4 (1d4 + 3) contundente. FUE CD 12 o agarrado."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+5 to hit, range 25/50 ft. Hit: 5 (1d6 + 3) bludgeoning.","es":"+5 al impacto, alcance 7,5/15 m. Impacto: 5 (1d6 + 3) contundente."}} ] },

  {"id":"panther","slug":"panther","name":{"en":"Panther","es":"Pantera"},"size":"Medium","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":13,"roll":"3d8"},
   "speed":{"walk":50,"climb":20},
   "abilities":{"str":14,"dex":15,"con":10,"int":3,"wis":14,"cha":7},
   "skills":[" Perception +4 "," Stealth +6 "],
   "senses":{"en":"passive Perception 14","es":"Percepción pasiva 14"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/4",
   "traits":[
     {"name":{"en":"Keen Smell","es":"Olfato Fino"},
      "text":{"en":"Advantage on Perception using smell.","es":"Ventaja en Percepción basada en olfato."}},
     {"name":{"en":"Pounce","es":"Salto"},
      "text":{"en":"Moves 20+ ft: +1d6 and DC 12 STR or prone.","es":"Si se mueve 6 m+: +1d6 y FUE CD 12 o derribado."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+4 to hit. Hit: 4 (1d6 + 2) piercing.","es":"+4 al impacto. Impacto: 4 (1d6 + 2) perforante."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+4 to hit. Hit: 4 (1d6 + 2) slashing.","es":"+4 al impacto. Impacto: 4 (1d6 + 2) cortante."}} ] },

  {"id":"giant_frog","slug":"giant_frog","name":{"en":"Giant Frog","es":"Rana Gigante"},"size":"Medium","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":11,"hitPoints":{"average":18,"roll":"4d8"},
   "speed":{"walk":20,"swim":40},
   "abilities":{"str":12,"dex":13,"con":11,"int":2,"wis":10,"cha":3},
   "skills":[" Perception +2 "," Stealth +3 "],
   "senses":{"en":"darkvision 30 ft., passive Perception 12","es":"visión en la oscuridad 9 m, Percepción pasiva 12"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/4",
   "traits":[
     {"name":{"en":"Amphibious","es":"Anfibio"},
      "text":{"en":"Breathes air and water.","es":"Respira aire y agua."}},
     {"name":{"en":"Standing Leap","es":"Salto en pie"},
      "text":{"en":"Long jump up to 20 ft and high jump up to 10 ft without a running start.","es":"Salto largo hasta 6 m y alto 3 m sin carrera."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+3 to hit. Hit: 4 (1d6 + 1) piercing. DC 11 STR or 5 (1d10) if in water.","es":"+3 al impacto. Impacto: 4 (1d6 + 1) perforante. FUE CD 11 o 5 (1d10) en agua."}} ] },

  {"id":"giant_owl","slug":"giant_owl","name":{"en":"Giant Owl","es":"Búho Gigante"},"size":"Large","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":19,"roll":"3d10 + 3"},
   "speed":{"walk":5,"fly":60},
   "abilities":{"str":13,"dex":15,"con":12,"int":8,"wis":13,"cha":10},
   "skills":[" Perception +5 "," Stealth +4 "],
   "senses":{"en":"darkvision 120 ft., passive Perception 15","es":"visión en la oscuridad 36 m, Percepción pasiva 15"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1/4",
   "traits":[
     {"name":{"en":"Keen Hearing and Sight","es":"Oído y Vista Finos"},
      "text":{"en":"Advantage on Perception using hearing or sight.","es":"Ventaja en Percepción basada en oído o vista."}},
     {"name":{"en":"Talon of the Sky","es":"Garra del Cielo"},
      "text":{"en":"Flyby: doesn't provoke opportunity attacks when flying out of reach.","es":"Vuelo: no provoca ataques de oportunidad al salir del alcance."}} ],
   "actions":[
     {"name":{"en":"Beak","es":"Pico"},
      "text":{"en":"+5 to hit. Hit: 7 (1d8 + 3) piercing.","es":"+5 al impacto. Impacto: 7 (1d8 + 3) perforante."}},
     {"name":{"en":"Talons","es":"Garras"},
      "text":{"en":"+5 to hit. Hit: 9 (2d6 + 3) slashing. DC 13 STR or grappled.","es":"+5 al impacto. Impacto: 9 (2d6 + 3) cortante. FUE CD 13 o agarrado."}} ] },

  {"id":"polar_bear","slug":"polar_bear","name":{"en":"Polar Bear","es":"Oso Polar"},"size":"Large","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":42,"roll":"5d10 + 15"},
   "speed":{"walk":40,"swim":30},
   "abilities":{"str":20,"dex":10,"con":16,"int":2,"wis":13,"cha":7},
   "skills":{"en":[" Perception +3 "," "],
             "es":[" Percepción +3 "," "]},
   "senses":{"en":"passive Perception 13","es":"Percepción pasiva 13"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"2",
   "traits":[
     {"name":{"en":"Keen Smell","es":"Olfato Fino"},
      "text":{"en":"Advantage on Perception using smell.","es":"Ventaja en Percepción basada en olfato."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Bite + two claws.","es":"Mordisco + dos garras."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+7 to hit. Hit: 9 (1d8 + 5) piercing.","es":"+7 al impacto. Impacto: 9 (1d8 + 5) perforante."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+7 to hit. Hit: 9 (2d4 + 5) slashing.","es":"+7 al impacto. Impacto: 9 (2d4 + 5) cortante."}} ] },

  {"id":"rhinoceros","slug":"rhinoceros","name":{"en":"Rhinoceros","es":"Rinoceronte"},"size":"Large","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":45,"roll":"6d10 + 12"},
   "speed":{"walk":40},
   "abilities":{"str":21,"dex":8,"con":15,"int":2,"wis":12,"cha":6},
   "senses":{"en":"passive Perception 11","es":"Percepción pasiva 11"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"2",
   "traits":[
     {"name":{"en":"Charge","es":"Carga"},
      "text":{"en":"Moves 20+ ft: +2d6 damage. DC 13 STR or knocked prone.","es":"Si se mueve 6 m+: +2d6 daño. FUE CD 13 o derribado."}} ],
   "actions":[
     {"name":{"en":"Gore","es":"Cornada"},
      "text":{"en":"+7 to hit. Hit: 14 (2d8 + 6) piercing.","es":"+7 al impacto. Impacto: 14 (2d8 + 6) perforante."}},
     {"name":{"en":"Stomp","es":"Pisotón"},
      "text":{"en":"+7 to hit. Hit: 14 (2d8 + 6) bludgeoning if target is prone.","es":"+7 al impacto. Impacto: 14 (2d8 + 6) contundente si está derribado."}} ] },

  {"id":"elephant","slug":"elephant","name":{"en":"Elephant","es":"Elefante"},"size":"Huge","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":76,"roll":"8d12 + 24"},
   "speed":{"walk":40},
   "abilities":{"str":22,"dex":9,"con":17,"int":3,"wis":11,"cha":6},
   "senses":{"en":"passive Perception 10","es":"Percepción pasiva 10"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"4",
   "traits":[
     {"name":{"en":"Trampling Charge","es":"Carga de Pisoteo"},
      "text":{"en":"Moves 20+ ft: +2d6 damage and half movement through DC 14 STR or prone.","es":"Si se mueve 6 m+: +2d6 daño y mitad de movimiento para atravesar con salvación FUE CD 14 o derribado."}} ],
   "actions":[
     {"name":{"en":"Gore","es":"Cornada"},
      "text":{"en":"+8 to hit. Hit: 19 (3d8 + 6) piercing.","es":"+8 al impacto. Impacto: 19 (3d8 + 6) perforante."}},
     {"name":{"en":"Stomp","es":"Pisotón"},
      "text":{"en":"+8 to hit. Hit: 17 (3d6 + 6) bludgeoning if prone.","es":"+8 al impacto. Impacto: 17 (3d6 + 6) contundente si derribado."}} ] },

  {"id":"mammoth","slug":"mammoth","name":{"en":"Mammoth","es":"Mamut"},"size":"Huge","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":13,"hitPoints":{"average":126,"roll":"11d12 + 55"},
   "speed":{"walk":40},
   "abilities":{"str":24,"dex":9,"con":21,"int":3,"wis":11,"cha":6},
   "senses":{"en":"passive Perception 10","es":"Percepción pasiva 10"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"6",
   "traits":[
     {"name":{"en":"Trampling Charge","es":"Carga de Pisoteo"},
      "text":{"en":"Moves 20+ ft: +3d8 damage. DC 16 STR or prone.","es":"Si se mueve 6 m+: +3d8 daño. FUE CD 16 o derribado."}} ],
   "actions":[
     {"name":{"en":"Gore","es":"Cornada"},
      "text":{"en":"+10 to hit. Hit: 23 (4d8 + 7) piercing.","es":"+10 al impacto. Impacto: 23 (4d8 + 7) perforante."}},
     {"name":{"en":"Stomp","es":"Pisotón"},
      "text":{"en":"+10 to hit. Hit: 21 (3d10 + 7) bludgeoning if prone.","es":"+10 al impacto. Impacto: 21 (3d10 + 7) contundente si derribado."}} ] },

  {"id":"tyrannosaurus_rex","slug":"tyrannosaurus_rex","name":{"en":"Tyrannosaurus Rex","es":"Tiranosaurio Rex"},"size":"Gargantuan","type":{"en":"beast","es":"bestia"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":13,"hitPoints":{"average":136,"roll":"13d10 + 65"},
   "speed":{"walk":50},
   "abilities":{"str":25,"dex":10,"con":21,"int":2,"wis":12,"cha":9},
   "skills":{"en":[" Perception +4 "],
             "es":[" Percepción +4 "]},
   "senses":{"en":"passive Perception 14","es":"Percepción pasiva 14"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"8",
   "traits":[
     {"name":{"en":"Charge","es":"Carga"},
      "text":{"en":"Moves 30+ ft: +3d6 damage. DC 16 STR or prone.","es":"Si se mueve 9 m+: +3d6 daño. FUE CD 16 o derribado."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+10 to hit. Hit: 33 (4d12 + 7) piercing.","es":"+10 al impacto. Impacto: 33 (4d12 + 7) perforante."}},
     {"name":{"en":"Tail","es":"Cola"},
      "text":{"en":"+10 to hit. Hit: 14 (2d8 + 7) bludgeoning. DC 16 STR or prone.","es":"+10 al impacto. Impacto: 14 (2d8 + 7) contundente. FUE CD 16 o derribado."}} ] },

  # ──────────────────────── ELEMENTALS (3 NEW beyond air/earth/fire/water) ──
  {"id":"invisible_stalker","slug":"invisible_stalker","name":{"en":"Invisible Stalker","es":"Perseguidor Invisible"},"size":"Large","type":{"en":"elemental","es":"elemental"},
   "alignment":{"en":"neutral","es":"neutral"},
   "armorClass":14,"hitPoints":{"average":75,"roll":"10d10 + 20"},
   "speed":{"walk":50,"fly":50},
   "abilities":{"str":16,"dex":19,"con":14,"int":10,"wis":15,"cha":11},
   "skills":{"en":[" Perception +5 "," Stealth +7 "],
             "es":[" Percepción +5 "," Sigilo +7 "]},
   "damageResistances":{"en":"acid, cold, fire, lightning, thunder; bludgeoning, piercing, slashing from nonmagical attacks","es":"ácido, frío, fuego, relámpago, trueno; contundente, perforante, cortante de ataques no mágicos"},
   "conditionImmunities":{"en":"exhaustion, grappled, paralyzed, petrified, poisoned, prone, restrained, unconscious","es":"agotamiento, agarrado, paralizado, petrificado, envenenado, derribado, restringido, inconsciente"},
   "senses":{"en":"darkvision 60 ft., passive Perception 15","es":"visión en la oscuridad 18 m, Percepción pasiva 15"},
   "languages":{"en":"Auran, understands Common but doesn't speak","es":"Auran, entiende Común pero no lo habla"},
   "challengeRating":"6",
   "traits":[
     {"name":{"en":"Invisibility","es":"Invisibilidad"},
      "text":{"en":"Invisible at all times; even magical darkness doesn't reveal it.","es":"Invisible siempre; ni la oscuridad mágica lo revela."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks.","es":"Dos ataques de embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+6 to hit. Hit: 8 (2d4 + 3) bludgeoning.","es":"+6 al impacto. Impacto: 8 (2d4 + 3) contundente."}},
     {"name":{"en":"Cold Ray","es":"Rayo de Frío (recarga 4\u20136)"},"text":{"en":"+7 to hit, range 60 ft. Hit: 23 (4d8 + 4) cold.","es":"+7 al impacto, alcance 18 m. Impacto: 23 (4d8 + 4) frío."}} ] },

  {"id":"djinni","slug":"djinni","name":{"en":"Djinni","es":"Djinni"},"size":"Large","type":{"en":"elemental","es":"elemental"},
   "alignment":{"en":"chaotic good","es":"caótico bueno"},
   "armorClass":17,"hitPoints":{"average":168,"roll":"16d10 + 80"},
   "speed":{"walk":40,"fly":120},
   "abilities":{"str":21,"dex":15,"con":20,"int":15,"wis":16,"cha":18},
   "saves":{"en":[" DEX +7 "," WIS +7 "," CHA +9 "],"es":[" DES +7 "," SAB +7 "," CAR +9 "]},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"darkvision 120 ft., passive Perception 13","es":"visión en la oscuridad 36 m, Percepción pasiva 13"},
   "languages":{"en":"Common, Primordial","es":"Común, Primordial"},
   "challengeRating":"11",
   "traits":[
     {"name":{"en":"Elemental Resistance","es":"Resistencia elemental"},
      "text":{"en":"Resistant to cold (air elemental).","es":"Resistente a frío (elemental de aire)."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks or scimitar + slam.","es":"Dos embestidas o cimitarra + embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+9 to hit. Hit: 14 (2d8 + 5) bludgeoning.","es":"+9 al impacto. Impacto: 14 (2d8 + 5) contundente."}},
     {"name":{"en":"Scimitar","es":"Cimitarra"},
      "text":{"en":"+9 to hit. Hit: 12 (2d8 + 4) slashing + DC 15 STR or prone.","es":"+9 al impacto. Impacto: 12 (2d8 + 4) cortante + FUE CD 15 o derribado."}},
     {"name":{"en":"Whirlwind","es":"Torbellino"},
      "text":{"en":"Recharge 4\u20136: Large or smaller creature in reach DC 18 STR or moved 20 ft + 2d6 bludgeoning.","es":"Recarga 4\u20136: criatura Grande o menor en alcance, FUE CD 18, o movida 6 m + 2d6 contundente."}},
     {"name":{"en":"Create Whirlwind (innate)","es":"Torbellino (innato)"},
      "text":{"en":"3/day: 30-ft cube indoors, sustained concentration, 6 (1d6 + 4) bludgeoning.","es":"3/día: cubo 9 m interior, concentración, 6 (1d6 + 4) contundente."}} ] },

  {"id":"efreeti","slug":"efreeti","name":{"en":"Efreeti","es":"Efreeti"},"size":"Large","type":{"en":"elemental","es":"elemental"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":17,"hitPoints":{"average":168,"roll":"16d10 + 80"},
   "speed":{"walk":40,"fly":60},
   "abilities":{"str":23,"dex":15,"con":20,"int":16,"wis":15,"cha":16},
   "saves":{"en":[" INT +8 "," WIS +7 "],"es":[" INT +8 "," SAB +7 "]},
   "conditionImmunities":{"en":"fire","es":"fuego"},
   "senses":{"en":"darkvision 120 ft., passive Perception 12","es":"visión en la oscuridad 36 m, Percepción pasiva 12"},
   "languages":{"en":"Common, Primordial","es":"Común, Primordial"},
   "challengeRating":"11",
   "traits":[
     {"name":{"en":"Fire Resistance","es":"Resistencia al Fuego"},
      "text":{"en":"Resistant to fire damage.","es":"Resistente a daño de fuego."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam or scimitar attacks.","es":"Dos ataques de embestida o cimitarra."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+10 to hit. Hit: 17 (2d10 + 6) bludgeoning.","es":"+10 al impacto. Impacto: 17 (2d10 + 6) contundente."}},
     {"name":{"en":"Scimitar","es":"Cimitarra"},
      "text":{"en":"+10 to hit. Hit: 13 (1d10 + 6) slashing + 3 (1d6) fire.","es":"+10 al impacto. Impacto: 13 (1d10 + 6) cortante + 3 (1d6) fuego."}},
     {"name":{"en":"Hurl Flame","es":"Lanzallamas"},
      "text":{"en":"+6 to hit, range 150 ft. Hit: 17 (4d6 + 3) fire. DC 15 DEX or 5 (1d10) more fire.","es":"+6 al impacto, alcance 45 m. Impacto: 17 (4d6 + 3) fuego. DES CD 15 o +5 (1d10) fuego."}} ] },

  # ──────────────────────────── GIANTS (6 NEW beyond ogre/oni/troll) ───────
  {"id":"hill_giant","slug":"hill_giant","name":{"en":"Hill Giant","es":"Gigante de Colina"},"size":"Huge","type":{"en":"giant","es":"gigante"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":13,"hitPoints":{"average":105,"roll":"10d12 + 40"},
   "speed":{"walk":40},
   "abilities":{"str":21,"dex":8,"con":19,"int":5,"wis":9,"cha":6},
   "skills":{"en":[" Perception +2 "],"es":[" Percepción +2 "]},
   "senses":{"en":"passive Perception 12","es":"Percepción pasiva 12"},
   "languages":{"en":"Common, Giant","es":"Común, Gigante"},
   "challengeRating":"5",
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two greatclub attacks.","es":"Dos ataques de garrote."}},
     {"name":{"en":"Greatclub","es":"Garrote"},
      "text":{"en":"+8 to hit. Hit: 18 (3d8 + 5) bludgeoning.","es":"+8 al impacto. Impacto: 18 (3d8 + 5) contundente."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+8 to hit, range 60/240 ft. Hit: 21 (3d10 + 5) bludgeoning.","es":"+8 al impacto, alcance 18/72 m. Impacto: 21 (3d10 + 5) contundente."}} ] },

  {"id":"stone_giant","slug":"stone_giant","name":{"en":"Stone Giant","es":"Gigante de Piedra"},"size":"Huge","type":{"en":"giant","es":"gigante"},
   "alignment":{"en":"neutral","es":"neutral"},
   "armorClass":17,"hitPoints":{"average":126,"roll":"11d12 + 55"},
   "speed":{"walk":40},
   "abilities":{"str":23,"dex":15,"con":20,"int":10,"wis":12,"cha":9},
   "saves":{"en":[" DEX +7 "," CON +10 "],"es":[" DES +7 "," CON +10 "]},
   "skills":{"en":[" Athletics +11 "," Perception +6 "],"es":[" Atletismo +11 "," Percepción +6 "]},
   "damageResistances":{"en":"bludgeoning, piercing, slashing from nonmagical attacks","es":"contundente, perforante, cortante no mágico"},
   "senses":{"en":"darkvision 60 ft., passive Perception 16","es":"visión en la oscuridad 18 m, Percepción pasiva 16"},
   "languages":{"en":"Common, Giant","es":"Común, Gigante"},
   "challengeRating":"7",
   "traits":[
     {"name":{"en":"Stone Camouflage","es":"Camuflaje de Piedra"},
      "text":{"en":"Advantage on Stealth in rocky terrain.","es":"Ventaja en Sigilo en terreno rocoso."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two greataxe attacks.","es":"Dos ataques de hacha grande."}},
     {"name":{"en":"Greataxe","es":"Hacha Grande"},
      "text":{"en":"+11 to hit. Hit: 28 (3d12 + 9) slashing.","es":"+11 al impacto. Impacto: 28 (3d12 + 9) cortante."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+11 to hit, range 60/240 ft. Hit: 28 (3d10 + 9) bludgeoning.","es":"+11 al impacto, alcance 18/72 m. Impacto: 28 (3d10 + 9) contundente."}} ] },

  {"id":"fire_giant","slug":"fire_giant","name":{"en":"Fire Giant","es":"Gigante de Fuego"},"size":"Huge","type":{"en":"giant","es":"gigante"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":18,"hitPoints":{"average":162,"roll":"13d12 + 65"},
   "speed":{"walk":40},
   "abilities":{"str":25,"dex":9,"con":21,"int":10,"wis":14,"cha":13},
   "saves":{"en":[" DEX +4 "," CON +10 "," WIS +7 "],"es":[" DES +4 "," CON +10 "," SAB +7 "]},
   "skills":{"en":[" Athletics +12 "," Perception +7 "],"es":[" Atletismo +12 "," Percepción +7 "]},
   "damageImmunities":{"en":"fire","es":"fuego"},
   "senses":{"en":"passive Perception 17","es":"Percepción pasiva 17"},
   "languages":{"en":"Common, Giant","es":"Común, Gigante"},
   "challengeRating":"9",
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two greatsword attacks.","es":"Dos ataques de espadazo."}},
     {"name":{"en":"Greatsword","es":"Espadazo"},
      "text":{"en":"+12 to hit. Hit: 28 (6d6 + 7) slashing + 9 (2d8) fire.","es":"+12 al impacto. Impacto: 28 (6d6 + 7) cortante + 9 (2d8) fuego."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+12 to hit, range 60/240 ft. Hit: 28 (4d10 + 7) bludgeoning.","es":"+12 al impacto, alcance 18/72 m. Impacto: 28 (4d10 + 7) contundente."}} ] },

  {"id":"frost_giant","slug":"frost_giant","name":{"en":"Frost Giant","es":"Gigante de Escarcha"},"size":"Huge","type":{"en":"giant","es":"gigante"},
   "alignment":{"en":"neutral evil","es":"neutral maligno"},
   "armorClass":17,"hitPoints":{"average":138,"roll":"12d12 + 60"},
   "speed":{"walk":40},
   "abilities":{"str":23,"dex":9,"con":21,"int":9,"wis":10,"cha":12},
   "saves":{"en":[" CON +10 "],"es":[" CON +10 "]},
   "skills":{"en":[" Athletics +11 "," Perception +5 "],"es":[" Atletismo +11 "," Percepción +5 "]},
   "damageImmunities":{"en":"cold","es":"frío"},
   "senses":{"en":"passive Perception 15","es":"Percepción pasiva 15"},
   "languages":{"en":"Common, Giant","es":"Común, Gigante"},
   "challengeRating":"8",
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two greataxe attacks.","es":"Dos ataques de hacha grande."}},
     {"name":{"en":"Greataxe","es":"Hacha Grande"},
      "text":{"en":"+11 to hit. Hit: 25 (3d12 + 7) slashing + 9 (2d8) cold.","es":"+11 al impacto. Impacto: 25 (3d12 + 7) cortante + 9 (2d8) frío."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+11 to hit, range 60/240 ft. Hit: 25 (4d8 + 7) bludgeoning.","es":"+11 al impacto, alcance 18/72 m. Impacto: 25 (4d8 + 7) contundente."}} ] },

  {"id":"cloud_giant","slug":"cloud_giant","name":{"en":"Cloud Giant","es":"Gigante de Nubes"},"size":"Huge","type":{"en":"giant","es":"gigante"},
   "alignment":{"en":"neutral good (50%) or chaotic good (50%)","es":"neutral bueno (50%) o caótico bueno (50%)"},
   "armorClass":14,"hitPoints":{"average":200,"roll":"16d12 + 96"},
   "speed":{"walk":40},
   "abilities":{"str":27,"dex":10,"con":22,"int":12,"wis":16,"cha":16},
   "saves":{"en":[" STR +14 "," CON +11 "," WIS +9 "," CHA +9 "],"es":[" FUE +14 "," CON +11 "," SAB +9 "," CAR +9 "]},
   "skills":{"en":[" Athletics +14 "," Insight +9 "," Perception +9 "],"es":[" Atletismo +14 "," Percepción +9 "," Intuición +9 "]},
   "senses":{"en":"passive Perception 19","es":"Percepción pasiva 19"},
   "languages":{"en":"Common, Giant","es":"Común, Gigante"},
   "challengeRating":"9",
   "traits":[
     {"name":{"en":"Keen Smell","es":"Olfato Fino"},
      "text":{"en":"Advantage on Perception using smell.","es":"Ventaja en Percepción basada en olfato."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two morningstar attacks.","es":"Dos ataques de lucero del alba."}},
     {"name":{"en":"Morningstar","es":"Lucero del Alba"},
      "text":{"en":"+14 to hit. Hit: 27 (3d8 + 10) piercing.","es":"+14 al impacto. Impacto: 27 (3d8 + 10) perforante."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+14 to hit, range 60/240 ft. Hit: 30 (4d10 + 10) bludgeoning.","es":"+14 al impacto, alcance 18/72 m. Impacto: 30 (4d10 + 10) contundente."}} ] },

  {"id":"storm_giant","slug":"storm_giant","name":{"en":"Storm Giant","es":"Gigante de Tormenta"},"size":"Huge","type":{"en":"giant","es":"gigante"},
   "alignment":{"en":"chaotic good","es":"caótico bueno"},
   "armorClass":16,"hitPoints":{"average":230,"roll":"20d12 + 100"},
   "speed":{"walk":50,"swim":50,"fly":150},
   "abilities":{"str":29,"dex":14,"con":20,"int":16,"wis":18,"cha":18},
   "saves":{"en":[" STR +15 "," DEX +8 "," CON +11 "," INT +9 "," WIS +10 "],"es":[" FUE +15 "," DES +8 "," CON +11 "," INT +9 "," SAB +10 "]},
   "skills":{"en":[" Athletics +15 "," Perception +10 "],"es":[" Atletismo +15 "," Percepción +10 "]},
   "damageResistances":{"en":"lightning, thunder; bludgeoning, piercing, slashing from nonmagical attacks","es":"relámpago, trueno; contundente, perforante, cortante no mágico"},
   "senses":{"en":"passive Perception 20","es":"Percepción pasiva 20"},
   "languages":{"en":"Common, Giant","es":"Común, Gigante"},
   "challengeRating":"13",
   "traits":[
     {"name":{"en":"Amphibious","es":"Anfibio"},
      "text":{"en":"Breathes air and water.","es":"Respira aire y agua."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two greatsword attacks.","es":"Dos ataques de espadazo."}},
     {"name":{"en":"Greatsword","es":"Espadazo"},
      "text":{"en":"+15 to hit. Hit: 30 (4d10 + 10) slashing.","es":"+15 al impacto. Impacto: 30 (4d10 + 10) cortante."}},
     {"name":{"en":"Rock","es":"Roca"},
      "text":{"en":"+15 to hit, range 60/240 ft. Hit: 32 (4d10 + 10) bludgeoning.","es":"+15 al impacto, alcance 18/72 m. Impacto: 32 (4d10 + 10) contundente."}},
     {"name":{"en":"Lightning Strike","es":"Golpe de Relámpago (recarga 5\u20136)"},
      "text":{"en":"+8 to hit, range 120 ft. Hit: 27 (4d12) lightning.","es":"+8 al impacto, alcance 36 m. Impacto: 27 (4d12) relámpago."}} ] },

  # ──────────────────────────── CONSTRUCTS (6 NEW beyond animated_armor/flying_sword) ─
  {"id":"homunculus","slug":"homunculus","name":{"en":"Homunculus","es":"Homúnculo"},"size":"Tiny","type":{"en":"construct","es":"constructo"},
   "alignment":{"en":"neutral","es":"neutral"},
   "armorClass":13,"hitPoints":{"average":2,"roll":"1d4"},
   "speed":{"walk":20,"fly":40},
   "abilities":{"str":4,"dex":15,"con":10,"int":6,"wis":10,"cha":7},
   "skills":{"en":[" Perception +4 "],
             "es":[" Percepción +4 "]},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"charmed, exhaustion, poisoned","es":"encantado, agotamiento, envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 14","es":"visión en la oscuridad 18 m, Percepción pasiva 14"},
   "languages":{"en":"understands the language of its creator but can't speak","es":"entiende el idioma de su creador pero no habla"},
   "challengeRating":"0",
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+4 to hit. Hit: 1 piercing + DC 10 CON or 1d4 poison.","es":"+4 al impacto. Impacto: 1 perforante + CON CD 10 o 1d4 veneno."}} ] },

  {"id":"rug_of_smothering","slug":"rug_of_smothering","name":{"en":"Rug of Smothering","es":"Alfombra Sofocante"},"size":"Large","type":{"en":"construct","es":"constructo"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":12,"hitPoints":{"average":33,"roll":"6d10"},
   "speed":{"walk":10},
   "abilities":{"str":17,"dex":14,"con":10,"int":1,"wis":3,"cha":1},
   "senses":{"en":"blindsight 60 ft., passive Perception 6","es":"visión ciega 18 m, Percepción pasiva 6"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "conditionImmunities":{"en":"blinded, prone","es":"ceguera, derribado"},
   "challengeRating":"2",
   "actions":[
     {"name":{"en":"Smother","es":"Sofocar"},
      "text":{"en":"+5 to hit. Hit: target grappled, DC 12 STR ends each turn; 2d6 bludgeoning if start in grapple.","es":"+5 al impacto. Impacto: agarrado, FUE CD 12 termina cada turno; 2d6 contundente si empieza agarrado."}} ] },

  {"id":"shield_guardian","slug":"shield_guardian","name":{"en":"Shield Guardian","es":"Guardián del Escudo"},"size":"Large","type":{"en":"construct","es":"constructo"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":17,"hitPoints":{"average":142,"roll":"15d10 + 60"},
   "speed":{"walk":30},
   "abilities":{"str":18,"dex":8,"con":18,"int":7,"wis":12,"cha":3},
   "saves":{"en":" CON +9 "},
   "skills":{"en":[" Perception +6 "],"es":[" Percepción +6 "]},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, poisoned","es":"encantado, agotamiento, asustado, paralizado, envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 16","es":"visión en la oscuridad 18 m, Percepción pasiva 16"},
   "languages":{"en":"understands commands of its master","es":"entiende comandos de su maestro"},
   "challengeRating":"7",
   "traits":[
     {"name":{"en":"Bound","es":"Vinculado"},
      "text":{"en":"Reduced to 0 HP if master within 60 ft and reduced to 0 HP; reverse true.","es":"Reducido a 0 pg si su amo está a 18 m y reducido a 0 pg; al revés también."}},
     {"name":{"en":"Regeneration","es":"Regeneración"},
      "text":{"en":"Regains 10 HP at start of turn if HP > 0.","es":"Recupera 10 pg al inicio del turno si pg > 0."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks.","es":"Dos ataques de embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+7 to hit. Hit: 13 (2d8 + 4) bludgeoning.","es":"+7 al impacto. Impacto: 13 (2d8 + 4) contundente."}},
     {"name":{"en":"Shield","es":"Escudo (recarga 6)"},
      "text":{"en":"As reaction: ally +5 AC for 1 round.","es":"Reacción: aliado +5 CA por 1 turno."}} ] },

  {"id":"clay_golem","slug":"clay_golem","name":{"en":"Clay Golem","es":"Gólem de Arcilla"},"size":"Large","type":{"en":"construct","es":"constructo"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":14,"hitPoints":{"average":133,"roll":"14d10 + 56"},
   "speed":{"walk":30},
   "abilities":{"str":20,"dex":9,"con":18,"int":3,"wis":8,"cha":1},
   "saves":{"en":[" CON +9 "],"es":[" CON +9 "]},
   "damageImmunities":{"en":"poison, psychic; bludgeoning, piercing, slashing from nonmagical attacks that aren't adamantine","es":"veneno, psíquico; contundente, perforante, cortante no mágico adamantino"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 11","es":"visión en la oscuridad 18 m, Percepción pasiva 11"},
   "languages":{"en":"understands the language of its creator","es":"entiende el idioma de su creador"},
   "challengeRating":"9",
   "traits":[
     {"name":{"en":"Acid Absorption","es":"Absorción de Ácido"},
      "text":{"en":"Whenever acid damage, heals 2 HP per 1 damage.","es":"Ante daño ácido, cura 2 pg por 1 daño."}},
     {"name":{"en":"Berserk","es":"Berserker"},
      "text":{"en":"At 0 HP: melee attack nearest creature (random).","es":"A 0 pg: ataque cuerpo a cuerpo a la criatura más cercana (al azar)."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks.","es":"Dos ataques de embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+9 to hit. Hit: 15 (2d10 + 5) bludgeoning. DC 16 CON or 10 (3d6) acid damage and poisoned.","es":"+9 al impacto. Impacto: 15 (2d10 + 5) contundente. CON CD 16 o 10 (3d6) ácido + envenenado."}},
     {"name":{"en":"Haste","es":"Prisa (recarga 6)"},
      "text":{"en":"Self: advantage on attacks, +2 AC, extra action: one slam.","es":"Yo mismo: ventaja en ataques, +2 CA, acción extra: una embestida."}} ] },

  {"id":"stone_golem","slug":"stone_golem","name":{"en":"Stone Golem","es":"Gólem de Piedra"},"size":"Large","type":{"en":"construct","es":"constructo"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":17,"hitPoints":{"average":178,"roll":"17d10 + 85"},
   "speed":{"walk":30},
   "abilities":{"str":22,"dex":9,"con":20,"int":3,"wis":11,"cha":1},
   "saves":{"en":[" CON +10 "],"es":[" CON +10 "]},
   "damageImmunities":{"en":"poison, psychic; bludgeoning, piercing, slashing from nonmagical attacks that aren't adamantine","es":"veneno, psíquico; contundente, perforante, cortante no mágico adamantino"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado"},
   "senses":{"en":"darkvision 120 ft., passive Perception 13","es":"visión en la oscuridad 36 m, Percepción pasiva 13"},
   "languages":{"en":"understands the language of its creator","es":"entiende el idioma de su creador"},
   "challengeRating":"10",
   "traits":[
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells and magical effects.","es":"Ventaja en salvaciones contra conjuros y efectos mágicos."}},
     {"name":{"en":"Magic Weapons","es":"Armas Mágicas"},
      "text":{"en":"Slam counts as magical for resistance purposes.","es":"Embestida cuenta como mágica para resistencias."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks.","es":"Dos ataques de embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+10 to hit. Hit: 19 (3d8 + 6) bludgeoning.","es":"+10 al impacto. Impacto: 19 (3d8 + 6) contundente."}},
     {"name":{"en":"Slow","es":"Lentitud (recarga 5\u20136)"},
      "text":{"en":"DC 17 WIS or 2d6 force damage and speed halved + can't take reactions; ends save end of turn.","es":"SAB CD 17 o 2d6 fuerza + velocidad mitad + sin reacciones; termina salvando fin de turno."}} ] },

  {"id":"iron_golem","slug":"iron_golem","name":{"en":"Iron Golem","es":"Gólem de Hierro"},"size":"Large","type":{"en":"construct","es":"constructo"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":20,"hitPoints":{"average":210,"roll":"20d10 + 100"},
   "speed":{"walk":30},
   "abilities":{"str":24,"dex":9,"con":20,"int":3,"wis":11,"cha":1},
   "saves":{"en":[" CON +10 "],"es":[" CON +10 "]},
   "damageImmunities":{"en":"fire, poison, psychic; bludgeoning, piercing, slashing from nonmagical attacks that aren't adamantine","es":"fuego, veneno, psíquico; contundente, perforante, cortante no mágico adamantino"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado"},
   "senses":{"en":"darkvision 120 ft., passive Perception 13","es":"visión en la oscuridad 36 m, Percepción pasiva 13"},
   "languages":{"en":"understands the language of its creator","es":"entiende el idioma de su creador"},
   "challengeRating":"16",
   "traits":[
     {"name":{"en":"Fire Absorption","es":"Absorción de Fuego"},
      "text":{"en":"Fire damage heals HP equal to damage taken.","es":"Daño de fuego cura pg igual al daño recibido."}},
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells and magical effects.","es":"Ventaja en salvaciones contra conjuros y efectos mágicos."}},
     {"name":{"en":"Magic Weapons","es":"Armas Mágicas"},
      "text":{"en":"Slam and sword count as magical.","es":"Embestida y espada cuentan como mágicas."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks or sword + slam.","es":"Dos embestidas o espada + embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+13 to hit. Hit: 23 (3d8 + 7) bludgeoning.","es":"+13 al impacto. Impacto: 23 (3d8 + 7) contundente."}},
     {"name":{"en":"Sword","es":"Espada"},
      "text":{"en":"+13 to hit. Hit: 20 (3d10 + 7) slashing.","es":"+13 al impacto. Impacto: 20 (3d10 + 7) cortante."}},
     {"name":{"en":"Poison Breath","es":"Aliento de Veneno (recarga 5\u20136)"},
      "text":{"en":"30-ft cone, CON 19, half on success, 18 (4d8) poison. 30 ft immune thereafter.","es":"Cono 9 m, CON 19, mitad éxito, 18 (4d8) veneno. 9 m inmune después."}} ] },
]

# ───────────────────────────── localize walker ─────────────────────────────

SPANISH_OVERRIDES: dict[str, dict[str, str]] = {}

def localize(val, lang):
    if isinstance(val, dict) and "en" in val and "es" in val and set(val.keys()) <= {"en", "es"}:
        return val.get(lang, "")
    if isinstance(val, list):
        return [localize(v, lang) for v in val]
    if isinstance(val, dict):
        return {k: localize(v, lang) for k, v in val.items()}
    return val

# ───────────────────────────── main merge & write ───────────────────────────

def proficiency_bonus_for(cr) -> int:
    if cr in PB_BY_CR: return PB_BY_CR[cr]
    try:
        crn = float(cr)
    except (TypeError, ValueError):
        return 2
    if crn < 5: return 2
    if crn < 9: return 3
    if crn < 13: return 4
    if crn < 17: return 5
    if crn < 21: return 6
    if crn < 25: return 7
    if crn < 29: return 8
    return 9

def experience_for(cr) -> int:
    if isinstance(cr, str) and cr in XP_BY_CR: return XP_BY_CR[cr]
    if cr in XP_BY_CR: return XP_BY_CR[cr]
    try:
        crn = float(cr)
    except (TypeError, ValueError):
        return 10
    if crn < 1: return 10
    if crn < 5: return [200,450,700,1100][int(crn)-1] if 1 <= int(crn) <= 4 else 200
    return 1800

def main():
    added_total = 0
    skipped_total = 0
    for lang in ("en", "es"):
        langdir = EN_DIR if lang == "en" else ES_DIR
        added = 0
        skipped = []
        for m in MONSTERS:
            mid = m["id"]
            out_path = langdir / f"{mid}.json"
            if out_path.exists():
                skipped.append(mid)
                continue
            # Build per-language record (localized flat fields)
            localized = localize(m, lang)
            # Auto-fill proficiencyBonus and experiencePoints from CR
            cr_val = localized.get("challengeRating", "0")
            localized["proficiencyBonus"] = proficiency_bonus_for(cr_val)
            localized["experiencePoints"] = experience_for(cr_val)
            # Standard envelope fields
            localized.setdefault("slug", mid)
            localized["lang"] = lang
            localized["source"] = "SRD 5.2 (2024)"
            # Write
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(localized, f, ensure_ascii=False, indent=2)
            added += 1
        print(f"  {lang}: added {added} / skipped {len(skipped)} (already present)")
        added_total += added
        skipped_total += len(skipped)
    print(f"TOTAL: added {added_total} / skipped {skipped_total}")

if __name__ == "__main__":
    main()
