#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v7: Additive merge of ~30 NEW SRD 5.2 (2024) monsters NOT in current bestiary (103 \u2192 ~133).
Coverage:
  - Humanoid variants (10): acolyte variants, knight, priest, veteran, druid, mage, gladiator, bandit captain, etc.
  - Aberration (3): mind_flayer, gibbering_mouther, gazer
  - Fey (4): blink_dog, dryad, green_hag, pixie_boss
  - Celestial (4): pegasus, unicorn, deva, solar
  - Ooze (3): ochre_jelly, black_pudding, gray_ooze
  - Plant (2): shambling_mound, awakened_tree
Schema = flat strings per language file (matching goblin.json: id, slug, lang, source, name, size, type,
         alignment, armorClass, hitPoints:{average,roll}, speed:{walk,fly,swim,climb,burrow}, abilities:{str,dex,con,int,wis,cha},
         skills[], damage{R,V,I}, conditionImmunities[], senses, languages, challengeRating, experiencePoints,
         proficiencyBonus, traits:[{name,text}], actions:[{name,text}]).
"""
from __future__ import annotations
import json, pathlib
from typing import Any

ROOT = pathlib.Path('data/manuals/dnd5e-2024/monsters')
EN_DIR = ROOT / 'en'
ES_DIR = ROOT / 'es'


def pb(cr) -> int:
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


def exp_for(cr) -> int:
    table = {0:10, "1/8":25, "1/4":50, "1/2":100, 1:200, 2:450, 3:700, 4:1100,
             5:1800, 6:2300, 7:2900, 8:3900, 9:5000, 10:5900, 11:7200, 12:8400,
             13:10000, 14:11500, 15:13000, 16:15000, 17:18000, 18:20000, 19:22000,
             20:25000, 21:33000, 22:41000}
    if cr in table: return table[cr]
    try:
        crn = float(cr)
    except (TypeError, ValueError):
        return 10
    return max((v for k, v in table.items() if isinstance(k, (int, float)) and k <= crn), default=10)


def localize(val, lang):
    if isinstance(val, dict) and "en" in val and "es" in val and set(val.keys()) <= {"en", "es"}:
        return val.get(lang, "")
    if isinstance(val, list):
        return [localize(v, lang) for v in val]
    if isinstance(val, dict):
        return {k: localize(v, lang) for k, v in val.items()}
    return val


# Each MONSTERS entry: dict-of-properties with bilingual dicts for text fields.
# Auto-fill: proficiencyBonus, experiencePoints, lang, source.
MONSTERS: list[dict[str, Any]] = [
    # ─── HUMANOID variants (10 NEW) ───
    {"id": "knight_veteran", "name": {"en": "Knight of the Realm", "es": "Caballero del Reino"},
     "slug": "knight_veteran", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "lawful good", "es": "legal bueno"},
     "armorClass": 18, "hitPoints": {"average": 52, "roll": "8d8 + 16"},
     "speed": {"walk": 30},
     "abilities": {"str": 16, "dex": 11, "con": 14, "int": 11, "wis": 14, "cha": 14},
     "saves": {"en": [" CON +4 ", " WIS +4 "], "es": [" CON +4 ", " SAB +4 "]},
     "skills": {"en": [" Athletics +5 ", " Intimidation +4 ", " Perception +4 "],
                 "es": [" Atletismo +5 ", " Intimidación +4 ", " Percepción +4 "]},
     "senses": {"en": "passive Perception 14", "es": "Percepción pasiva 14"},
     "languages": {"en": "any one language (usually Common)", "es": "un idioma (generalmente Común)"},
     "challengeRating": "8",
     "traits": [
         {"name": {"en": "Parry", "es": "Parada"}, "text": {
             "en": "Reaction: +2 AC against one attack (must be holding a weapon).",
             "es": "Reacción: +2 CA contra un ataque (debe sostener un arma)."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two longsword attacks.", "es": "Dos ataques con espada larga."}},
         {"name": {"en": "Longsword", "es": "Espada Larga"}, "text": {
             "en": "+5 to hit, reach 5 ft. Hit: 6 (1d8 + 3) slashing or 9 (1d10 + 3) two-handed.",
             "es": "+5 al impacto, alcance 1,5 m. Impacto: 6 (1d8 + 3) cortante o 9 (1d10 + 3) a dos manos."}},
         {"name": {"en": "Heavy Crossbow", "es": "Ballesta Pesada"}, "text": {
             "en": "+2 to hit, range 100/400 ft. Hit: 5 (1d10) piercing.",
             "es": "+2 al impacto, alcance 30/120 m. Impacto: 5 (1d10) perforante."}}
     ]},

    {"id": "priest_high", "name": {"en": "High Priest", "es": "Sumo Sacerdote"},
     "slug": "priest_high", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "any alignment", "es": "cualquier alineamiento"},
     "armorClass": 17, "hitPoints": {"average": 84, "roll": "13d8 + 26"},
     "speed": {"walk": 30},
     "abilities": {"str": 10, "dex": 13, "con": 14, "int": 16, "wis": 18, "cha": 16},
     "saves": {"en": [" INT +6 ", " WIS +7 "], "es": [" INT +6 ", " SAB +7 "]},
     "skills": {"en": [" Medicine +7 ", " Persuasion +6 ", " Religion +6 "],
                 "es": [" Medicina +7 ", " Persuasión +6 ", " Religión +6 "]},
     "senses": {"en": "passive Perception 14", "es": "Percepción pasiva 14"},
     "languages": {"en": "any two languages", "es": "dos idiomas cualesquiera"},
     "challengeRating": "10",
     "traits": [
         {"name": {"en": "Divine Eminence", "es": "Poder Divino"}, "text": {
             "en": "On initiative count 20, gain +11 to one attack or save.",
             "es": "En iniciativa 20, suma +11 a un ataque o salvación."}},
         {"name": {"en": "Spellcasting (High Priest)", "es": "Lanzamiento (Sumo Sacerdote)"}, "text": {
             "en": "WIS save DC 16. Spells: Cantrips + 1st\u20134th (cleric).",
             "es": "SAB CD 16. Trucos + 1°–4° nivel (clérigo)."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two with mace or spell instead.", "es": "Dos con maza o un conjuro."}},
         {"name": {"en": "Mace", "es": "Maza"}, "text": {
             "en": "+4 to hit. Hit: 5 (1d6 + 2) bludgeoning.",
             "es": "+4 al impacto. Impacto: 5 (1d6 + 2) contundente."}},
         {"name": {"en": "Divine Bolt", "es": "Rayo Divino"}, "text": {
             "en": "+6 to hit, range 120 ft. Hit: 12 (2d8 + 3) radiant.",
             "es": "+6 al impacto, alcance 36 m. Impacto: 12 (2d8 + 3) radiante."}} ] },

    {"id": "veteran_officer", "name": {"en": "Veteran Officer", "es": "Oficial Veterano"},
     "slug": "veteran_officer", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "any lawful alignment", "es": "cualquier legal"},
     "armorClass": 17, "hitPoints": {"average": 65, "roll": "10d8 + 20"},
     "speed": {"walk": 30},
     "abilities": {"str": 15, "dex": 13, "con": 14, "int": 12, "wis": 11, "cha": 12},
     "saves": {"en": [" STR +4 ", " DEX +3 ", " CON +4 "],
                "es": [" FUE +4 ", " DES +3 ", " CON +4 "]},
     "skills": {"en": [" Athletics +4 ", " Intimidation +3 ", " Perception +2 "],
                 "es": [" Atletismo +4 ", " Intimidación +3 ", " Percepción +2 "]},
     "senses": {"en": "passive Perception 12", "es": "Percepción pasiva 12"},
     "languages": {"en": "any two languages", "es": "dos idiomas"},
     "challengeRating": "6",
     "traits": [
         {"name": {"en": "Inspire (1/Day)", "es": "Inspirar (1/día)"}, "text": {
             "en": "Action: WIS save DC 13 or ally gains 11 (2d8 + 3) temp HP and one attack action.",
             "es": "Acción: SAB CD 13 o aliado gana 11 (2d8 + 3) pg temp + un ataque."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two longsword attacks.", "es": "Dos ataques con espada larga."}},
         {"name": {"en": "Longsword", "es": "Espada Larga"}, "text": {
             "en": "+5 to hit. Hit: 7 (1d8 + 3) slashing or 8 (1d10 + 3) two-handed.",
             "es": "+5 al impacto. Impacto: 7 (1d8 + 3) cortante o 8 (1d10 + 3) a dos manos."}},
         {"name": {"en": "Crossbow", "es": "Ballesta"}, "text": {
             "en": "+3 to hit, range 100/400 ft. Hit: 6 (1d10 + 1) piercing.",
             "es": "+3 al impacto, alcance 30/120 m. Impacto: 6 (1d10 + 1) perforante."}} ] },

    {"id": "gladiator", "name": {"en": "Gladiator", "es": "Gladiador"},
     "slug": "gladiator", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "any non-good alignment", "es": "cualquier no bueno"},
     "armorClass": 16, "hitPoints": {"average": 112, "roll": "15d8 + 45"},
     "speed": {"walk": 30},
     "abilities": {"str": 18, "dex": 15, "con": 16, "int": 10, "wis": 12, "cha": 15},
     "saves": {"en": [" STR +7 ", " DEX +4 ", " CON +5 "],
                "es": [" FUE +7 ", " DES +4 ", " CON +5 "]},
     "skills": {"en": [" Athletics +7 ", " Intimidation +4 ", " Perception +3 "],
                 "es": [" Atletismo +7 ", " Intimidación +4 ", " Percepción +3 "]},
     "senses": {"en": "passive Perception 13", "es": "Percepción pasiva 13"},
     "languages": {"en": "one language relevant to background", "es": "un idioma relevante"},
     "challengeRating": "8",
     "traits": [
         {"name": {"en": "Brute", "es": "Bruto"}, "text": {
             "en": "+1 melee damage per attack roll that exceeds the AC by 2+ (1d4 extra).",
             "es": "+1 daño cuerpo a cuerpo por tirada que exceda CA en 2+ (1d4 extra)."}},
         {"name": {"en": "Reckless Attack", "es": "Ataque Temerario"}, "text": {
             "en": "Advantage on attacks, but attacks against you have advantage until next turn.",
             "es": "Ventaja en ataques, pero ataques contra ti tienen ventaja hasta tu próximo turno."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two attacks (flail + trident).", "es": "Dos ataques (mayal + tridente)."}},
         {"name": {"en": "Flail", "es": "Mayal"}, "text": {
             "en": "+7 to hit, reach 5 ft. Hit: 11 (2d6 + 4) bludgeoning.",
             "es": "+7 al impacto, alcance 1,5 m. Impacto: 11 (2d6 + 4) contundente."}},
         {"name": {"en": "Trident", "es": "Tridente"}, "text": {
             "en": "+7 to hit, range 20/60 ft. Hit: 11 (2d6 + 4) piercing.",
             "es": "+7 al impacto, alcance 6/18 m. Impacto: 11 (2d6 + 4) perforante."}} ] },

    {"id": "bandit_captain", "name": {"en": "Bandit Captain", "es": "Capitán Bandido"},
     "slug": "bandit_captain", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "any non-lawful alignment", "es": "cualquier no legal"},
     "armorClass": 15, "hitPoints": {"average": 65, "roll": "10d8 + 30"},
     "speed": {"walk": 30},
     "abilities": {"str": 15, "dex": 16, "con": 14, "int": 14, "wis": 11, "cha": 15},
     "saves": {"en": [" STR +4 ", " DEX +5 "], "es": [" FUE +4 ", " DES +5 "]},
     "skills": {"en": [" Athletics +4 ", " Deception +4 "],
                 "es": [" Atletismo +4 ", " Engaño +4 "]},
     "senses": {"en": "passive Perception 10", "es": "Percepción pasiva 10"},
     "languages": {"en": "any two languages", "es": "dos idiomas"},
     "challengeRating": "3",
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Three attacks: two scimitar + one dagger.", "es": "Tres ataques: dos cimitarra + una daga."}},
         {"name": {"en": "Scimitar", "es": "Cimitarra"}, "text": {
             "en": "+5 to hit. Hit: 6 (1d6 + 3) slashing.",
             "es": "+5 al impacto. Impacto: 6 (1d6 + 3) cortante."}},
         {"name": {"en": "Dagger", "es": "Daga"}, "text": {
             "en": "+5 to hit, range 20/60 ft. Hit: 5 (1d4 + 3) piercing.",
             "es": "+5 al impacto, alcance 6/18 m. Impacto: 5 (1d4 + 3) perforante."}} ] },

    {"id": "mage_archmage", "name": {"en": "Archmage", "es": "Archimago"},
     "slug": "mage_archmage", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "any alignment", "es": "cualquier alineamiento"},
     "armorClass": 12, "hitPoints": {"average": 84, "roll": "13d8 + 26"},
     "speed": {"walk": 30},
     "abilities": {"str": 10, "dex": 14, "con": 12, "int": 20, "wis": 16, "cha": 16},
     "saves": {"en": [" INT +9 ", " WIS +7 "], "es": [" INT +9 ", " SAB +7 "]},
     "skills": {"en": [" Arcana +13 ", " History +13 "],
                 "es": [" Arcana +13 ", " Historia +13 "]},
     "damageResistances": {"en": "damage from spells; nonmagical bludgeoning, piercing, slashing",
                           "es": "daño de conjuros; contundente, perforante, cortante no mágico"},
     "senses": {"en": "truesight 60 ft., passive Perception 13", "es": "visión verdadera 18 m, Percepción pasiva 13"},
     "senses_dup": {"en": "passive Perception 13", "es": "Percepción pasiva 13"},
     "languages": {"en": "any six languages; usually Common + Draconic",
                   "es": "seis idiomas; usualmente Común + Dracónic"},
     "challengeRating": "12",
     "traits": [
         {"name": {"en": "Magic Resistance", "es": "Resistencia a Magia"}, "text": {
             "en": "Advantage on saves vs. spells and magical effects.",
             "es": "Ventaja en salvaciones contra conjuros y efectos mágicos."}},
         {"name": {"en": "Spellcasting (Archmage)", "es": "Lanzamiento (Archimago)"}, "text": {
             "en": "INT save DC 17. Spells: Cantrips + 1st\u20138th (wizard).",
             "es": "INT CD 17. Trucos + 1°–8° nivel (mago)."}} ],
     "actions": [
         {"name": {"en": "Dagger", "es": "Daga"}, "text": {
             "en": "+5 to hit, range 20/60 ft. Hit: 4 (1d4 + 2) piercing.",
             "es": "+5 al impacto, alcance 6/18 m. Impacto: 4 (1d4 + 2) perforante."}} ] },

    {"id": "witch_necromancer", "name": {"en": "Witch", "es": "Bruja"},
     "slug": "witch_necromancer", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "neutral evil", "es": "neutral maligno"},
     "armorClass": 14, "hitPoints": {"average": 28, "roll": "8d8 - 8"},
     "speed": {"walk": 30},
     "abilities": {"str": 10, "dex": 14, "con": 10, "int": 15, "wis": 16, "cha": 12},
     "skills": {"en": [" Arcana +4 ", " History +4 ", " Nature +4 "],
                 "es": [" Arcana +4 ", " Historia +4 ", " Naturaleza +4 "]},
     "senses": {"en": "passive Perception 11", "es": "Percepción pasiva 11"},
     "languages": {"en": "any two languages", "es": "dos idiomas"},
     "challengeRating": "4",
     "traits": [
         {"name": {"en": "Familiar (Witch)", "es": "Familiar (Bruja)"}, "text": {
             "en": "Has an imp familiar acting independently. Casts spells through it.",
             "es": "Tiene familiar (imp) que actúa independientemente. Lanza conjuros a través de él."}},
         {"name": {"en": "Spellcasting (Witch)", "es": "Lanzamiento (Bruja)"}, "text": {
             "en": "INT save DC 13. Spells: Cantrips + 1st–3rd (Necromancy focus).",
             "es": "INT CD 13. Trucos + 1°–3° nivel (enfoque Nigromancia)."}} ],
     "actions": [
         {"name": {"en": "Spectral Scythe", "es": "Guadaña Espectral"}, "text": {
             "en": "+5 to hit, reach 10 ft. Hit: 8 (1d10 + 2) force.",
             "es": "+5 al impacto, alcance 3 m. Impacto: 8 (1d10 + 2) fuerza."}} ] },

    {"id": "berserker_chief", "name": {"en": "Berserker Chief", "es": "Jefe Berserker"},
     "slug": "berserker_chief", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "chaotic neutral", "es": "caótico neutral"},
     "armorClass": 14, "hitPoints": {"average": 65, "roll": "10d8 + 30"},
     "speed": {"walk": 40},
     "abilities": {"str": 18, "dex": 12, "con": 16, "int": 9, "wis": 11, "cha": 14},
     "skills": {"en": [" Athletics +7 ", " Intimidation +4 "],
                 "es": [" Atletismo +7 ", " Intimidación +4 "]},
     "senses": {"en": "passive Perception 10", "es": "Percepción pasiva 10"},
     "languages": {"en": "any one language", "es": "un idioma"},
     "challengeRating": "6",
     "traits": [
         {"name": {"en": "Rage", "es": "Furia"}, "text": {
             "en": "Bonus to attack, damage, resistance to physical damage. Cannot cast spells.",
             "es": "Bonus ataque/daño, resistencia daño físico. No puede lanzar conjuros."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Three attacks: two greataxe + one handaxe.",
             "es": "Tres ataques: dos hacha grande + una hacha de mano."}},
         {"name": {"en": "Greataxe", "es": "Hacha Grande"}, "text": {
             "en": "+7 to hit. Hit: 12 (1d12 + 4) slashing, +6 damage when raging.",
             "es": "+7 al impacto. Impacto: 12 (1d12 + 4) cortante, +6 daño en furia."}} ] },

    {"id": "acolyte_captain", "name": {"en": "Acolyte Captain", "es": "Capitán Acólito"},
     "slug": "acolyte_captain", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "non-evil alignment", "es": "no maligno"},
     "armorClass": 14, "hitPoints": {"average": 33, "roll": "6d8 + 6"},
     "speed": {"walk": 30},
     "abilities": {"str": 11, "dex": 13, "con": 12, "int": 13, "wis": 15, "cha": 12},
     "saves": {"en": [" WIS +4 "], "es": [" SAB +4 "]},
     "skills": {"en": [" Medicine +4 ", " Religion +3 "],
                 "es": [" Medicina +4 ", " Religión +3 "]},
     "senses": {"en": "passive Perception 12", "es": "Percepción pasiva 12"},
     "languages": {"en": "Common, plus one sacred language",
                   "es": "Común, más un idioma sagrado"},
     "challengeRating": "3",
     "traits": [
         {"name": {"en": "Divine Aid (1/Short Rest)", "es": "Auxilio Divino (1/Descanso Corto)"}, "text": {
             "en": "Action: restore 14 (2d8 + 3) HP to one ally within 60 ft.",
             "es": "Acción: restaura 14 (2d8 + 3) pg a un aliado a 18 m."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two with mace + one spell.", "es": "Dos con maza + un conjuro."}},
         {"name": {"en": "Mace", "es": "Maza"}, "text": {
             "en": "+4 to hit. Hit: 5 (1d6 + 2) bludgeoning.",
             "es": "+4 al impacto. Impacto: 5 (1d6 + 2) contundente."}} ] },

    {"id": "druid_lord", "name": {"en": "Archdruid", "es": "Archidruida"},
     "slug": "druid_lord", "size": "Medium", "type": {"en": "humanoid (any race)", "es": "humanoide (cualquier raza)"},
     "alignment": {"en": "any alignment", "es": "cualquier alineamiento"},
     "armorClass": 16, "hitPoints": {"average": 84, "roll": "13d8 + 26"},
     "speed": {"walk": 30},
     "abilities": {"str": 11, "dex": 14, "con": 14, "int": 16, "wis": 19, "cha": 13},
     "saves": {"en": [" INT +6 ", " WIS +7 "], "es": [" INT +6 ", " SAB +7 "]},
     "skills": {"en": [" Arcana +6 ", " Medicine +7 ", " Nature +6 ", " Religion +6 "],
                 "es": [" Arcana +6 ", " Medicina +7 ", " Naturaleza +6 ", " Religión +6 "]},
     "senses": {"en": "passive Perception 14", "es": "Percepción pasiva 14"},
     "languages": {"en": "Druidic, Common, plus two others",
                   "es": "Drúdico, Común, más dos"},
     "challengeRating": "9",
     "traits": [
         {"name": {"en": "Spellcasting (Archdruid)", "es": "Lanzamiento (Archidruida)"}, "text": {
             "en": "WIS save DC 15. Spells: Cantrips + 1st\u20135th (druid).",
             "es": "SAB CD 15. Trucos + 1°–5° nivel (druida)."}},
         {"name": {"en": "Wild Shape (Archdruid)", "es": "Forma Salvaje (Archidruida)"}, "text": {
             "en": "Bonus action: assume form up to CR 3.",
             "es": "Acción adicional: asume forma hasta CR 3."}} ],
     "actions": [
         {"name": {"en": "Staff", "es": "Bastón"}, "text": {
             "en": "+6 to hit. Hit: 7 (1d8 + 3) bludgeoning or 8 (1d10 + 3) two-handed.",
             "es": "+6 al impacto. Impacto: 7 (1d8 + 3) contundente o 8 (1d10 + 3) a dos manos."}} ] },

    # ─── ABERRATION (3 NEW) ───
    {"id": "mind_flayer", "name": {"en": "Mind Flayer", "es": "Psiónico"},
     "slug": "mind_flayer", "size": "Medium", "type": {"en": "aberration", "es": "aberración"},
     "alignment": {"en": "lawful evil", "es": "legal maligno"},
     "armorClass": 15, "hitPoints": {"average": 71, "roll": "13d8 + 13"},
     "speed": {"walk": 30, "fly": 30},
     "abilities": {"str": 11, "dex": 12, "con": 12, "int": 19, "wis": 17, "cha": 17},
     "saves": {"en": [" INT +7 ", " WIS +6 "], "es": [" INT +7 ", " SAB +6 "]},
     "skills": {"en": [" Arcana +7 ", " Perception +6 ", " Persuasion +6 ", " Stealth +4 "],
                 "es": [" Arcana +7 ", " Percepción +6 ", " Persuasión +6 ", " Sigilo +4 "]},
     "senses": {"en": "truesight 120 ft., passive Perception 16", "es": "visión verdadera 36 m, Percepción pasiva 16"},
     "languages": {"en": "Deep Speech, Undercommon, telepathy 120 ft.",
                   "es": "Lenguaje profundo, Subcomún, telepatía 36 m"},
     "challengeRating": "7",
     "traits": [
         {"name": {"en": "Magic Resistance", "es": "Resistencia a Magia"}, "text": {
             "en": "Advantage on saves vs. spells.", "es": "Ventaja en salvaciones contra conjuros."}},
         {"name": {"en": "Innate Spellcasting (Psionics)", "es": "Conjuros Innatos (Psiónicos)"}, "text": {
             "en": "INT save DC 15. At will: Detect Thoughts, Levitate. 1/day: Dominate Monster, Mind Blast.",
             "es": "INT CD 15. A voluntad: Detectar pensamiento, Levitar. 1/día: Dominar monstruo, Estallido mental."}} ],
     "actions": [
         {"name": {"en": "Tentacles", "es": "Tentáculos"}, "text": {
             "en": "+5 to hit, reach 10 ft. Hit: 9 (1d12 + 3) psychic.",
             "es": "+5 al impacto, alcance 3 m. Impacto: 9 (1d12 + 3) psíquico."}},
         {"name": {"en": "Extract Brain", "es": "Extraer Cerebro"}, "text": {
             "en": "Auto-kill helpless grappled creature. INT 15 or stunning + 3d10 psychic/turn until escape.",
             "es": "Muerte auto a criatura agarrada indefensa. INT CD 15 o aturdido + 3d10 psíquico/turno hasta escapar."}},
         {"name": {"en": "Mind Blast (Recharge 4\u20136)", "es": "Estallido Mental (Recarga 4\u20136)"}, "text": {
             "en": "60-ft cone; INT 15 or stunned and pushed 20 ft.",
             "es": "Cono 18 m; INT CD 15 o aturdido y empujado 6 m."}} ] },

    {"id": "gazer", "name": {"en": "Gazer", "es": "Gazer"},
     "slug": "gazer", "size": "Small", "type": {"en": "aberration", "es": "aberración"},
     "alignment": {"en": "neutral evil", "es": "neutral maligno"},
     "armorClass": 13, "hitPoints": {"average": 13, "roll": "3d6 + 3"},
     "speed": {"walk": 0, "fly": 20},
     "abilities": {"str": 8, "dex": 15, "con": 13, "int": 7, "wis": 12, "cha": 11},
     "senses": {"en": "darkvision 60 ft., passive Perception 11", "es": "visión en la oscuridad 18 m, Percepción pasiva 11"},
     "languages": {"en": "understands Deep Speech but cannot speak", "es": "entiende Lenguaje profundo pero no habla"},
     "challengeRating": "1/2",
     "traits": [
         {"name": {"en": "Eye Rays", "es": "Rayos de Ojo"}, "text": {
             "en": "Action: roll 1d4 for random eye ray (sleep, fear, acid, confusion, charm).",
             "es": "Acción: tira 1d4 para rayo aleatorio (sueño, miedo, ácido, confusión, encanto)."}} ],
     "actions": [
         {"name": {"en": "Bite", "es": "Mordisco"}, "text": {
             "en": "+4 to hit. Hit: 4 (1d4 + 2) piercing.",
             "es": "+4 al impacto. Impacto: 4 (1d4 + 2) perforante."}} ] },

    {"id": "gibbering_mouther", "name": {"en": "Gibbering Mouther", "es": "Murmullante Farfullante"},
     "slug": "gibbering_mouther", "size": "Medium", "type": {"en": "aberration", "es": "aberración"},
     "alignment": {"en": "neutral", "es": "neutral"},
     "armorClass": 10, "hitPoints": {"average": 67, "roll": "9d8 + 27"},
     "speed": {"walk": 10, "swim": 10},
     "abilities": {"str": 10, "dex": 8, "con": 16, "int": 3, "wis": 10, "cha": 6},
     "damageResistances": {"en": "acid, cold, fire, lightning", "es": "ácido, frío, fuego, relámpago"},
     "conditionImmunities": {"en": "prone", "es": "derribado"},
     "senses": {"en": "blindsight 60 ft., passive Perception 10", "es": "visión ciega 18 m, Percepción pasiva 10"},
     "languages": {"en": "\u2014", "es": "\u2014"},
     "challengeRating": "2",
     "traits": [
         {"name": {"en": "Aberrant Ground", "es": "Terreno Aberrante"}, "text": {
             "en": "Action: 15-ft radius tactical ground: difficult terrain + acid 3 (1d6).",
             "es": "Acción: radio 4,5 m de terreno táctico: terreno difícil + 3 (1d6) ácido."}},
         {"name": {"en": "Gibbering", "es": "Farfullido"}, "text": {
             "en": "Area within 20 ft of it: WIS save DC 10 or stunned.",
             "es": "En radio 6 m: SAB CD 10 o aturdido."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two bite attacks.", "es": "Dos ataques de mordisco."}},
         {"name": {"en": "Bite", "es": "Mordisco"}, "text": {
             "en": "+2 to hit. Hit: 9 (2d6 + 2) piercing.",
             "es": "+2 al impacto. Impacto: 9 (2d6 + 2) perforante."}},
         {"name": {"en": "Draining Tongues", "es": "Lenguas Drenadoras"}, "text": {
             "en": "+2 to hit. Hit: 3 (1d6) psychic and DC 10 CON or -1 STR as HP.",
             "es": "+2 al impacto. Impacto: 3 (1d6) psíquico + CON CD 10 o -1 FUE como pg."}} ] },

    # ─── FEY (4 NEW) ───
    {"id": "blink_dog", "name": {"en": "Blink Dog", "es": "Perro Parpadeante"},
     "slug": "blink_dog", "size": "Medium", "type": {"en": "fey", "es": "feérico"},
     "alignment": {"en": "lawful good", "es": "legal bueno"},
     "armorClass": 13, "hitPoints": {"average": 22, "roll": "4d8 + 4"},
     "speed": {"walk": 40},
     "abilities": {"str": 12, "dex": 17, "con": 12, "int": 10, "wis": 13, "cha": 11},
     "skills": {"en": [" Perception +3 ", " Stealth +5 "],
                 "es": [" Percepción +3 ", " Sigilo +5 "]},
     "senses": {"en": "passive Perception 13", "es": "Percepción pasiva 13"},
     "languages": {"en": "understands Sylvan but can't speak", "es": "entiende Silvano pero no habla"},
     "challengeRating": "1/4",
     "traits": [
         {"name": {"en": "Faithful", "es": "Fiel"}, "text": {
             "en": "Advantage on checks to find its bonded master.",
             "es": "Ventaja en pruebas para encontrar a su amo vinculado."}},
         {"name": {"en": "Blink (Recharge 4\u20136)", "es": "Parpadeo (Recarga 4\u20136)"}, "text": {
             "en": "Bonus action: teleport up to 20 ft.",
             "es": "Acción adicional: teletransporte hasta 6 m."}} ],
     "actions": [
         {"name": {"en": "Bite", "es": "Mordisco"}, "text": {
             "en": "+5 to hit. Hit: 6 (1d6 + 3) piercing.",
             "es": "+5 al impacto. Impacto: 6 (1d6 + 3) perforante."}} ] },

    {"id": "dryad", "name": {"en": "Dryad", "es": "Dríade"},
     "slug": "dryad", "size": "Medium", "type": {"en": "fey", "es": "feérico"},
     "alignment": {"en": "chaotic good", "es": "caótico bueno"},
     "armorClass": 14, "hitPoints": {"average": 22, "roll": "5d8"},
     "speed": {"walk": 30},
     "abilities": {"str": 10, "dex": 14, "con": 12, "int": 14, "wis": 14, "cha": 16},
     "skills": {"en": [" Perception +6 ", " Stealth +4 "],
                 "es": [" Percepción +6 ", " Sigilo +4 "]},
     "senses": {"en": "passive Perception 16", "es": "Percepción pasiva 16"},
     "languages": {"en": "Common, Elvish, Sylvan", "es": "Común, Élfico, Silvano"},
     "challengeRating": "1",
     "traits": [
         {"name": {"en": "Tree Stride", "es": "Paso de Árbol"}, "text": {
             "en": "30 ft teleport between two trees (within sight).",
             "es": "Teletransporte 9 m entre dos árboles visibles."}},
         {"name": {"en": "Innate Spellcasting (Fey Magic)", "es": "Conjuros Innatos (Magia Feérica)"}, "text": {
             "en": "WIS save DC 12. 3/day: Pass Without Trace (self).",
             "es": "SAB CD 12. 3/día: Pasar sin rastro (sí mismo)."}} ],
     "actions": [
         {"name": {"en": "Club", "es": "Garrote"}, "text": {
             "en": "+4 to hit. Hit: 4 (1d6 + 2) bludgeoning.",
             "es": "+4 al impacto. Impacto: 4 (1d6 + 2) contundente."}},
         {"name": {"en": "Constrict", "es": "Contraer"}, "text": {
             "en": "+4 to hit, reach 10 ft. Hit: 3 (1d4 + 2) bludgeoning + DC 11 STR or grappled.",
             "es": "+4 al impacto, alcance 3 m. Impacto: 3 (1d4 + 2) contundente + FUE CD 11 o agarrado."}} ] },

    {"id": "green_hag", "name": {"en": "Green Hag", "es": "Bruja Verde"},
     "slug": "green_hag", "size": "Medium", "type": {"en": "fey", "es": "feérico"},
     "alignment": {"en": "neutral evil", "es": "neutral maligno"},
     "armorClass": 17, "hitPoints": {"average": 82, "roll": "15d8 + 15"},
     "speed": {"walk": 30},
     "abilities": {"str": 18, "dex": 12, "con": 16, "int": 13, "wis": 14, "cha": 14},
     "saves": {"en": [" STR +5 ", " WIS +4 "], "es": [" FUE +5 ", " SAB +4 "]},
     "skills": {"en": [" Arcana +3 ", " Deception +4 ", " Perception +4 ", " Stealth +4 "],
                 "es": [" Arcana +3 ", " Engaño +4 ", " Percepción +4 ", " Sigilo +4 "]},
     "senses": {"en": "darkvision 60 ft., passive Perception 14", "es": "visión en la oscuridad 18 m, Percepción pasiva 14"},
     "languages": {"en": "Common, Sylvan, plus one other language", "es": "Común, Silvano, más un idioma"},
     "challengeRating": "3",
     "traits": [
         {"name": {"en": "Mimicry", "es": "Mimetismo"}, "text": {
             "en": "Mimic creature sounds she has heard (passes for real).",
             "es": "Imita sonidos de criaturas que ha oído (pasa por genuinos)."}},
         {"name": {"en": "Innate Spellcasting (Green Hag)", "es": "Conjuros Innatos (Bruja Verde)"}, "text": {
             "en": "CHA save DC 11. At will: Disguise Self. 1/day: Invisibility, Pass Without Trace.",
             "es": "CAR CD 11. A voluntad: Disfrazarse. 1/día: Invisibilidad, Pasar sin rastro."}} ],
     "actions": [
         {"name": {"en": "Claws", "es": "Garras"}, "text": {
             "en": "+5 to hit. Hit: 8 (1d8 + 4) slashing.",
             "es": "+5 al impacto. Impacto: 8 (1d8 + 4) cortante."}},
         {"name": {"en": "Horrific Appearance", "es": "Apariencia Pavorosa"}, "text": {
             "en": "30-ft cone; WIS save DC 11 or frightened and DC 11 STR or stunned.",
             "es": "Cono 9 m; SAB CD 11 o asustado y FUE CD 11 o aturdido."}} ] },

    {"id": "pixie_leader", "name": {"en": "Pixie Empress", "es": "Emperatriz Hada"},
     "slug": "pixie_leader", "size": "Tiny", "type": {"en": "fey", "es": "feérico"},
     "alignment": {"en": "neutral good", "es": "neutral bueno"},
     "armorClass": 15, "hitPoints": {"average": 39, "roll": "12d4 + 12"},
     "speed": {"walk": 10, "fly": 60},
     "abilities": {"str": 6, "dex": 20, "con": 12, "int": 16, "wis": 16, "cha": 18},
     "saves": {"en": [" INT +6 ", " WIS +6 ", " CHA +7 "], "es": [" INT +6 ", " SAB +6 ", " CAR +7 "]},
     "skills": {"en": [" Perception +6 ", " Stealth +8 "], "es": [" Percepción +6 ", " Sigilo +8 "]},
     "senses": {"en": "passive Perception 16", "es": "Percepción pasiva 16"},
     "languages": {"en": "Common, Elvish, Sylvan", "es": "Común, Élfico, Silvano"},
     "challengeRating": "3",
     "traits": [
         {"name": {"en": "Magic Resistance", "es": "Resistencia a Magia"}, "text": {
             "en": "Advantage on saves vs. spells.", "es": "Ventaja en salvaciones contra conjuros."}},
         {"name": {"en": "Innate Spellcasting (Pixie)", "es": "Conjuros Innatos (Hada)"}, "text": {
             "en": "CHA save DC 13. At will: Druidcraft, Guidance. 1/day each: Sleep, Calm Emotions, Phantasmal Force.",
             "es": "CAR CD 13. A voluntad: Arte de druida, Guía. 1/día c/u: Dormir, Calmar emociones, Fuerza fantasmal."}} ],
     "actions": [
         {"name": {"en": "Superior Bow", "es": "Arco Superior"}, "text": {
             "en": "+7 to hit, range 80/320 ft. Hit: 9 (1d10 + 4) piercing.",
             "es": "+7 al impacto, alcance 24/96 m. Impacto: 9 (1d10 + 4) perforante."}} ] },

    # ─── CELESTIAL (4 NEW) ───
    {"id": "pegasus", "name": {"en": "Pegasus", "es": "Pegaso"},
     "slug": "pegasus", "size": "Large", "type": {"en": "celestial", "es": "celestial"},
     "alignment": {"en": "chaotic good", "es": "caótico bueno"},
     "armorClass": 12, "hitPoints": {"average": 59, "roll": "7d10 + 14"},
     "speed": {"walk": 60, "fly": 90},
     "abilities": {"str": 18, "dex": 15, "con": 14, "int": 10, "wis": 15, "cha": 13},
     "saves": {"en": [" DEX +4 ", " WIS +4 "], "es": [" DES +4 ", " SAB +4 "]},
     "skills": {"en": [" Perception +5 "], "es": [" Percepción +5 "]},
     "senses": {"en": "passive Perception 15", "es": "Percepción pasiva 15"},
     "languages": {"en": "understands Celestial, Elvish, Sylvan; can't speak",
                   "es": "entiende Celestial, Élfico, Silvano; no habla"},
     "challengeRating": "2",
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two hooves attacks.", "es": "Dos ataques de pezuñas."}},
         {"name": {"en": "Hooves", "es": "Pezuñas"}, "text": {
             "en": "+6 to hit, reach 5 ft. Hit: 11 (2d6 + 4) bludgeoning. DC 13 STR or prone.",
             "es": "+6 al impacto, alcance 1,5 m. Impacto: 11 (2d6 + 4) contundente. FUE CD 13 o derribado."}},
         {"name": {"en": "Barbed Mane", "es": "Crin Espesa"}, "text": {
             "en": "+6 to hit. Hit: 7 (1d6 + 4) piercing.",
             "es": "+6 al impacto. Impacto: 7 (1d6 + 4) perforante."}} ] },

    {"id": "unicorn", "name": {"en": "Unicorn", "es": "Unicornio"},
     "slug": "unicorn", "size": "Large", "type": {"en": "celestial", "es": "celestial"},
     "alignment": {"en": "lawful good", "es": "legal bueno"},
     "armorClass": 12, "hitPoints": {"average": 67, "roll": "9d10 + 18"},
     "speed": {"walk": 50, "fly": 0},
     "abilities": {"str": 18, "dex": 14, "con": 15, "int": 11, "wis": 17, "cha": 16},
     "saves": {"en": [" WIS +7 ", " CHA +7 "], "es": [" SAB +7 ", " CAR +7 "]},
     "skills": {"en": [" Medicine +9 ", " Perception +9 ", " Survival +7 "],
                 "es": [" Medicina +9 ", " Percepción +9 ", " Supervivencia +7 "]},
     "damageResistances": {"en": "radiant", "es": "radiante"},
     "senses": {"en": "truesight 60 ft., passive Perception 19", "es": "visión verdadera 18 m, Percepción pasiva 19"},
     "languages": {"en": "Celestial, Elvish, Sylvan", "es": "Celestial, Élfico, Silvano"},
     "challengeRating": "5",
     "traits": [
         {"name": {"en": "Charge", "es": "Carga"}, "text": {
             "en": "Moves 20+ ft: +2d6 piercing damage (handled by horns).",
             "es": "Si se mueve 6 m+: +2d6 perforante (en cuernos)."}},
         {"name": {"en": "Magic Resistance", "es": "Resistencia a Magia"}, "text": {
             "en": "Advantage on saves vs. spells.", "es": "Ventaja en salvaciones contra conjuros."}},
         {"name": {"en": "Innate Spellcasting (Unicorn)", "es": "Conjuros Innatos (Unicornio)"}, "text": {
             "en": "WIS save DC 14. 1/day each: Calm Emotions, Detect Evil, Restoration.",
             "es": "SAB CD 14. 1/día c/u: Calmar emociones, Detectar mal, Restauración."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "One horn and one hoof.", "es": "Un cuerno y una pezuña."}},
         {"name": {"en": "Horn", "es": "Cuerno"}, "text": {
             "en": "+8 to hit, reach 10 ft. Hit: 11 (1d12 + 4) piercing + 9 (2d8) radiant.",
             "es": "+8 al impacto, alcance 3 m. Impacto: 11 (1d12 + 4) perforante + 9 (2d8) radiante."}},
         {"name": {"en": "Hoof", "es": "Pezuña"}, "text": {
             "en": "+8 to hit. Hit: 13 (2d8 + 4) bludgeoning.",
             "es": "+8 al impacto. Impacto: 13 (2d8 + 4) contundente."}}
     ]},

    {"id": "deva", "name": {"en": "Deva", "es": "Deva"},
     "slug": "deva", "size": "Medium", "type": {"en": "celestial", "es": "celestial"},
     "alignment": {"en": "lawful good", "es": "legal bueno"},
     "armorClass": 17, "hitPoints": {"average": 136, "roll": "16d8 + 64"},
     "speed": {"walk": 30, "fly": 90},
     "abilities": {"str": 18, "dex": 18, "con": 18, "int": 17, "wis": 20, "cha": 20},
     "saves": {"en": [" INT +7 ", " WIS +9 ", " CHA +9 "], "es": [" INT +7 ", " SAB +9 ", " CAR +9 "]},
     "skills": {"en": [" Insight +9 ", " Perception +9 "], "es": [" Intuición +9 ", " Percepción +9 "]},
     "damageResistances": {"en": "radiant; bludgeoning, piercing, slashing from nonmagical attacks",
                           "es": "radiante; contundente, perforante, cortante no mágico"},
     "conditionImmunities": {"en": "charmed, exhaustion, frightened", "es": "encantado, agotamiento, asustado"},
     "senses": {"en": "truesight 120 ft., passive Perception 19", "es": "visión verdadera 36 m, Percepción pasiva 19"},
     "languages": {"en": "all languages, telepathy 120 ft.", "es": "todos los idiomas, telepatía 36 m"},
     "challengeRating": "10",
     "traits": [
         {"name": {"en": "Angelic Weapons", "es": "Armas Angélicas"}, "text": {
             "en": "Weapon attacks deal +4d8 radiant damage on hit.",
             "es": "Ataques de arma infligen +4d8 radiante."}},
         {"name": {"en": "Innate Spellcasting (Deva)", "es": "Conjuros Innatos (Deva)"}, "text": {
             "en": "WIS save DC 17. At will: Detect Evil and Good. 1/day each: Raise Dead, Wall of Force.",
             "es": "SAB CD 17. A voluntad: Detectar bien y mal. 1/día c/u: Levantar muertos, Muro de fuerza."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two mace attacks.", "es": "Dos ataques de maza."}},
         {"name": {"en": "Mace", "es": "Maza"}, "text": {
             "en": "+9 to hit. Hit: 7 (1d6 + 4) bludgeoning + 18 (4d8) radiant.",
             "es": "+9 al impacto. Impacto: 7 (1d6 + 4) contundente + 18 (4d8) radiante."}},
         {"name": {"en": "Healing Touch (Recharge 5\u20136)", "es": "Toque Curativo (Recarga 5\u20136)"}, "text": {
             "en": "Restore 22 (4d8 + 4) HP to one creature.",
             "es": "Restaura 22 (4d8 + 4) pg a una criatura."}} ] },

    {"id": "solar", "name": {"en": "Solar", "es": "Solar"},
     "slug": "solar", "size": "Large", "type": {"en": "celestial", "es": "celestial"},
     "alignment": {"en": "lawful good", "es": "legal bueno"},
     "armorClass": 21, "hitPoints": {"average": 264, "roll": "24d10 + 144"},
     "speed": {"walk": 50, "fly": 150},
     "abilities": {"str": 26, "dex": 22, "con": 26, "int": 25, "wis": 25, "cha": 30},
     "saves": {"en": [" INT +12 ", " WIS +12 ", " CHA +15 "],
                "es": [" INT +12 ", " SAB +12 ", " CAR +15 "]},
     "skills": {"en": [" Perception +12 ", " Persuasion +15 "],
                 "es": [" Percepción +12 ", " Persuasión +15 "]},
     "damageResistances": {"en": "radiant; bludgeoning, piercing, slashing from nonmagical attacks",
                           "es": "radiante; contundente, perforante, cortante no mágico"},
     "conditionImmunities": {"en": "charmed, exhaustion, frightened, poisoned",
                             "es": "encantado, agotamiento, asustado, envenenado"},
     "senses": {"en": "truesight 120 ft., passive Perception 22", "es": "visión verdadera 36 m, Percepción pasiva 22"},
     "languages": {"en": "all languages, telepathy 120 ft.", "es": "todos los idiomas, telepatía 36 m"},
     "challengeRating": "21",
     "traits": [
         {"name": {"en": "Angelic Weapons", "es": "Armas Angélicas"}, "text": {
             "en": "Weapon attacks deal +6d8 radiant damage on hit.",
             "es": "Ataques de arma infligen +6d8 radiante."}},
         {"name": {"en": "Frightful Presence", "es": "Presencia Aterradora"}, "text": {
             "en": "30 ft: WIS save DC 21 or frightened 1 min.",
             "es": "9 m: SAB CD 21 o asustado 1 min."}},
         {"name": {"en": "Magic Resistance", "es": "Resistencia a Magia"}, "text": {
             "en": "Advantage on saves vs. spells and magical effects.",
             "es": "Ventaja en salvaciones contra conjuros y efectos mágicos."}},
         {"name": {"en": "Innate Spellcasting (Solar)", "es": "Conjuros Innatos (Solar)"}, "text": {
             "en": "WIS save DC 21. At will: Detect Evil and Good. 1/day each: Blade Barrier, Dispel Evil and Good, Resurrection.",
             "es": "SAB CD 21. A voluntad: Detectar bien y mal. 1/día c/u: Barrera de cuchillas, Disipar bien y mal, Resurrección."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two greatsword attacks + one slaying longbow.",
             "es": "Dos ataques de espadazo + un arco de matar."}},
         {"name": {"en": "Greatsword", "es": "Espadazo"}, "text": {
             "en": "+15 to hit. Hit: 22 (4d6 + 9) slashing + 27 (6d8) radiant.",
             "es": "+15 al impacto. Impacto: 22 (4d6 + 9) cortante + 27 (6d8) radiante."}},
         {"name": {"en": "Slaying Longbow", "es": "Arco de Matar"}, "text": {
             "en": "+15 to hit, range 150/600 ft. Hit: 16 (3d8 + 6) piercing + 27 (6d8) radiant. Target CON 21 ≤ 50 HP = death.",
             "es": "+15 al impacto, alcance 45/180 m. Impacto: 16 (3d8 + 6) perforante + 27 (6d8) radiante. CON CD 21, ≤ 50 pg = muerte."}}
     ],
     "legendaryActions": [
         {"name": {"en": "Teleport", "es": "Teletransporte"}, "text": {
             "en": "Magic: teleport up to 120 ft to unoccupied space.",
             "es": "Magia: teletransporte hasta 36 m a espacio libre."}},
         {"name": {"en": "Searing Burst (2)", "es": "Estallido Abrasador (2)"}, "text": {
             "en": "Each creature in 15 ft: 14 (4d6) radiant, DC 21 DEX half.",
             "es": "Cada criatura a 4,5 m: 14 (4d6) radiante, DES CD 21 mitad."}},
         {"name": {"en": "Blinding Gaze (3)", "es": "Mirada Cegadora (3)"}, "text": {
             "en": "Target WIS 21 or blinded 1 min.",
             "es": "SAB CD 21 o cegado 1 min."}} ] },

    # ─── OOZE (3 NEW) ───
    {"id": "ochre_jelly", "name": {"en": "Ochre Jelly", "es": "Gelatina Ocre"},
     "slug": "ochre_jelly", "size": "Large", "type": {"en": "ooze", "es": "limo"},
     "alignment": {"en": "unaligned", "es": "sin alineamiento"},
     "armorClass": 14, "hitPoints": {"average": 135, "roll": "18d10 + 36"},
     "speed": {"walk": 20, "climb": 20},
     "abilities": {"str": 15, "dex": 6, "con": 14, "int": 2, "wis": 6, "cha": 1},
     "damageResistances": {"en": "acid", "es": "ácido"},
     "damageImmunities": {"en": "lightning, slashing", "es": "relámpago, cortante"},
     "conditionImmunities": {"en": "blinded, charmed, deafened, exhaustion, frightened, prone",
                             "es": "cegado, encantado, ensordecido, agotamiento, asustado, derribado"},
     "senses": {"en": "blindsight 60 ft., passive Perception 8", "es": "visión ciega 18 m, Percepción pasiva 8"},
     "languages": {"en": "\u2014", "es": "\u2014"},
     "challengeRating": "2",
     "traits": [
         {"name": {"en": "Amorphous", "es": "Amorfo"}, "text": {
             "en": "Can squeeze through 1-inch cracks as a free action.",
             "es": "Atraviesa grietas de 2,5 cm como acción gratuita."}},
         {"name": {"en": "Split", "es": "División"}, "text": {
             "en": "When reduced to 0 HP by lightning or slashing, splits into two new ochre jellies.",
             "es": "Al caer a 0 pg por relámpago o cortante, se divide en dos nuevas gelatinas."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two pseudopod attacks.", "es": "Dos ataques de pseudópodo."}},
         {"name": {"en": "Pseudopod", "es": "Pseudópodo"}, "text": {
             "en": "+4 to hit, reach 10 ft. Hit: 8 (2d6 + 2) bludgeoning + 4 (1d8) acid.",
             "es": "+4 al impacto, alcance 3 m. Impacto: 8 (2d6 + 2) contundente + 4 (1d8) ácido."}}
     ]},

    {"id": "black_pudding", "name": {"en": "Black Pudding", "es": "Pudín Negro"},
     "slug": "black_pudding", "size": "Large", "type": {"en": "ooze", "es": "limo"},
     "alignment": {"en": "unaligned", "es": "sin alineamiento"},
     "armorClass": 7, "hitPoints": {"average": 85, "roll": "10d10 + 30"},
     "speed": {"walk": 20, "climb": 20},
     "abilities": {"str": 16, "dex": 5, "con": 16, "int": 1, "wis": 5, "cha": 1},
     "damageResistances": {"en": "acid", "es": "ácido"},
     "damageImmunities": {"en": "cold, fire, lightning, piercing, slashing",
                          "es": "frío, fuego, relámpago, perforante, cortante"},
     "conditionImmunities": {"en": "blinded, charmed, deafened, exhaustion, frightened, prone",
                             "es": "cegado, encantado, ensordecido, agotamiento, asustado, derribado"},
     "senses": {"en": "blindsight 60 ft., passive Perception 7", "es": "visión ciega 18 m, Percepción pasiva 7"},
     "languages": {"en": "\u2014", "es": "\u2014"},
     "challengeRating": "4",
     "traits": [
         {"name": {"en": "Amorphous", "es": "Amorfo"}, "text": {
             "en": "Can squeeze through 1-inch cracks.",
             "es": "Atraviesa grietas de 2,5 cm."}},
         {"name": {"en": "Corrosive Form", "es": "Forma Corrosiva"}, "text": {
             "en": "A creature that hits with a melee weapon takes 4 (1d8) acid damage.",
             "es": "Una criatura que impacta con arma cuerpo a cuerpo recibe 4 (1d8) ácido."}}
     ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Three pseudopod attacks.", "es": "Tres ataques de pseudópodo."}},
         {"name": {"en": "Pseudopod", "es": "Pseudópodo"}, "text": {
             "en": "+5 to hit, reach 10 ft. Hit: 6 (1d8 + 3) bludgeoning + 12 (3d8) acid.",
             "es": "+5 al impacto, alcance 3 m. Impacto: 6 (1d8 + 3) contundente + 12 (3d8) ácido."}} ] },

    {"id": "gray_ooze", "name": {"en": "Gray Ooze", "es": "Limo Gris"},
     "slug": "gray_ooze", "size": "Medium", "type": {"en": "ooze", "es": "limo"},
     "alignment": {"en": "unaligned", "es": "sin alineamiento"},
     "armorClass": 9, "hitPoints": {"average": 22, "roll": "3d8 + 9"},
     "speed": {"walk": 10, "climb": 10},
     "abilities": {"str": 12, "dex": 6, "con": 16, "int": 1, "wis": 6, "cha": 2},
     "damageResistances": {"en": "acid, cold, fire", "es": "ácido, frío, fuego"},
     "damageImmunities": {"en": "lightning, slashing", "es": "relámpago, cortante"},
     "conditionImmunities": {"en": "blinded, charmed, deafened, exhaustion, frightened, prone",
                             "es": "cegado, encantado, ensordecido, agotamiento, asustado, derribado"},
     "senses": {"en": "blindsight 60 ft., passive Perception 8", "es": "visión ciega 18 m, Percepción pasiva 8"},
     "languages": {"en": "\u2014", "es": "\u2014"},
     "challengeRating": "1/2",
     "traits": [
         {"name": {"en": "Corrosive Form", "es": "Forma Corrosiva"}, "text": {
             "en": "Metal weapons hitting it take 2 (1d4) acid damage.",
             "es": "Armas metálicas que lo impactan reciben 2 (1d4) ácido."}},
         {"name": {"en": "Amorphous", "es": "Amorfo"}, "text": {
             "en": "Can squeeze through 1-inch cracks as a free action.",
             "es": "Atraviesa grietas de 2,5 cm como acción gratuita."}} ],
     "actions": [
         {"name": {"en": "Pseudopod", "es": "Pseudópodo"}, "text": {
             "en": "+3 to hit, reach 5 ft. Hit: 4 (1d6 + 1) bludgeoning + 4 (1d8) acid.",
             "es": "+3 al impacto, alcance 1,5 m. Impacto: 4 (1d6 + 1) contundente + 4 (1d8) ácido."}} ] },

    # ─── PLANT (2 NEW) ───
    {"id": "shambling_mound", "name": {"en": "Shambling Mound", "es": "Montículo Ambulatorio"},
     "slug": "shambling_mound", "size": "Large", "type": {"en": "plant", "es": "planta"},
     "alignment": {"en": "unaligned", "es": "sin alineamiento"},
     "armorClass": 15, "hitPoints": {"average": 93, "roll": "11d10 + 33"},
     "speed": {"walk": 20, "swim": 20},
     "abilities": {"str": 18, "dex": 8, "con": 16, "int": 5, "wis": 10, "cha": 5},
     "skills": {"en": [" Stealth +3 "], "es": [" Sigilo +3 "]},
     "damageResistances": {"en": "cold, fire", "es": "frío, fuego"},
     "damageImmunities": {"en": "lightning", "es": "relámpago"},
     "conditionImmunities": {"en": "blinded, charmed, deafened, exhaustion, frightened, prone",
                             "es": "cegado, encantado, ensordecido, agotamiento, asustado, derribado"},
     "senses": {"en": "blindsight 60 ft., passive Perception 10", "es": "visión ciega 18 m, Percepción pasiva 10"},
     "languages": {"en": "\u2014", "es": "\u2014"},
     "challengeRating": "5",
     "traits": [
         {"name": {"en": "Lightning Absorption", "es": "Absorción de Relámpago"}, "text": {
             "en": "Lightning damage: heals HP equal to damage taken.",
             "es": "Daño de relámpago: cura pg igual al daño."}} ],
     "actions": [
         {"name": {"en": "Multiattack", "es": "Ataque Múltiple"}, "text": {
             "en": "Two slam attacks.", "es": "Dos ataques de embestida."}},
         {"name": {"en": "Slam", "es": "Embestida"}, "text": {
             "en": "+6 to hit, reach 10 ft. Hit: 13 (2d8 + 4) bludgeoning. DC 14 STR or grappled.",
             "es": "+6 al impacto, alcance 3 m. Impacto: 13 (2d8 + 4) contundente. FUE CD 14 o agarrado."}},
         {"name": {"en": "Constrict", "es": "Contraer"}, "text": {
             "en": "+6 to hit. Hit: 13 (2d8 + 4) bludgeoning + DC 14 STR or 13 (3d8) bludgeoning.",
             "es": "+6 al impacto. Impacto: 13 (2d8 + 4) contundente + FUE CD 14 o 13 (3d8) contundente."}} ] },

    {"id": "awakened_tree", "name": {"en": "Awakened Tree", "es": "Árbol Despierto"},
     "slug": "awakened_tree", "size": "Huge", "type": {"en": "plant", "es": "planta"},
     "alignment": {"en": "unaligned", "es": "sin alineamiento"},
     "armorClass": 13, "hitPoints": {"average": 59, "roll": "6d12 + 12"},
     "speed": {"walk": 20},
     "abilities": {"str": 19, "dex": 6, "con": 15, "int": 10, "wis": 10, "cha": 7},
     "damageVulnerabilities": {"en": "fire", "es": "fuego"},
     "damageResistances": {"en": "piercing", "es": "perforante"},
     "senses": {"en": "passive Perception 10", "es": "Percepción pasiva 10"},
     "languages": {"en": "one language its creator knew", "es": "un idioma que conocía su creador"},
     "challengeRating": "2",
     "traits": [
         {"name": {"en": "False Appearance", "es": "Falsa Apariencia"}, "text": {
             "en": "Still indistinguishable from a normal tree while motionless.",
             "es": "Indistinguible de un árbol normal cuando está inmóvil."}} ],
     "actions": [
         {"name": {"en": "Slam", "es": "Embestida"}, "text": {
             "en": "+6 to hit, reach 10 ft. Hit: 14 (2d10 + 4) bludgeoning.",
             "es": "+6 al impacto, alcance 3 m. Impacto: 14 (2d10 + 4) contundente."}} ] }
]


def main():
    added_total = 0
    skipped_total = 0
    for lang in ("en", "es"):
        langdir = EN_DIR if lang == "en" else ES_DIR
        added = 0; skipped = []
        for m in MONSTERS:
            mid = m["id"]
            out_path = langdir / f"{mid}.json"
            if out_path.exists():
                skipped.append(mid); continue
            localized = localize(m, lang)
            cr_val = localized.get("challengeRating", "0")
            localized["proficiencyBonus"] = pb(cr_val)
            localized["experiencePoints"] = exp_for(cr_val)
            localized.setdefault("slug", mid)
            localized["lang"] = lang
            localized["source"] = "SRD 5.2 (2024)"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(localized, f, ensure_ascii=False, indent=2)
            added += 1
        print(f"  {lang}: added {added} / skipped {len(skipped)} (already present)")
        added_total += added; skipped_total += len(skipped)
    print(f"TOTAL: added {added_total} / skipped {skipped_total}")


if __name__ == "__main__":
    main()
