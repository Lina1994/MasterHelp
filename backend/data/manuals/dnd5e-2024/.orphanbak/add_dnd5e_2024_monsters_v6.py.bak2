#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v6: Additive merge of ~30 NEW SRD 5.2 (2024) ICONIC boss/high-CR monsters.
Coverage: Undead (8) + Monstrosity (7) + Fiend (8) + Dragon (7) = 30.

Each entry uses bilingual dicts {"en":..., "es":...} for text fields.
localize() walker extracts per-language flat strings for output.
Additive merge keyed on `id` (idempotent). One JSON file per slug per language.
"""
from __future__ import annotations
import json, pathlib
from typing import Any

ROOT = pathlib.Path('data/manuals/dnd5e-2024/monsters')
EN_DIR = ROOT / 'en'
ES_DIR = ROOT / 'es'

PB_BY_CR = {0:2, "1/8":2, "1/4":2, "1/2":2, 1:2, 2:2, 3:3, 4:3, 5:3, 6:3, 7:3, 8:3,
            9:4, 10:4, 11:4, 12:4, 13:5, 14:5, 15:5, 16:5, 17:6, 18:6, 19:6, 20:6,
            21:7, 22:7, 23:7, 24:7, 25:8, 26:8, 27:8, 28:8, 29:9, 30:9}
XP_BY_CR = {0:10,"1/8":25,"1/4":50,"1/2":100,1:200,2:450,3:700,4:1100,5:1800,6:2300,
            7:2900,8:3900,9:5000,10:5900,11:7200,12:8400,13:10000,14:11500,15:13000,
            16:15000,17:18000,18:20000,19:22000,20:25000,21:33000,22:41000,23:50000,
            24:62000,25:75000,26:90000,27:105000,28:120000,29:135000,30:155000}

def pb(cr) -> int:
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

def exp_for(cr) -> int:
    if isinstance(cr, str) and cr in XP_BY_CR: return XP_BY_CR[cr]
    if cr in XP_BY_CR: return XP_BY_CR[cr]
    try:
        crn = float(cr)
    except (TypeError, ValueError):
        return 10
    return max([v for k, v in XP_BY_CR.items() if isinstance(k, (int, float)) and k <= crn] + [10])

# ──────────────── 30 NEW ICONIC SRD 5.2 MONSTERS ────────────────────

MONSTERS: list[dict[str, Any]] = [
  # ──── UNDEAD (8) ────
  {"id":"ghast","name":{"en":"Ghast","es":"Ghast"},
   "slug":"ghast","size":"Medium","type":{"en":"undead","es":"no-muerto"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":13,"hitPoints":{"average":36,"roll":"8d8"},
   "speed":{"walk":30},
   "abilities":{"str":16,"dex":17,"con":10,"int":11,"wis":12,"cha":15},
   "damageResistances":{"en":"necrotic","es":"necrótico"},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"exhaustion, poisoned","es":"agotamiento, envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 11","es":"visión en la oscuridad 18 m, Percepción pasiva 11"},
   "languages":{"en":"Common","es":"Común"},
   "challengeRating":"2",
   "traits":[
     {"name":{"en":"Stench","es":"Hedor"},
      "text":{"en":"Any creature within 5 ft DC 10 CON or poisoned until end of next turn.","es":"Cualquier criatura a 1,5 m CON CD 10 o envenenada hasta fin del próximo turno."}},
     {"name":{"en":"Turn Immunity","es":"Inmunidad a Volver"},
      "text":{"en":"Can't be turned.","es":"No puede ser vueltos los muertos."}} ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+3 to hit. Hit: 9 (2d6 + 2) piercing + 7 (2d6) poison.","es":"+3 al impacto. Impacto: 9 (2d6 + 2) perforante + 7 (2d6) veneno."}},
     {"name":{"en":"Claws","es":"Garras"},
      "text":{"en":"+5 to hit. Hit: 7 (2d4 + 3) slashing + DC 10 CON or paralyzed.","es":"+5 al impacto. Impacto: 7 (2d4 + 3) cortante. CON CD 10 o paralizado."}} ] },

  {"id":"ghost","name":{"en":"Ghost","es":"Fantasma"},
   "slug":"ghost","size":"Medium","type":{"en":"undead","es":"no-muerto"},
   "alignment":{"en":"any alignment","es":"cualquier alineamiento"},
   "armorClass":11,"hitPoints":{"average":67,"roll":"10d8 + 30"},
   "speed":{"walk":0,"fly":40},
   "abilities":{"str":7,"dex":13,"con":16,"int":10,"wis":12,"cha":17},
   "damageResistances":{"en":"acid, fire, lightning, thunder; bludgeoning, piercing, slashing from nonmagical attacks","es":"ácido, fuego, relámpago, trueno; contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"cold, necrotic, poison","es":"frío, necrótico, veneno"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, grappled, paralyzed, petrified, poisoned, prone, restrained","es":"encantado, agotamiento, asustado, agarrado, paralizado, petrificado, envenenado, derribado, restringido"},
   "senses":{"en":"darkvision 60 ft., passive Perception 11","es":"visión en la oscuridad 18 m, Percepción pasiva 11"},
   "languages":{"en":"any languages it knew in life","es":"cualquier idioma que conocía en vida"},
   "challengeRating":"4",
   "traits":[
     {"name":{"en":"Ethereal Sight","es":"Visión Etérea"},
      "text":{"en":"Can see 60 ft into the Ethereal Plane.","es":"Puede ver 18 m dentro del Plano Etéreo."}},
     {"name":{"en":"Incorporeal Movement","es":"Movimiento Incorpóreo"},
      "text":{"en":"Can move through creatures and objects; takes 1d10 force damage if ends turn inside.","es":"Puede moverse a través de criaturas y objetos; 1d10 fuerza si termina dentro."}} ],
   "actions":[
     {"name":{"en":"Withering Touch","es":"Toque Deteriorante"},
      "text":{"en":"+5 to hit. Hit: 17 (4d6 + 3) necrotic. DC 10 CON or max HP reduced by damage.","es":"+5 al impacto. Impacto: 17 (4d6 + 3) necrótico. CON CD 10 o pg máx reducido."}},
     {"name":{"en":"Possession (Recharge 6)","es":"Posesión (Recarga 6)"},
      "text":{"en":"+5 to hit. Hit: WIS 13 or charmed + paralyzed; ghost vanishes; possessed loses control (1d8 + 3 force damage).","es":"+5 al impacto. Impacto: SAB 13 o encantado + paralizado. Fantasma desaparece; poseído pierde control (1d8 + 3 fuerza)."}} ],
   "legendaryActions":[
     {"name":{"en":"Teleport","es":"Teletransporte"},
      "text":{"en":"Magically teleports up to 120 ft to an unoccupied space it can see.","es":"Se teletransporta mágicamente hasta 36 m a un espacio libre visible."}} ] },

  {"id":"revenant","name":{"en":"Revenant","es":"Revenant"},
   "slug":"revenant","size":"Medium","type":{"en":"undead","es":"no-muerto"},
   "alignment":{"en":"neutral","es":"neutral"},
   "armorClass":13,"hitPoints":{"average":136,"roll":"16d8 + 64"},
   "speed":{"walk":30},
   "abilities":{"str":18,"dex":14,"con":18,"int":5,"wis":11,"cha":5},
   "damageResistances":{"en":"bludgeoning, piercing, slashing from nonmagical attacks","es":"contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"necrotic, poison","es":"necrótico, veneno"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned, stunned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado, aturdido"},
   "senses":{"en":"darkvision 60 ft., passive Perception 10","es":"visión en la oscuridad 18 m, Percepción pasiva 10"},
   "languages":{"en":"Common","es":"Común"},
   "challengeRating":"5",
   "traits":[
     {"name":{"en":"Regeneration","es":"Regeneración"},
      "text":{"en":"Regains 10 HP at start of turn. Stops if takes radiant damage / its target is killed.","es":"Recupera 10 pg al inicio del turno. Se detiene con daño radiante o matando a su objetivo."}},
     {"name":{"en":"Vengeful Bound","es":"Vinculado Vengativo"},
      "text":{"en":"Has advantage on attack vs. its creator and gains 2d6 extra damage on hit.","es":"Ventaja en ataque contra su creador, +2d6 extra al impacto."}},
     {"name":{"en":"Unusual Nature","es":"Naturaleza Inusual"},
      "text":{"en":"Cannot be raised/resurrected except by wish spell.","es":"No puede ser levantado/resucitado salvo con deseo."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam attacks.","es":"Dos ataques de embestida."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+7 to hit. Hit: 11 (2d8 + 4) bludgeoning.","es":"+7 al impacto. Impacto: 11 (2d8 + 4) contundente."}} ] },

  {"id":"mummy","name":{"en":"Mummy","es":"Momia"},
   "slug":"mummy","size":"Medium","type":{"en":"undead","es":"no-muerto"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":11,"hitPoints":{"average":58,"roll":"9d8 + 18"},
   "speed":{"walk":20},
   "abilities":{"str":16,"dex":11,"con":15,"int":6,"wis":10,"cha":12},
   "saves":{"en":[" WIS +2 "],"es":[" SAB +2 "]},
   "damageVulnerabilities":{"en":"fire","es":"fuego"},
   "damageResistances":{"en":"bludgeoning, piercing, slashing from nonmagical attacks","es":"contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"necrotic, poison","es":"necrótico, veneno"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 10","es":"visión en la oscuridad 18 m, Percepción pasiva 10"},
   "languages":{"en":"Common","es":"Común"},
   "challengeRating":"3",
   "traits":[
     {"name":{"en":"Undead Fortitude","es":"Fortaleza de No-Muerto"},
      "text":{"en":"DC 5 + damage + CON mod or 0 HP → return with 1 HP (except radiant).","es":"CD 5 + daño + CON mod si cae a 0 pg → vuelve con 1 pg (excepto radiante)."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two fist attacks.","es":"Dos ataques de puño."}},
     {"name":{"en":"Rotting Fist","es":"Puño Putrefacto"},
      "text":{"en":"+5 to hit. Hit: 10 (2d8 + 3) bludgeoning + DC 12 CON or cursed mummy rot.","es":"+5 al impacto. Impacto: 10 (2d8 + 3) contundente. CON CD 12 o maldecido de putrefacción de momia."}},
     {"name":{"en":"Dreadful Glare","es":"Mirada Pavorosa"},
      "text":{"en":"+0 to hit, 30-ft cone. WIS 11 or frightened until end of next turn.","es":"+0 al impacto, cono 9 m. SAB CD 11 o asustado hasta próximo turno."}} ] },

  {"id":"mummy_lord","name":{"en":"Mummy Lord","es":"Señor Momia"},
   "slug":"mummy_lord","size":"Large","type":{"en":"undead","es":"no-muerto"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":17,"hitPoints":{"average":210,"roll":"20d10 + 100"},
   "speed":{"walk":20},
   "abilities":{"str":18,"dex":10,"con":17,"int":11,"wis":18,"cha":16},
   "saves":{"en":[" WIS +9 "," CHA +8 "],"es":[" SAB +9 "," CAR +8 "]},
   "damageVulnerabilities":{"en":"fire","es":"fuego"},
   "damageResistances":{"en":"bludgeoning, piercing, slashing from nonmagical attacks","es":"contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"necrotic, poison","es":"necrótico, veneno"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado"},
   "senses":{"en":"truesight 60 ft., passive Perception 14","es":"visión verdadera 18 m, Percepción pasiva 14"},
   "languages":{"en":"Common, plus up to 5 others","es":"Común, hasta 5 más"},
   "challengeRating":"15",
   "traits":[
     {"name":{"en":"Magic Resistance","es":"Resistencia Magia"},
      "text":{"en":"Advantage on saves vs. spells and magical effects.","es":"Ventaja en salvaciones contra conjuros y efectos mágicos."}},
     {"name":{"en":"Rejuvenation","es":"Rejuvenecimiento"},
      "text":{"en":"Restores body after destruction if ritual completed within 10 days.","es":"Restaura cuerpo tras destrucción si ritual se completa en 10 días."}},
     {"name":{"en":"Spellcasting (Mummy Lord)","es":"Lanzamiento (Señor Momia)"},
      "text":{"en":"WIS-based caster (save DC 16). Spells: Cantrips + 1st–5th from cleric + wizard lists.","es":"Lanzador SAB (CD 16). Trucos + 1°–5° nivel de listas clérigo y mago."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two slam + paralyzing touch, or blighted blow + gaze.","es":"Dos embestidas + toque paralizante, o golpe marchito + mirada."}},
     {"name":{"en":"Slam","es":"Embestida"},
      "text":{"en":"+9 to hit. Hit: 14 (3d6 + 4) bludgeoning.","es":"+9 al impacto. Impacto: 14 (3d6 + 4) contundente."}},
     {"name":{"en":"Blinding Breath (Recharge 5\u20136)","es":"Aliento Cegador (Recarga 5\u20136)"},
      "text":{"en":"30-ft cone; CON 16 or blinded 1 min.","es":"Cono 9 m; CON CD 16 o cegado 1 min."}} ],
   "legendaryActions":[
     {"name":{"en":"Blinding Glare","es":"Mirada Cegadora (1/ronda)"},
      "text":{"en":"30-ft cone; CON 16 or blinded until end of next turn.","es":"Cono 9 m; CON CD 16 o cegado hasta próximo turno."}} ] },

  {"id":"vampire","name":{"en":"Vampire","es":"Vampiro"},
   "slug":"vampire","size":"Medium","type":{"en":"undead","es":"no-muerto (vampiro)"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":16,"hitPoints":{"average":144,"roll":"17d8 + 68"},
   "speed":{"walk":30,"climb":30},
   "abilities":{"str":18,"dex":18,"con":18,"int":17,"wis":15,"cha":18},
   "saves":{"en":[" DEX +9 "," WIS +7 "," CHA +9 "],"es":[" DES +9 "," SAB +7 "," CAR +9 "]},
   "skills":{"en":[" Perception +7 "," Stealth +9 "],"es":[" Percepción +7 "," Sigilo +9 "]},
   "damageResistances":{"en":"necrotic; bludgeoning, piercing, slashing from nonmagical attacks","es":"necrótico; contundente, perforante, cortante no mágico"},
   "conditionImmunities":{"en":"exhaustion, frightened","es":"agotamiento, asustado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 17","es":"visión en la oscuridad 18 m, Percepción pasiva 17"},
   "languages":{"en":"Common, plus up to 5 others","es":"Común, hasta 5 más"},
   "challengeRating":"15",
   "traits":[
     {"name":{"en":"Shapechanger","es":"Cambiaformas"},
      "text":{"en":"If not in sunlight or running water, can polymorph into a Tiny bat or Medium wolf-humanoid.","es":"Sin luz solar o agua corriente, puede polimorfar en murciélago Diminuto o híbrido humanoide-lobo Mediano."}},
     {"name":{"en":"Damage Resistances","es":"Resistencias"},
      "text":{"en":"Resistant to necrotic damage and nonmagical bludgeoning/piercing/slashing.","es":"Resistente a necrótico y contundente/perforante/cortante no mágico."}},
     {"name":{"en":"Misty Escape","es":"Escape Brumoso (Recharge)"},
      "text":{"en":"When drops to 0 HP outside sunlight/running water: drops to 0 + speed becomes 20 ft fly, can pass through 1-inch cracks, returns to full HP in 1d4 hours if not exposed.","es":"Cae a 0 pg fuera de luz solar/agua: 0 pg + 6 m vuelo, atraviesa grietas 2,5 cm, vuelve con pg completos en 1d4 horas si no expuesto."}},
     {"name":{"en":"Regeneration","es":"Regeneración"},
      "text":{"en":"Regains 20 HP at start of turn if has 1 HP and not in sunlight/running water.","es":"Recupera 20 pg al inicio del turno si tiene 1 pg y no está en luz solar/agua."}},
     {"name":{"en":"Children of the Night","es":"Descendencia de la Noche (1/día)"},
      "text":{"en":"Action to summon 3d6 swarms of rats/bats, or 3d6 wolves outside.","es":"Acción para invocar 3d6 enjambres de ratas/murciélagos, o 3d6 lobos afuera."}},
     {"name":{"en":"Vampire Weaknesses","es":"Debilidades de Vampiro"},
      "text":{"en":"Stake through heart in coffin; running water and sunlight.","es":"Estaca en corazón en ataúd; agua corriente y luz solar."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two attacks: one bite + one claws OR two claws.","es":"Dos ataques: uno mordisco + uno garra, OR dos garras."}},
     {"name":{"en":"Bite (Bat or Vampire form, Recharge)","es":"Mordisco (Murciélago o Vampiro, Recarga)"},
      "text":{"en":"+9 to hit. Hit: 7 (1d6 + 4) piercing + 7 (2d6) necrotic. Half damage if target is bloodied.","es":"+9 al impacto. Impacto: 7 (1d6 + 4) perforante + 7 (2d6) necrótico. Mitad si objetivo está desangrándose."}},
     {"name":{"en":"Claws (Vampire form only)","es":"Garras (Solo Vampiro)"},
      "text":{"en":"+9 to hit. Hit: 8 (1d8 + 4) slashing. DC 15 DEX or grappled.","es":"+9 al impacto. Impacto: 8 (1d8 + 4) cortante. DES CD 15 o agarrado."}},
     {"name":{"en":"Charm","es":"Encanto"},
      "text":{"en":"CHA, target must WIS 17 or charmed: knows the vampire's location; can't attack.","es":"CAR, objetivo SAB CD 17 o encantado: conoce ubicación del vampiro; no ataca."}} ],
   "legendaryActions":[
     {"name":{"en":"Move","es":"Movimiento"},
      "text":{"en":"Move up to speed without provoking.","es":"Moverse hasta tu velocidad sin provocar."}},
     {"name":{"en":"Bite (Costs 2)","es":"Mordisco (Coste 2)"},
      "text":{"en":"Use Bite attack (only if bloodied creature within reach).","es":"Usa ataque de Mordisco (solo si criatura desangrándose al alcance)."},
     {"name":{"en":"Charm (Costs 2)","es":"Encanto (Coste 2)"},
      "text":{"en":"Use Charm on a creature within 30 ft.","es":"Usa Encanto contra una criatura a 9 m."}} ] },

  {"id":"lich","name":{"en":"Lich","es":"Liche"},
   "slug":"lich","size":"Medium","type":{"en":"undead","es":"no-muerto (lich)"},
   "alignment":{"en":"any evil","es":"cualquier maligno"},
   "armorClass":17,"hitPoints":{"average":135,"roll":"18d8 + 54"},
   "speed":{"walk":30},
   "abilities":{"str":11,"dex":16,"con":16,"int":20,"wis":14,"cha":16},
   "saves":{"en":[" CON +10 "," INT +12 "," WIS +9 "],"es":[" CON +10 "," INT +12 "," SAB +9 "]},
   "skills":{"en":[" Arcana +18 "," History +12 "," Insight +9 "," Perception +9 "],"es":[" Arcana +18 "," Historia +12 "," Intuición +9 "," Percepción +9 "]},
   "damageResistances":{"en":"cold, lightning, necrotic","es":"frío, relámpago, necrótico"},
   "damageImmunities":{"en":"poison; bludgeoning, piercing, slashing from nonmagical attacks","es":"veneno; contundente, perforante, cortante no mágico"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned, stunned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado, aturdido"},
   "senses":{"en":"truesight 60 ft., passive Perception 19","es":"visión verdadera 18 m, Percepción pasiva 19"},
   "languages":{"en":"Common + 5 others","es":"Común + 5 más"},
   "challengeRating":"21",
   "traits":[
     {"name":{"en":"Legendary Resistance (3/Day)","es":"Resistencia Legendaria (3/día)"},
      "text":{"en":"If fails a save, can choose to succeed instead (max 3/long rest).","es":"Si falla salvación, elige tener éxito (máx 3/descanso prolongado).".replace(".", ".", 1)}},
     {"name":{"en":"Rejuvenation","es":"Rejuvenecimiento"},
      "text":{"en":"Returns to full HP 1d10 days later if phylactery intact.","es":"Vuelve con pg completos 1d10 días después si filacteria intacta."}},
     {"name":{"en":"Spellcasting (Lich)","es":"Lanzamiento (Liche)"},
      "text":{"en":"INT-based caster (DC 19 save). Spells: Cantrips + 1st\u20139th from wizard list.","es":"Lanzador INT (CD 19). Trucos + 1°–9° nivel de mago."}},
     {"name":{"en":"Turn Immunity","es":"Inmunidad a Volver"},
      "text":{"en":"Can't be turned by good clerics/paladins.","es":"No puede ser vueltos los muertos por clérigos/paladines buenos."}} ],
   "actions":[
     {"name":{"en":"Withering Touch","es":"Toque Deteriorante"},
      "text":{"en":"+12 to hit. Hit: 21 (4d8 + 3) necrotic.","es":"+12 al impacto. Impacto: 21 (4d8 + 3) necrótico."}},
     {"name":{"en":"Paralyzing Touch","es":"Toque Paralizante"},
      "text":{"en":"+12 to hit. Hit: CON 18 or paralyzed.","es":"+12 al impacto. Impacto: CON CD 18 o paralizado."}},
     {"name":{"en":"Frightening Presence (Recharge 6)","es":"Presencia Aterradora (Recarga 6)"},
      "text":{"en":"Self 30-ft radius; WIS 18 or frightened 1 min.","es":"Radio 9 m propio; SAB CD 18 o asustado 1 min."}},
     {"name":{"en":"Disrupt Life (Cantrip)","es":"Perturbar Vida (Truco)"},
      "text":{"en":"30-ft radius: 4d6 necrotic; CHA 18 or -1 attack and -1 save for 24 h.","es":"Radio 9 m: 4d6 necrótico; CAR CD 18 o -1 ataque y -1 salvación 24 h."}} ],
   "legendaryActions":[
     {"name":{"en":"Cantrip","es":"Truco"},
      "text":{"en":"Cast a cantrip.","es":"Lanza un truco."}},
     {"name":{"en":"Paralyzing Touch (Costs 2)","es":"Toque Paralizante (Coste 2)"},
      "text":{"en":"Use paralyzing touch.","es":"Usa toque paralizante."}},
     {"name":{"en":"Withering Touch (Costs 3)","es":"Toque Deteriorante (Coste 3)"},
      "text":{"en":"Use withering touch.","es":"Usa toque deteriorante."}},
     {"name":{"en":"Frightening Presence (Costs 3)","es":"Presencia Aterradora (Coste 3)"},
      "text":{"en":"Use frightening presence.","es":"Usa presencia aterradora."}},
     {"name":{"en":"Spell (Costs 3)","es":"Conjuro (Coste 3)"},
      "text":{"en":"Cast a wizard spell (4th level or lower).","es":"Lanza un conjuro de mago (nivel 4 o inferior)."} ] },

  {"id":"death_knight","name":{"en":"Death Knight","es":"Caballero de la Muerte"},
   "slug":"death_knight","size":"Large","type":{"en":"undead","es":"no-muerto"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":20,"hitPoints":{"average":180,"roll":"19d8 + 95"},
   "speed":{"walk":60},
   "abilities":{"str":20,"dex":11,"con":20,"int":11,"wis":12,"cha":17},
   "saves":{"en":[" STR +10 "," CON +10 "," WIS +6 "],"es":[" FUE +10 "," CON +10 "," SAB +6 "]},
   "damageImmunities":{"en":"necrotic, poison; bludgeoning, piercing, slashing from nonmagical attacks","es":"necrótico, veneno; contundente, perforante, cortante no mágico"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, paralyzed, petrified, poisoned, stunned","es":"encantado, agotamiento, asustado, paralizado, petrificado, envenenado, aturdido"},
   "senses":{"en":"darkvision 120 ft., passive Perception 11","es":"visión en la oscuridad 36 m, Percepción pasiva 11"},
   "languages":{"en":"Common, plus up to 2 others","es":"Común, hasta 2 más"},
   "challengeRating":"17",
   "traits":[
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells and magical effects.","es":"Ventaja en salvaciones vs conjuros y efectos mágicos."}},
     {"name":{"en":"Marshal Undead","es":"Mariscal No-Muerto (Recharge 4\u20136)"},
      "text":{"en":"30-ft radius: undead allies make 1 extra attack or move up to half speed without provoking.","es":"Radio 9 m: aliados no-muertos hacen 1 ataque extra o se mueven sin provocar."}},
     {"name":{"en":"Necrotic Aura","es":"Aura Necrótica"},
      "text":{"en":"30-ft radius: living creatures can't regain HP.","es":"Radio 9 m: criaturas vivas no recuperan pg."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three longsword attacks OR two greatsword + one hellfire orb.","es":"Tres ataques de espada larga OR dos espadazo + un orbe de fuego infernal."}},
     {"name":{"en":"Longsword","es":"Espada Larga"},
      "text":{"en":"+10 to hit, reach 10 ft. Hit: 13 (2d8 + 5) slashing or 16 (2d8 + 5) + 9 (2d8) necrotic on heavy two-handed use.","es":"+10 al impacto, alcance 3 m. Impacto: 13 (2d8 + 5) cortante o +9 (2d8) necrótico a dos manos."}},
     {"name":{"en":"Greatsword","es":"Espadazo"},
      "text":{"en":"+10 to hit, reach 10 ft. Hit: 16 (3d6 + 7) slashing + 9 necrotic.","es":"+10 al impacto, alcance 3 m. Impacto: 16 (3d6 + 7) cortante + 9 necrótico."}},
     {"name":{"en":"Hellfire Orb (Recharge 5\u20136)","es":"Orbe de Fuego Infernal (Recarga 5\u20136)"},
      "text":{"en":"+5 to hit, range 60 ft. Hit: 28 (8d6) fire + 14 (4d6) fire at end of next turn.","es":"+5 al impacto, alcance 18 m. Impacto: 28 (8d6) fuego + 14 (4d6) fuego a fin de próximo turno."}} ],
   "legendaryActions":[
     {"name":{"en":"Longsword (Costs 2)","es":"Espada Larga (Coste 2)"},
      "text":{"en":"Make one longsword attack.","es":"Hace un ataque de espada larga."}},
     {"name":{"en":"Marshal Undead (Costs 3)","es":"Mariscal No-Muerto (Coste 3)"},
      "text":{"en":"Use marshal undead.","es":"Usa Mariscal No-Muerto."}},
     {"name":{"en":"Necrotic Aura (Costs 3, 1/round)","es":"Aura Necrótica (Coste 3, 1/ronda)"},
      "text":{"en":"Deals 28 (8d6) necrotic damage to living creatures in aura.","es":"28 (8d6) necrótico a criaturas vivas en el aura."}} ] },

  # ──── MONSTROSITY (7) ────
  {"id":"basilisk","name":{"en":"Basilisk","es":"Basilisco"},
   "slug":"basilisk","size":"Medium","type":{"en":"monstrosity","es":"monstruosidad"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":15,"hitPoints":{"average":52,"roll":"8d8 + 16"},
   "speed":{"walk":20},
   "abilities":{"str":16,"dex":8,"con":15,"int":2,"wis":8,"cha":7},
   "senses":{"en":"darkvision 60 ft., passive Perception 9","es":"visión en la oscuridad 18 m, Percepción pasiva 9"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"3",
   "traits":[
     {"name":{"en":"Petrifying Gaze","es":"Mirada Petrificante"},
      "text":{"en":"30 ft cone; target CON 12 or begins to turn to stone (repeats at end of next turn): if fail 3 → petrified.","es":"Cono 9 m; CON CD 12 o comienza a petrificar (se repite). 3 fallas = petrificado."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Bite + one gore attack (or petrifying gaze).","es":"Mordisco + un cornada (o mirada petrificante)."}}],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+5 to hit. Hit: 7 (2d4 + 3) piercing + 7 (2d6) poison.","es":"+5 al impacto. Impacto: 7 (2d4 + 3) perforante + 7 (2d6) veneno."}},
     {"name":{"en":"Gore (Charge only)","es":"Cornada (Solo Carga)"},
      "text":{"en":"+5 to hit. Hit: 7 (2d4 + 3) piercing.","es":"+5 al impacto. Impacto: 7 (2d4 + 3) perforante."}} ] },

  {"id":"hippogriff","name":{"en":"Hippogriff","es":"Hipogrifo"},
   "slug":"hippogriff","size":"Large","type":{"en":"magical beast","es":"bestia mágica"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":11,"hitPoints":{"average":19,"roll":"3d10 + 3"},
   "speed":{"walk":40,"fly":60},
   "abilities":{"str":17,"dex":13,"con":13,"int":2,"wis":12,"cha":8},
   "skills":{"en":[" Perception +3 "],"es":[" Percepción +3 "]},
   "senses":{"en":"passive Perception 13","es":"Percepción pasiva 13"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"1",
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two attacks: one beak, one claws.","es":"Dos ataques: uno pico, uno garras."}},
     {"name":{"en":"Beak","es":"Pico"},
      "text":{"en":"+5 to hit. Hit: 8 (1d10 + 3) piercing.","es":"+5 al impacto. Impacto: 8 (1d10 + 3) perforante."}},
     {"name":{"en":"Claws","es":"Garras"},
      "text":{"en":"+5 to hit. Hit: 9 (2d6 + 3) slashing.","es":"+5 al impacto. Impacto: 9 (2d6 + 3) cortante."}} ] },

  {"id":"hydra","name":{"en":"Hydra","es":"Hidra"},
   "slug":"hydra","size":"Huge","type":{"en":"monstrosity","es":"monstruosidad"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":15,"hitPoints":{"average":172,"roll":"16d12 + 64"},
   "speed":{"walk":30,"swim":30},
   "abilities":{"str":20,"dex":12,"con":18,"int":2,"wis":10,"cha":7},
   "skills":{"en":[" Perception +6 "],"es":[" Percepción +6 "]},
   "senses":{"en":"darkvision 60 ft., passive Perception 16","es":"visión en la oscuridad 18 m, Percepción pasiva 16"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"8",
   "traits":[
     {"name":{"en":"Multiple Heads","es":"Múltiples Cabezas"},
      "text":{"en":"Has 1d10 heads; starts with 5. Extra actions = number of heads.","es":"1d10 cabezas, empieza con 5. Acciones extra = número cabezas."}},
     {"name":{"en":"Reactive Heads","es":"Cabezas Reactivas"},
      "text":{"en":"For each head beyond first, opportunity attack without provoking.","es":"Por cada cabeza extra, ataque de oportunidad sin provocar."}},
     {"name":{"en":"Wakeful","es":"Despierto"},
      "text":{"en":"Advantage on Perception checks while sleeping.","es":"Ventaja en Percepción mientras duerme."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"One bite per head.","es":"Un mordisco por cabeza."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+8 to hit. Hit: 10 (1d10 + 5) piercing.","es":"+8 al impacto. Impacto: 10 (1d10 + 5) perforante."}} ] },

  {"id":"purple_worm","name":{"en":"Purple Worm","es":"Gusano Púrpura"},
   "slug":"purple_worm","size":"Gargantuan","type":{"en":"monstrosity","es":"monstruosidad"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":18,"hitPoints":{"average":247,"roll":"15d20 + 75"},
   "speed":{"walk":50,"burrow":20},
   "abilities":{"str":28,"dex":7,"con":22,"int":1,"wis":6,"cha":3},
   "senses":{"en":"blindsight 60 ft., tremor-sense 60 ft., passive Perception 8","es":"visión ciega 18 m, sentido de vibración 18 m, Percepción pasiva 8"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"15",
   "traits":[
     {"name":{"en":"Tunneler","es":"Excavador"},
      "text":{"en":"Can burrow through solid rock at half speed.","es":"Puede excavar roca sólida a mitad de velocidad."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Bite + one stinger.","es":"Mordisco + un aguijón."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+14 to hit. Hit: 30 (3d12 + 9) piercing.","es":"+14 al impacto. Impacto: 30 (3d12 + 9) perforante."}},
     {"name":{"en":"Stinger","es":"Aguijón"},
      "text":{"en":"+14 to hit. Hit: 11 (3d4 + 4) piercing + 21 (5d6) poison (half DC 19 CON save).","es":"+14 al impacto. Impacto: 11 (3d4 + 4) perforante + 21 (5d6) veneno (mitad CON CD 19)."}} ] },

  {"id":"remorhaz","name":{"en":"Remorhaz","es":"Remorhaz"},
   "slug":"remorhaz","size":"Huge","type":{"en":"elemental","es":"elemental"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":17,"hitPoints":{"average":195,"roll":"17d12 + 85"},
   "speed":{"walk":40,"burrow":20},
   "abilities":{"str":24,"dex":13,"con":21,"int":4,"wis":10,"cha":5},
   "skills":{"en":[" Perception +4 "],"es":[" Percepción +4 "]},
   "damageImmunities":{"en":"cold, fire","es":"frío, fuego"},
   "senses":{"en":"darkvision 60 ft., tremorsense 60 ft., passive Perception 14","es":"visión en la oscuridad 18 m, sentido de vibración 18 m, Percepción pasiva 14"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"11",
   "traits":[
     {"name":{"en":"Heated Body","es":"Cuerpo Caliente"},
      "text":{"en":"At start of turn within 5 ft: 2d6 fire damage + DC 14 DEX or prone.","es":"Inicio del turno a 1,5 m: 2d6 fuego + DES CD 14 o derribado."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Bite + two stings.","es":"Mordisco + dos aguijones."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+10 to hit. Hit: 21 (3d8 + 7) piercing + 7 (2d6) fire.","es":"+10 al impacto. Impacto: 21 (3d8 + 7) perforante + 7 (2d6) fuego."}},
     {"name":{"en":"Sting","es":"Aguijón"},
      "text":{"en":"+10 to hit. Hit: 14 (2d6 + 7) piercing + DC 16 CON or 24 (7d6) fire.","es":"+10 al impacto. Impacto: 14 (2d6 + 7) perforante + CON CD 16 o 24 (7d6) fuego."}} ] },

  {"id":"sphinx","name":{"en":"Sphinx","es":"Esfinge"},
   "slug":"sphinx","size":"Large","type":{"en":"magical beast","es":"bestia mágica"},
   "alignment":{"en":"chaotic neutral","es":"caótico neutral"},
   "armorClass":17,"hitPoints":{"average":136,"roll":"16d10 + 48"},
   "speed":{"walk":40,"fly":60},
   "abilities":{"str":18,"dex":15,"con":16,"int":16,"wis":17,"cha":17},
   "saves":{"en":[" DEX +6 "," INT +7 "," WIS +7 "," CHA +7 "],"es":[" DES +6 "," INT +7 "," SAB +7 "," CAR +7 "]},
   "skills":{"en":[" Arcana +7 "," History +7 "," Perception +7 "," Religion +7 "],"es":[" Arcana +7 "," Historia +7 "," Percepción +7 "," Religión +7 "]},
   "damageResistances":{"en":"psychic; bludgeoning, piercing, slashing from nonmagical attacks","es":"psíquico; contundente, perforante, cortante no mágico"},
   "senses":{"en":"truesight 60 ft., passive Perception 17","es":"visión verdadera 18 m, Percepción pasiva 17"},
   "languages":{"en":"Common, Sphinx","es":"Común, Esfinge"},
   "challengeRating":"11",
   "traits":[
     {"name":{"en":"Inscrutable","es":"Inescrutable"},
      "text":{"en":"Mind immune to any effect requiring reading thoughts.","es":"Mente inmune a cualquier efecto que requiera leer pensamientos."}},
     {"name":{"en":"Magic Weapons","es":"Armas Mágicas"},
      "text":{"en":"Claw attacks are magical.","es":"Garras cuentan como mágicas."}},
     {"name":{"en":"Spellcasting (Sphinx)","es":"Lanzamiento (Esfinge)"},
      "text":{"en":"INT-based caster (DC 15). Spells: Cantrips + 1st\u20134th from wizard list.","es":"Lanzador INT (CD 15). Trucos + 1°–4° de mago."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two claw attacks.","es":"Dos ataques de garra."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+7 to hit. Hit: 14 (2d10 + 4) slashing.","es":"+7 al impacto. Impacto: 14 (2d10 + 4) cortante."}} ],
   "legendaryActions":[
     {"name":{"en":"Claw Attack","es":"Ataque de Garra"},
      "text":{"en":"Make one claw attack.","es":"Hace un ataque de garra."}},
     {"name":{"en":"Teleport (Costs 2)","es":"Teletransporte (Coste 2)"},
      "text":{"en":"Magic: teleports up to 120 ft.","es":"Magia: teletransporte hasta 36 m."}},
     {"name":{"en":"Cast a Spell (Costs 3)","es":"Lanzar Conjuro (Coste 3)"},
      "text":{"en":"Cast a 1st\u20133rd level spell.","es":"Lanza un conjuro de 1°–3° nivel."}} ] },

  {"id":"tarrasque","name":{"en":"Tarrasque","es":"Tarrasque"},
   "slug":"tarrasque","size":"Gargantuan","type":{"en":"aberration","es":"aberración"},
   "alignment":{"en":"unaligned","es":"sin alineamiento"},
   "armorClass":25,"hitPoints":{"average":676,"roll":"33d20 + 165"},
   "speed":{"walk":40},
   "abilities":{"str":30,"dex":11,"con":30,"int":3,"wis":11,"cha":11},
   "saves":{"en":[" INT +5 "," WIS +9 "],"es":[" INT +5 "," SAB +9 "]},
   "skills":{"en":[" Perception +9 "],"es":[" Percepción +9 "]},
   "damageImmunities":{"en":"fire, poison, bludgeoning, piercing, slashing from nonmagical attacks","es":"fuego, veneno, contundente, perforante, cortante no mágico"},
   "conditionImmunities":{"en":"charmed, exhaustion, frightened, grappled, paralyzed, petrified, poisoned, prone, restrained, stunned","es":"encantado, agotamiento, asustado, agarrado, paralizado, petrificado, envenenado, derribado, restringido, aturdido"},
   "senses":{"en":"blindsight 120 ft., passive Perception 19","es":"visión ciega 36 m, Percepción pasiva 19"},
   "languages":{"en":"\u2014","es":"\u2014"},
   "challengeRating":"30",
   "traits":[
     {"name":{"en":"Legendary Resistance (5/Day)","es":"Resistencia Legendaria (5/día)"},
      "text":{"en":"If fails a save, can choose to succeed instead.","es":"Si falla salvación, elige tener éxito."}},
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells and magical effects.","es":"Ventaja en salvaciones vs conjuros y efectos mágicos."}},
     {"name":{"en":"Reflective Carapace","es":"Caparazón Reflectante"},
      "text":{"en":"Spell save DCs targeting it = +8 (treats spell effects as spell attacks).","es":"CD de salvación de conjuros contra él = +8 (trata efectos como ataques de conjuro)."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Five attacks: one bite, two claws, two horns or tail. Can replace two claws with one swallow.","es":"Cinco ataques: uno mordisco, dos garras, dos cuernos o cola. Puede reemplazar dos garras con un tragar."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+19 to hit. Hit: 36 (4d12 + 10) piercing + 28 (8d6) necrotic (½ if DC 25 STR).","es":"+19 al impacto. Impacto: 36 (4d12 + 10) perforante + 28 (8d6) necrótico (mitad FUE CD 25)."}}],
   "actions":[
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+19 to hit. Hit: 28 (4d8 + 10) slashing.","es":"+19 al impacto. Impacto: 28 (4d8 + 10) cortante."}},
     {"name":{"en":"Horn","es":"Cuerno"},
      "text":{"en":"+19 to hit. Hit: 28 (4d8 + 10) piercing.","es":"+19 al impacto. Impacto: 28 (4d8 + 10) perforante."}},
     {"name":{"en":"Tail","es":"Cola"},
      "text":{"en":"+19 to hit. Hit: 24 (4d6 + 10) bludgeoning; DC 22 STR or prone + pushed.","es":"+19 al impacto. Impacto: 24 (4d6 + 10) contundente; FUE CD 22 o derribado + empujado."}},
     {"name":{"en":"Swallow","es":"Tragar"},
      "text":{"en":"Grappled creature; 56 (16d6) acid at start of turns; freed at 0 HP once properly disposed.","es":"Criatura agarrada; 56 (16d6) ácido al inicio de sus turnos; liberado a 0 pg tras extracción."}} ],
   "legendaryActions":[
     {"name":{"en":"Attack","es":"Ataque"},
      "text":{"en":"Make one bite/claw/horn/tail attack.","es":"Hace un ataque de mordisco/garra/cuerno/cola."}},
     {"name":{"en":"Move","es":"Movimiento"},
      "text":{"en":"Move up to half speed without provoking.","es":"Moverse hasta mitad de velocidad sin provocar."}},
     {"name":{"en":"Chomp (Costs 2)","es":"Tragar (Coste 2)"},
      "text":{"en":"Use swallow on a creature within reach.","es":"Usa tragar contra criatura al alcance."}} ] },

  # ──── FIEND (8) ────
  {"id":"quasit","name":{"en":"Quasit","es":"Quasit"},
   "slug":"quasit","size":"Tiny","type":{"en":"fiend (demon)","es":"infernal (demonio)"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":13,"hitPoints":{"average":7,"roll":"3d4"},
   "speed":{"walk":40,"fly":40},
   "abilities":{"str":5,"dex":17,"con":10,"int":7,"wis":10,"cha":10},
   "skills":{"en":[" Stealth +5 "],"es":[" Sigilo +5 "]},
   "damageResistances":{"en":"cold, fire; bludgeoning, piercing, slashing from nonmagical attacks","es":"frío, fuego; contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 10","es":"visión en la oscuridad 18 m, Percepción pasiva 10"},
   "languages":{"en":"Abyssal, Common","es":"Abisal, Común"},
   "challengeRating":"1",
   "traits":[
     {"name":{"en":"Shapechanger","es":"Cambiaformas"},
      "text":{"en":"Can turn into a bat or centipede.","es":"Puede volverse murciélago o ciempiés."}},
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells.","es":"Ventaja en salvaciones vs conjuros."}} ],
   "actions":[
     {"name":{"en":"Claws (Bat, Centipede, or Quasit Form)","es":"Garras (Murciélago, Ciempiés o Quasit)"},
      "text":{"en":"+4 to hit, reach 5 ft. Hit: 5 (1d4 + 3) slashing + DC 10 CON or 2d6 poison.","es":"+4 al impacto, alcance 1,5 m. Impacto: 5 (1d4 + 3) cortante + CON CD 10 o 2d6 veneno."}} ] },

  {"id":"dretch","name":{"en":"Dretch","es":"Dretch"},
   "slug":"dretch","size":"Small","type":{"en":"fiend (demon)","es":"infernal (demonio)"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":11,"hitPoints":{"average":18,"roll":"4d6 + 4"},
   "speed":{"walk":20},
   "abilities":{"str":11,"dex":11,"con":12,"int":5,"wis":8,"cha":3},
   "damageResistances":{"en":"cold, fire; bludgeoning, piercing, slashing from nonmagical attacks","es":"frío, fuego; contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"darkvision 60 ft., passive Perception 9","es":"visión en la oscuridad 18 m, Percepción pasiva 9"},
   "languages":{"en":"Abyssal, understands Common but can't speak","es":"Abisal, entiende Común pero no habla"},
   "challengeRating":"1/4",
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two claw attacks.","es":"Dos ataques de garra."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+2 to hit. Hit: 3 (1d4 + 1) slashing.","es":"+2 al impacto. Impacto: 3 (1d4 + 1) cortante."}},
     {"name":{"en":"Fetid Cloud (1/Day)","es":"Nube Fétida (1/día)"},
      "text":{"en":"5-ft cube within 30 ft, 1d10 min. CON 11 or poisoned; -2 ability checks; 1d8 damage moved out.","es":"Cubo 1,5 m hasta 9 m, 1d10 min. CON CD 11 o envenenado; -2 pruebas; 1d8 daño al salir."}} ] },

  {"id":"barbed_devil","name":{"en":"Barbed Devil","es":"Diablo Espinosa"},
   "slug":"barbed_devil","size":"Medium","type":{"en":"fiend (devil)","es":"infernal (diablo)"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":15,"hitPoints":{"average":110,"roll":"13d8 + 52"},
   "speed":{"walk":30},
   "abilities":{"str":16,"dex":17,"con":18,"int":12,"wis":14,"cha":14},
   "damageResistances":{"en":"cold; bludgeoning, piercing, slashing from nonmagical attacks that aren't silvered","es":"frío; contundente, perforante, cortante no plateado"},
   "damageImmunities":{"en":"fire, poison","es":"fuego, veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"darkvision 120 ft., passive Perception 12","es":"visión en la oscuridad 36 m, Percepción pasiva 12"},
   "languages":{"en":"Infernal, Common","es":"Infernal, Común"},
   "challengeRating":"5",
   "traits":[
     {"name":{"en":"Barbed Hide","es":"Piel Espinoso"},
      "text":{"en":"At start of turn within 5 ft: 5 (1d4 + 3) piercing.","es":"Inicio del turno a 1,5 m: 5 (1d4 + 3) perforante."}},
     {"name":{"en":"Devil's Sight","es":"Vista del Diablo"},
      "text":{"en":"Magical darkness doesn't impede darkvision.","es":"Oscuridad mágica no impide visión en la oscuridad."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks: two claws + one tail, or three hurl flame.","es":"Tres ataques: dos garras + uno cola, o tres lanzar llamas."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+6 to hit. Hit: 6 (1d6 + 3) piercing.","es":"+6 al impacto. Impacto: 6 (1d6 + 3) perforante."}},
     {"name":{"en":"Tail","es":"Cola"},
      "text":{"en":"+6 to hit. Hit: 10 (2d6 + 3) piercing + DC 14 INT or 7 (2d6) fire and frightened.","es":"+6 al impacto. Impacto: 10 (2d6 + 3) perforante + INT CD 14 o 7 (2d6) fuego y asustado."}},
     {"name":{"en":"Hurl Flame","es":"Lanzar Llamas"},
      "text":{"en":"+5 to hit, range 150 ft. Hit: 10 (3d6) fire.","es":"+5 al impacto, alcance 45 m. Impacto: 10 (3d6) fuego."}} ] },

  {"id":"hezrou","name":{"en":"Hezrou","es":"Hezrou"},
   "slug":"hezrou","size":"Large","type":{"en":"fiend (demon)","es":"infernal (demonio)"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":16,"hitPoints":{"average":136,"roll":"13d10 + 65"},
   "speed":{"walk":30,"climb":15,"swim":15},
   "abilities":{"str":19,"dex":16,"con":18,"int":5,"wis":12,"cha":13},
   "damageResistances":{"en":"cold, fire; bludgeoning, piercing, slashing from nonmagical attacks","es":"frío, fuego; contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"darkvision 120 ft., passive Perception 11","es":"visión en la oscuridad 36 m, Percepción pasiva 11"},
   "languages":{"en":"Abyssal, understands Common but can't speak","es":"Abisal, entiende Común pero no habla"},
   "challengeRating":"8",
   "traits":[
     {"name":{"en":"Devil\u2019s Sight/See Invisibility","es":"Vista del Diablo"},"text":{"en":"Magical dark doesn't impede darkvision; can see invisible.","es":"Oscuridad mágica no impide visión en la oscuridad; ve lo invisible."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks: two claws + one bite, or two claw + fist.","es":"Tres ataques: dos garras + uno mordisco, o dos garra + puño."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+7 to hit. Hit: 15 (2d10 + 4) piercing.","es":"+7 al impacto. Impacto: 15 (2d10 + 4) perforante."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+7 to hit. Hit: 11 (2d6 + 4) slashing.","es":"+7 al impacto. Impacto: 11 (2d6 + 4) cortante."}},
     {"name":{"en":"Fist","es":"Puño"},
      "text":{"en":"+7 to hit. Hit: 14 (2d8 + 4) bludgeoning + DC 14 STR or 5 (1d10) acid.","es":"+7 al impacto. Impacto: 14 (2d8 + 4) contundente + FUE CD 14 o 5 (1d10) ácido."}} ] },

  {"id":"glabrezu","name":{"en":"Glabrezu","es":"Glabrezu"},
   "slug":"glabrezu","size":"Large","type":{"en":"fiend (demon)","es":"infernal (demonio)"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":17,"hitPoints":{"average":157,"roll":"15d10 + 75"},
   "speed":{"walk":40},
   "abilities":{"str":20,"dex":15,"con":21,"int":19,"wis":17,"cha":18},
   "damageResistances":{"en":"cold, fire; bludgeoning, piercing, slashing from nonmagical attacks","es":"frío, fuego; contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"truesight 120 ft., passive Perception 13","es":"visión verdadera 36 m, Percepción pasiva 13"},
   "languages":{"en":"Abyssal, Common","es":"Abisal, Común"},
   "challengeRating":"9",
   "traits":[
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells and magical effects.","es":"Ventaja en salvaciones vs conjuros y efectos mágicos."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two pincer attacks + two fist attacks.","es":"Dos pinzas + dos puños."}},
     {"name":{"en":"Pincer","es":"Pinza"},
      "text":{"en":"+9 to hit. Hit: 16 (2d10 + 5) bludgeoning. DC 15 STR or grappled + 16 (2d10) acid.","es":"+9 al impacto. Impacto: 16 (2d10 + 5) contundente. FUE CD 15 o agarrado + 16 (2d10) ácido."}},
     {"name":{"en":"Fist","es":"Puño"},
      "text":{"en":"+9 to hit. Hit: 13 (2d8 + 5) bludgeoning + DC 15 INT or 13 (3d8) fire and blinded 1 min.","es":"+9 al impacto. Impacto: 13 (2d8 + 5) contundente + INT CD 15 o 13 (3d8) fuego + cegado 1 min."}} ],
   "legendaryActions":[
     {"name":{"en":"Pincer","es":"Pinza"},
      "text":{"en":"Make one pincer attack.","es":"Hace un ataque de pinza."}},
     {"name":{"en":"Fist (Costs 2)","es":"Puño (Coste 2)"},
      "text":{"en":"Make one fist attack.","es":"Hace un ataque de puño."}} ] },

  {"id":"erinyes","name":{"en":"Erinyes","es":"Erínyes"},
   "slug":"erinyes","size":"Medium","type":{"en":"fiend (devil)","es":"infernal (diablo)"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":18,"hitPoints":{"average":153,"roll":"18d8 + 72"},
   "speed":{"walk":30,"fly":60},
   "abilities":{"str":18,"dex":16,"con":18,"int":14,"wis":14,"cha":18},
   "damageResistances":{"en":"cold; bludgeoning, piercing, slashing from nonmagical attacks that aren't silvered","es":"frío; contundente, perforante, cortante no plateado"},
   "damageImmunities":{"en":"fire, poison","es":"fuego, veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"truesight 120 ft., passive Perception 12","es":"visión verdadera 36 m, Percepción pasiva 12"},
   "languages":{"en":"Infernal, Common","es":"Infernal, Común"},
   "challengeRating":"12",
   "traits":[
     {"name":{"en":"Devil\u2019s Sight","es":"Vista del Diablo"},
      "text":{"en":"Magical darkness doesn't impede darkvision.","es":"Oscuridad mágica no impide visión en la oscuridad."}},
     {"name":{"en":"Hellish Weapons","es":"Armas Infernal"},
      "text":{"en":"Longsword/greatbow are magical +1d8 fire on hit.","es":"Espada larga/arco mágico +1d8 fuego al impacto."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks: two longsword + one barbed tail, or three greatbow.","es":"Tres ataques: dos espada larga + uno cola espinosa, o tres arco grande."}},
     {"name":{"en":"Longsword","es":"Espada Larga"},
      "text":{"en":"+8 to hit, reach 10 ft. Hit: 15 (2d10 + 4) slashing + 4 (1d8) fire.","es":"+8 al impacto, alcance 3 m. Impacto: 15 (2d10 + 4) cortante + 4 (1d8) fuego."}},
     {"name":{"en":"Greatbow","es":"Arco Grande"},
      "text":{"en":"+8 to hit, range 150/600 ft. Hit: 13 (2d8 + 4) piercing + 4 (1d8) fire.","es":"+8 al impacto, alcance 45/180 m. Impacto: 13 (2d8 + 4) perforante + 4 (1d8) fuego."}},
     {"name":{"en":"Barbed Tail","es":"Cola Espinosa"},
      "text":{"en":"+8 to hit. Hit: 13 (2d8 + 4) piercing + DC 13 CON or 24 (7d6) poison (half).","es":"+8 al impacto. Impacto: 13 (2d8 + 4) perforante + CON CD 13 o 24 (7d6) veneno (mitad)."}} ] },

  {"id":"balor","name":{"en":"Balor","es":"Balor"},
   "slug":"balor","size":"Huge","type":{"en":"fiend (demon)","es":"infernal (demonio)"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":19,"hitPoints":{"average":262,"roll":"21d12 + 126"},
   "speed":{"walk":40,"fly":80},
   "abilities":{"str":26,"dex":15,"con":22,"int":7,"wis":18,"cha":22},
   "saves":{"en":[" STR +14 "," DEX +8 "," CON +12 "," WIS +10 "," CHA +12 "],"es":[" FUE +14 "," DES +8 "," CON +12 "," SAB +10 "," CAR +12 "]},
   "damageResistances":{"en":"cold, fire; bludgeoning, piercing, slashing from nonmagical attacks","es":"frío, fuego; contundente, perforante, cortante no mágico"},
   "damageImmunities":{"en":"lightning, poison","es":"relámpago, veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"truesight 120 ft., passive Perception 14","es":"visión verdadera 36 m, Percepción pasiva 14"},
   "languages":{"en":"Abyssal, Common","es":"Abisal, Común"},
   "challengeRating":"19",
   "traits":[
     {"name":{"en":"Devil\u2019s Sight","es":"Vista del Diablo"},
      "text":{"en":"Magical darkness doesn't impede darkvision.","es":"Oscuridad mágica no impide visión en la oscuridad."}},
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells.","es":"Ventaja en salvaciones vs conjuros."}},
     {"name":{"en":"Lightning Aura","es":"Aura de Relámpago"},
      "text":{"en":"30 ft: lightning damage + DC 16 DEX or stunned.","es":"9 m: daño relámpago + DES CD 16 o aturdido."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Two sword attacks OR one whip + one sword.","es":"Dos ataques de espada OR uno látigo + uno espada."}},
     {"name":{"en":"Greatsword","es":"Espadazo"},
      "text":{"en":"+14 to hit. Hit: 31 (6d6 + 12) slashing + 10 (3d6) lightning.","es":"+14 al impacto. Impacto: 31 (6d6 + 12) cortante + 10 (3d6) relámpago."}},
     {"name":{"en":"Whip","es":"Látigo"},
      "text":{"en":"+14 to hit, reach 30 ft. Hit: 15 (2d6 + 12) slashing + DC 16 STR or pulled 25 ft + 16 (3d10) fire.","es":"+14 al impacto, alcance 9 m. Impacto: 15 (2d6 + 12) cortante + FUE CD 16 o 7,5 m atracción + 16 (3d10) fuego."}},
     {"name":{"en":"Death Throes","es":"Estertores de Muerte"},
      "text":{"en":"When reduced to 0 HP: 30-ft radius 21 (6d6) fire, DC 15 DEX half; explodes.","es":"Reducido a 0 HP: radio 9 m 21 (6d6) fuego, DES CD 15 mitad; explota."}} ] },

  {"id":"pit_fiend","name":{"en":"Pit Fiend","es":"Señor Infernal"},
   "slug":"pit_fiend","size":"Large","type":{"en":"fiend (devil)","es":"infernal (diablo)"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":19,"hitPoints":{"average":300,"roll":"24d10 + 168"},
   "speed":{"walk":30,"fly":60,"climb":30},
   "abilities":{"str":26,"dex":14,"con":26,"int":22,"wis":18,"cha":24},
   "saves":{"en":[" DEX +8 "," CON +14 "," WIS +10 "," CHA +13 "],"es":[" DES +8 "," CON +14 "," SAB +10 "," CAR +13 "]},
   "damageResistances":{"en":"cold; bludgeoning, piercing, slashing from nonmagical attacks that aren't silvered","es":"frío; contundente, perforante, cortante no plateado"},
   "damageImmunities":{"en":"fire, poison","es":"fuego, veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"truesight 120 ft., passive Perception 14","es":"visión verdadera 36 m, Percepción pasiva 14"},
   "languages":{"en":"Infernal, Common","es":"Infernal, Común"},
   "challengeRating":"20",
   "traits":[
     {"name":{"en":"Devil\u2019s Sight","es":"Vista del Diablo"},
      "text":{"en":"Magical darkness doesn't impede darkvision.","es":"Oscuridad mágica no impide visión en la oscuridad."}},
     {"name":{"en":"Magic Resistance","es":"Resistencia a Magia"},
      "text":{"en":"Advantage on saves vs. spells.","es":"Ventaja en salvaciones vs conjuros."}},
     {"name":{"en":"Fear Aura","es":"Aura de Miedo"},
      "text":{"en":"30 ft: WIS 16 or frightened; immune on success for 24 h.","es":"9 m: SAB CD 16 o asustado; inmune si pasa 24 h."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Four attacks: two claws + two fork OR bite + two fork + one claw.","es":"Cuatro ataques: dos garras + dos horca OR mordisco + dos horca + una garra."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+14 to hit. Hit: 22 (3d8 + 9) piercing + 14 (4d6) fire.","es":"+14 al impacto. Impacto: 22 (3d8 + 9) perforante + 14 (4d6) fuego."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+14 to hit. Hit: 18 (2d8 + 10) slashing.","es":"+14 al impacto. Impacto: 18 (2d8 + 10) cortante."}},
     {"name":{"en":"Fork","es":"Horca"},
      "text":{"en":"+14 to hit. Hit: 16 (2d8 + 8) piercing + DC 18 CON or 21 (6d6) poison (half).","es":"+14 al impacto. Impacto: 16 (2d8 + 8) perforante + CON CD 18 o 21 (6d6) veneno (mitad)."}} ] },

  # ──── DRAGON (7) ────
  {"id":"adult_black_dragon","name":{"en":"Adult Black Dragon","es":"Dragón Negro Adulto"},
   "slug":"adult_black_dragon","size":"Huge","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":19,"hitPoints":{"average":195,"roll":"17d10 + 102"},
   "speed":{"walk":40,"fly":80,"swim":40},
   "abilities":{"str":23,"dex":14,"con":21,"int":14,"wis":13,"cha":19},
   "saves":{"en":[" DEX +7 "," CON +10 "," WIS +6 "," CHA +9 "],"es":[" DES +7 "," CON +10 "," SAB +6 "," CAR +9 "]},
   "skills":{"en":[" Perception +9 "," Stealth +7 "],"es":[" Percepción +9 "," Sigilo +7 "]},
   "damageImmunities":{"en":"acid","es":"ácido"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 19","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 19"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"14",
   "traits":[
     {"name":{"en":"Amphibious","es":"Anfibio"},
      "text":{"en":"Can breathe air and water.","es":"Puede respirar aire y agua."}},
     {"name":{"en":"Legendary Resistance (3/Day)","es":"Resistencia Legendaria (3/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks: bite + two claws.","es":"Tres ataques: mordisco + dos garras."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+11 to hit. Hit: 17 (2d10 + 6) piercing + 4 (1d8) acid.","es":"+11 al impacto. Impacto: 17 (2d10 + 6) perforante + 4 (1d8) ácido."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+11 to hit. Hit: 13 (2d6 + 6) slashing.","es":"+11 al impacto. Impacto: 13 (2d6 + 6) cortante."}},
     {"name":{"en":"Acid Breath (Recharge 5\u20136)","es":"Aliento Ácido (Recarga 5\u20136)"},
      "text":{"en":"90-ft line 5 ft wide; DEX 17 or 56 (16d6) acid half.","es":"Línea 27 m de 1,5 m ancho; DES CD 17 o 56 (16d6) ácido mitad."}} ],
   "legendaryActions":[
     {"name":{"en":"Wing Attack (Costs 2)","es":"Ataque de Ala (Coste 2)"},
      "text":{"en":"Beats wings: each within 15 ft DEX 16 or knocked prone + pushed. Up to half speed as fly.","es":"Aletea: cada uno a 4,5 m DES CD 16 o derribado + empujado. Vuela hasta mitad velocidad."}},
     {"name":{"en":"Tail Attack","es":"Ataque de Cola"},
      "text":{"en":"Make tail attack (same as claw).","es":"Hace ataque de cola (igual a garra)."},
     {"name":{"en":"Detect","es":"Detectar"},
      "text":{"en":"Makes a Perception check.","es":"Hace una prueba de Percepción."}} ] },

  {"id":"adult_blue_dragon","name":{"en":"Adult Blue Dragon","es":"Dragón Azul Adulto"},
   "slug":"adult_blue_dragon","size":"Huge","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":19,"hitPoints":{"average":212,"roll":"18d10 + 108"},
   "speed":{"walk":40,"fly":80,"burrow":20},
   "abilities":{"str":25,"dex":10,"con":23,"int":16,"wis":15,"cha":19},
   "saves":{"en":[" DEX +5 "," CON +11 "," WIS +7 "," CHA +9 "],"es":[" DES +5 "," CON +11 "," SAB +7 "," CAR +9 "]},
   "skills":{"en":[" Perception +12 "," Stealth +5 "],"es":[" Percepción +12 "," Sigilo +5 "]},
   "damageImmunities":{"en":"lightning","es":"relámpago"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 22","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 22"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"16",
   "traits":[
     {"name":{"en":"Legendary Resistance (3/Day)","es":"Resistencia Legendaria (3/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}},
     {"name":{"en":"Lightning Breath (Recharge 5\u20136)","es":"Alimento Relámpago"},"text":{"en":"120-ft line 5 ft wide; DEX 17 or 72 (18d8) lightning (half).","es":"Línea 36 m 1,5 m; DES CD 17 o 72 (18d8) relámpago (mitad)."} } ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks + tail: bite + two claws + tail.","es":"Tres ataques + cola: mordisco + dos garras + cola."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+12 to hit. Hit: 18 (2d10 + 7) piercing + 4 (1d8) lightning.","es":"+12 al impacto. Impacto: 18 (2d10 + 7) perforante + 4 (1d8) relámpago."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+12 to hit. Hit: 14 (2d6 + 7) slashing.","es":"+12 al impacto. Impacto: 14 (2d6 + 7) cortante."}} ] },

  {"id":"adult_green_dragon","name":{"en":"Adult Green Dragon","es":"Dragón Verde Adulto"},
   "slug":"adult_green_dragon","size":"Huge","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":19,"hitPoints":{"average":207,"roll":"18d10 + 108"},
   "speed":{"walk":40,"fly":80,"swim":40},
   "abilities":{"str":23,"dex":12,"con":21,"int":18,"wis":15,"cha":17},
   "saves":{"en":[" DEX +6 "," CON +10 "," WIS +7 "," CHA +8 "],"es":[" DES +6 "," CON +10 "," SAB +7 "," CAR +8 "]},
   "skills":{"en":[" Deception +8 "," Perception +9 "," Stealth +6 "],"es":[" Engaño +8 "," Percepción +9 "," Sigilo +6 "]},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 19","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 19"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"15",
   "traits":[
     {"name":{"en":"Amphibious","es":"Anfibio"},
      "text":{"en":"Can breathe air and water.","es":"Puede respirar aire y agua."}},
     {"name":{"en":"Legendary Resistance (3/Day)","es":"Resistencia Legendaria (3/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks + tail: bite + two claws + tail.","es":"Tres ataques + cola: mordisco + dos garras + cola."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+10 to hit. Hit: 17 (2d10 + 6) piercing + 7 (2d6) poison.","es":"+10 al impacto. Impacto: 17 (2d10 + 6) perforante + 7 (2d6) veneno."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+10 to hit. Hit: 13 (2d6 + 6) slashing.","es":"+10 al impacto. Impacto: 13 (2d6 + 6) cortante."}},
     {"name":{"en":"Poison Breath (Recharge 5\u20136)","es":"Aliento Venenoso (Recarga 5\u20136)"},
      "text":{"en":"90-ft cone; CON 15 or 56 (16d6) poison (half).","es":"Cono 27 m; CON CD 15 o 56 (16d6) veneno (mitad)."} } ] },

  {"id":"adult_white_dragon","name":{"en":"Adult White Dragon","es":"Dragón Blanco Adulto"},
   "slug":"adult_white_dragon","size":"Huge","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":18,"hitPoints":{"average":200,"roll":"16d10 + 112"},
   "speed":{"walk":40,"fly":80,"burrow":20,"swim":40},
   "abilities":{"str":22,"dex":10,"con":22,"int":8,"wis":12,"cha":14},
   "saves":{"en":[" DEX +5 "," CON +11 "," WIS +6 "," CHA +7 "],"es":[" DES +5 "," CON +11 "," SAB +6 "," CAR +7 "]},
   "skills":{"en":[" Perception +11 "," Stealth +5 "],"es":[" Percepción +11 "," Sigilo +5 "]},
   "damageImmunities":{"en":"cold","es":"frío"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 21","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 21"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"13",
   "traits":[
     {"name":{"en":"Ice Walk","es":"Caminar sobre Hielo"},
      "text":{"en":"Moves across icy terrain without penalty.","es":"Moverse por terreno helado sin penalización."}},
     {"name":{"en":"Legendary Resistance (3/Day)","es":"Resistencia Legendaria (3/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks + tail: bite + two claws + tail.","es":"Tres ataques + cola: mordisco + dos garras + cola."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+10 to hit. Hit: 17 (2d10 + 6) piercing + 4 (1d8) cold.","es":"+10 al impacto. Impacto: 17 (2d10 + 6) perforante + 4 (1d8) frío."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+10 to hit. Hit: 13 (2d6 + 6) slashing.","es":"+10 al impacto. Impacto: 13 (2d6 + 6) cortante."}},
     {"name":{"en":"Cold Breath (Recharge 5\u20136)","es":"Aliento Frío (Recarga 5\u20136)"},
      "text":{"en":"90-ft cone; CON 15 or 54 (12d8) cold (half).","es":"Cono 27 m; CON CD 15 o 54 (12d8) frío (mitad)."} } ] },

  {"id":"ancient_blue_dragon","name":{"en":"Ancient Blue Dragon","es":"Dragón Azul Antiguo"},
   "slug":"ancient_blue_dragon","size":"Gargantuan","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":22,"hitPoints":{"average":481,"roll":"26d20 + 130"},
   "speed":{"walk":50,"fly":120,"burrow":30},
   "abilities":{"str":27,"dex":10,"con":25,"int":16,"wis":15,"cha":19},
   "saves":{"en":[" DEX +5 "," CON +12 "," WIS +7 "," CHA +9 "],"es":[" DES +5 "," CON +12 "," SAB +7 "," CAR +9 "]},
   "skills":{"en":[" Perception +13 "],"es":[" Percepción +13 "]},
   "damageImmunities":{"en":"lightning","es":"relámpago"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 23","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 23"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"22",
   "traits":[
     {"name":{"en":"Legendary Resistance (5/Day)","es":"Resistencia Legendaria (5/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Five attacks: bite + two claws, two wings or tail or breath weapon.","es":"Cinco ataques: mordisco + dos garras, dos alas o cola o aliento."}},
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+14 to hit. Hit: 21 (2d10 + 8) piercing + 4 (1d8) lightning.","es":"+14 al impacto. Impacto: 21 (2d10 + 8) perforante + 4 (1d8) relámpago."}},
     {"name":{"en":"Claw","es":"Garra"},
      "text":{"en":"+14 to hit. Hit: 16 (2d6 + 8) slashing.","es":"+14 al impacto. Impacto: 16 (2d6 + 8) cortante."}},
     {"name":{"en":"Lightning Breath (Recharge 5\u20136)","es":"Alimento Relampagueante (Recarga 5\u20136)"},
      "text":{"en":"120-ft line 10 ft wide; DEX 19 or 96 (32d6) lightning half.","es":"Línea 36 m, 3 m ancho; DES CD 19 o 96 (32d6) relámpago mitad."}} ],
   "legendaryActions":[
     {"name":{"en":"Wing Attack (Costs 2)","es":"Ataque de Ala (Coste 2)"},
      "text":{"en":"Beats wings; each within 25 ft DEX 19 or knocked prone.","es":"Aletea; cada uno a 7,5 m DES CD 19 o derribado."}},
     {"name":{"en":"Detect","es":"Detectar"},
      "text":{"en":"Makes a Perception check.","es":"Hace una prueba de Percepción."}},
     {"name":{"en":"Tail Attack","es":"Ataque de Cola"},
      "text":{"en":"Tail attack same as claw.","es":"Ataque de cola igual a garra."}} ] },

  {"id":"ancient_green_dragon","name":{"en":"Ancient Green Dragon","es":"Dragón Verde Antiguo"},
   "slug":"ancient_green_dragon","size":"Gargantuan","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"lawful evil","es":"legal maligno"},
   "armorClass":21,"hitPoints":{"average":385,"roll":"22d20 + 88"},
   "speed":{"walk":50,"fly":100,"swim":50},
   "abilities":{"str":25,"dex":12,"con":21,"int":20,"wis":17,"cha":19},
   "saves":{"en":[" DEX +6 "," CON +10 "," WIS +8 "," CHA +9 "],"es":[" DES +6 "," CON +10 "," SAB +8 "," CAR +9 "]},
   "skills":{"en":[" Deception +10 "," Perception +9 "],"es":[" Engaño +10 "," Percepción +9 "]},
   "damageImmunities":{"en":"poison","es":"veneno"},
   "conditionImmunities":{"en":"poisoned","es":"envenenado"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 19","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 19"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"21",
   "traits":[
     {"name":{"en":"Amphibious","es":"Anfibio"},
      "text":{"en":"Can breathe air and water.","es":"Puede respirar aire y agua."}},
     {"name":{"en":"Legendary Resistance (5/Day)","es":"Resistencia Legendaria (5/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Three attacks + four claw/tail: bite + two claws + four tail (Wing Attack replaces).","es":"Tres ataques + cuatro garra/cola: mordisco + dos garras + cuatro cola (Ataque de Ala reemplaza)."} } ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+11 to hit. Hit: 18 (2d10 + 7) piercing + 10 (3d6) poison.","es":"+11 al impacto. Impacto: 18 (2d10 + 7) perforante + 10 (3d6) veneno."}},
     {"name":{"en":"Poison Breath (Recharge 5\u20136)","es":"Alimento Venenoso (Recarga 5\u20136)"},
      "text":{"en":"90-ft cone; CON 19 or 77 (22d6) poison half.","es":"Cono 27 m; CON CD 19 o 77 (22d6) veneno mitad."}} ] },

  {"id":"ancient_white_dragon","name":{"en":"Ancient White Dragon","es":"Dragón Blanco Antiguo"},
   "slug":"ancient_white_dragon","size":"Gargantuan","type":{"en":"dragon","es":"dragón"},
   "alignment":{"en":"chaotic evil","es":"caótico maligno"},
   "armorClass":22,"hitPoints":{"average":420,"roll":"24d20 + 96"},
   "speed":{"walk":50,"fly":120,"burrow":30,"swim":50},
   "abilities":{"str":24,"dex":10,"con":24,"int":8,"wis":12,"cha":14},
   "saves":{"en":[" DEX +5 "," CON +12 "," WIS +6 "," CHA +7 "],"es":[" DES +5 "," CON +12 "," SAB +6 "," CAR +7 "]},
   "skills":{"en":[" Perception +11 "],"es":[" Percepción +11 "]},
   "damageImmunities":{"en":"cold","es":"frío"},
   "senses":{"en":"blindsight 60 ft., darkvision 120 ft., passive Perception 21","es":"visión ciega 18 m, visión en la oscuridad 36 m, Percepción pasiva 21"},
   "languages":{"en":"Common, Draconic","es":"Común, Dracónic"},
   "challengeRating":"20",
   "traits":[
     {"name":{"en":"Ice Walk","es":"Caminar sobre Hielo"},
      "text":{"en":"Moves across icy terrain without penalty.","es":"Moverse por terreno helado sin penalización."}},
     {"name":{"en":"Legendary Resistance (5/Day)","es":"Resistencia Legendaria (5/día)"},
      "text":{"en":"If fails save, can choose to succeed.","es":"Si falla, elige éxito."}} ],
   "actions":[
     {"name":{"en":"Multiattack","es":"Ataque Múltiple"},
      "text":{"en":"Bite + two claws, plus tail optionally (or breath).","es":"Mordisco + dos garras, más cola opcionalmente (o aliento)."} } ],
   "actions":[
     {"name":{"en":"Bite","es":"Mordisco"},
      "text":{"en":"+12 to hit. Hit: 19 (2d10 + 7) piercing + 4 (1d8) cold.","es":"+12 al impacto. Impacto: 19 (2d10 + 7) perforante + 4 (1d8) frío."}},
     {"name":{"en":"Cold Breath (Recharge 5\u20136)","es":"Alimento de Hielo (Recarga 5\u20136)"},
      "text":{"en":"90-ft cone; CON 19 or 72 (16d8) cold half.","es":"Cono 27 m; CON CD 19 o 72 (16d8) frío mitad."}} ] },
]

def localize(val, lang):
    if isinstance(val, dict) and "en" in val and "es" in val and set(val.keys()) <= {"en", "es"}:
        return val.get(lang, "")
    if isinstance(val, list):
        return [localize(v, lang) for v in val]
    if isinstance(val, dict):
        return {k: localize(v, lang) for k, v in val.items()}
    return val

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
