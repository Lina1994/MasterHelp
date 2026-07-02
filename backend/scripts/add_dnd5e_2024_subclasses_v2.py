#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v2: Additive merge of ~40 SRD 5.2 (2024) canonical subclasses to fill the gap from
2 → 4-6 per class. Covers Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin,
Ranger, Rogue, Sorcerer, Warlock, Wizard — 12 base classes.

Pattern (proven from spells/monsters v4):
  - dict-of-properties bilingual source: `{"en":..., "es":...}` for name/description
  - localize() walker extracts per-language
  - additive merge keyed on `id` per class (non-destructive)
  - flat per-language class JSON files (matching what classes.service.ts loader reads)
"""
from __future__ import annotations
import json, pathlib
from typing import Any

ROOT = pathlib.Path('data/manuals/dnd5e-2024/classes')
EN_DIR = ROOT / 'en'
ES_DIR = ROOT / 'es'

# Each SUBCLASS entry: {class_id, id, name {en,es}, grantedAtLevel, description {en,es},
#                        features: [{id, name {en,es}, level, description {en,es}, effects}]}
SUBCLASSES: list[dict[str, Any]] = [
  # ───────────────────────────── BARBARIAN (+3) ────────────────────────────
  {"class_id":"barbarian","id":"path_of_the_wild_heart",
   "name":{"en":"Path of the Wild Heart","es":"Sendero del Corazón Salvaje"},
   "grantedAtLevel":3,
   "description_en":"You draw on the primal bond between barbarian and beast. Animals sense your kinship and your rage lets you channel beast-like power.",
   "description_es":"Te nutres del vínculo primordial entre bárbaro y bestia. Los animales perciben tu afinidad y tu furia canaliza un poder bestial.",
   "features":[
     {"id":"animal_speaker","name":{"en":"Animal Speaker","es":"Hablante Animal"},"level":3,
      "description":{"en":"Through sound and gesture, you gain the ability to communicate with Beasts and you always know their location within 30 ft of you.","es":"Con sonido y gesto, puedes comunicarte con bestias y siempre conoces su ubicación a 9 m de distancia."}},
     {"id":"aspect_of_the_wild","name":{"en":"Aspect of the Wild","es":"Aspecto de lo Salvaje"},"level":6,
      "description":{"en":"You gain resistance to a damage type based on your aspect: Bear (force your mark), Eagle (knock back), Wolf (push effect).","es":"Resistencia a un tipo de daño según tu aspecto: Oso (forzar marca), Águila (empuje), Lobo (efecto de empuje)."}},
     {"id":"bestial_soul","name":{"en":"Bestial Soul","es":"Alma Bestial"},"level":10,
      "description":{"en":"You gain a flying speed 30 ft OR a swimming speed 30 ft OR a climb speed 30 ft.","es":"Ganas velocidad de vuelo 9 m O nado 9 m O escalada 9 m."}},
     {"id":"wilderness_magician","name":{"en":"Wilderness Magician","es":"Mago de la Naturaleza"},"level":14,
      "description":{"en":"You learn spells from the druid spell list (Wisdom saves).","es":"Aprendes hechizos de la lista del druida (Sabiduría)."} } ] },
  {"class_id":"barbarian","id":"path_of_the_world_tree",
   "name":{"en":"Path of the World Tree","es":"Sendero del Árbol del Mundo"},
   "grantedAtLevel":3,
   "description_en":"Your rage harnesses the resilience of Yggdrasil, the World Tree. You can call on the cosmos for protection.",
   "description_es":"Tu furia canaliza la fortaleza de Yggdrasil, el Árbol del Mundo. Puedes invocar la protección del cosmos.",
   "features":[
     {"id":"world_tree_walker","name":{"en":"World Tree Walker","es":"Caminante del Árbol"},"level":3,
      "description":{"en":"You gain a climb speed equal to your walking speed.","es":"Ganas velocidad de escalada igual a tu velocidad de caminar."}},
     {"id":"branches_of_the_tree","name":{"en":"Branches of the Tree","es":"Ramas del Árbol"},"level":6,
      "description":{"en":"While raging, you gain 2d6 temp HP at the start of each turn.","es":"Mientras estás en furia, ganas 2d6 pg temporales al inicio de cada turno."}},
     {"id":"verdant_pierce","name":{"en":"Verdant Pierce","es":"Perforación Verdosa"},"level":10,
      "description":{"en":"Vertically grow branches that turn into piercing damage behind you.","es":"Las ramas crecen verticalmente detrás de ti y se vuelven daño perforante."}},
     {"id":"mighty_descent","name":{"en":"Mighty Descent","es":"Descenso Poderoso"},"level":14,
      "description":{"en":"You can reduce falling damage; once per long rest, knock prone all creatures in 30-ft radius on impact.","es":"Reduce daño por caída; una vez por descanso prolongado, derriba a todas las criaturas en un radio de 9 m al impactar."}} ] },
  {"class_id":"barbarian","id":"path_of_the_zealot",
   "name":{"en":"Path of the Zealot","es":"Sendero del Celador"},
   "grantedAtLevel":3,
   "description_en":"Your rage is fueled by a fierce devotion to a deity, cause, or creed. You undergo divine transformations in battle.",
   "description_es":"Tu furia se alimenta de una devoción feroz a una deidad, causa o credo. Sufres transformaciones divinas en batalla.",
   "features":[
     {"id":"divine_fury","name":{"en":"Divine Fury","es":"Furia Divina"},"level":3,
      "description":{"en":"While raging, the first creature you hit on each turn takes extra 1d6 + half barb level radiant or necrotic damage (your choice).","es":"En furia, la primera criatura impactada por turno recibe 1d6 + mitad de nivel bárbaro radiante o necrótico (tú eliges)."}},
     {"id":"warrior_of_the_gods","name":{"en":"Warrior of the Gods","es":"Guerrero de los Dioses"},"level":6,
      "description":{"en":"Spell resurrection targeting you has a 50% chance of failure.","es":"Conjuros de resurrección contra ti tienen 50% de fallo."}},
     {"id":"frenzied_focus","name":{"en":"Frenzied Focus","es":"Foco Frenesí"},"level":10,
      "description":{"en":"Gain advantage on Constitution saves when raging.","es":"Ventaja en salvaciones de Constitución en furia."}},
     {"id":"zealous_presence","name":{"en":"Zealous Presence","es":"Presencia Celadora"},"level":14,
      "description":{"en":"As an action, force Wisdom save on creatures in 60-ft radius; on fail, charmed or frightened 1 min (you choose).","es":"Como acción, salvación de Sabiduría en radio 18 m; falla: encantado o asustado 1 min (tú eliges)."},"savingThrow":"Wisdom"} ] },

  # ───────────────────────────── BARD (+3) ────────────────────────────────
  {"class_id":"bard","id":"college_of_dance",
   "name":{"en":"College of Dance","es":"Colegio del Baile"},
   "grantedAtLevel":3,
   "description_en":"Your art is movement itself. You weaponize dance into combat grace, magic, and inspiration.",
   "description_es":"Tu arte es el movimiento mismo. Conviertes el baile en gracia combativa, magia e inspiración.",
   "features":[
     {"id":"dance_of_the_dawn","name":{"en":"Dance of the Dawn","es":"Danza del Alba"},"level":3,
      "description":{"en":"After a long rest, gain 4 inspiration points (instead of dice). Recover all expended inspiration on a short rest. Inspire by motion.","es":"Tras descanso prolongado, ganas 4 puntos de inspiración (en vez de dados). Recuperas toda la inspiración gastada en descanso corto."}},
     {"id":"defensive_dance","name":{"en":"Defensive Dance","es":"Baile Defensivo"},"level":6,
      "description":{"en":"When you damage a creature, you can move 30 ft and gain +10 to AC against their next attack this turn.","es":"Cuando dañas a una criatura, mueves 9 m y +10 a CA contra su próximo ataque este turno."}},
     {"id":"panache","name":{"en":"Panache","es":"Garbo"},"level":10,
      "description":{"en":"When you hit a creature, they have disadvantage on their next roll.","es":"Cuando impactas a una criatura, desventaja en su próxima tirada."}},
     {"id":"irrepressible_energy","name":{"en":"Irrepressible Energy","es":"Energía Irrefrenable"},"level":14,
      "description":{"en":"Once per short rest, succeed on a save vs. being charmed or frightened (no roll).","es":"Una vez por descanso corto, superas automáticamente una salvación contra encantamiento o miedo."}} ] },
  {"class_id":"bard","id":"college_of_glamour",
   "name":{"en":"College of Glamour","es":"Colegio del Glamur"},
   "grantedAtLevel":3,
   "description_en":"You weave fey magic through your art, taking on an otherworldly presence that enchants audiences.",
   "description_es":"Tejes magia feérica en tu arte, asumiendo una presencia sobrenatural que encanta al público.",
   "features":[
     {"id":"mantle_of_inspiration","name":{"en":"Mantle of Inspiration","es":"Manto de Inspiración"},"level":3,
      "description":{"en":"Inspiration dice grant temp HP equal to roll + Charisma mod instead of granting advantage.","es":"Dados de inspiración otorgan pg temporales iguales a la tirada + Carisma en vez de ventaja."}},
     {"id":"enthralling_performance","name":{"en":"Enthralling Performance","es":"Actuación Cautivadora"},"level":3,
      "description":{"en":"After 1 min of performance, Wis save or charmed for 1 min.","es":"Tras 1 min de actuación, Sabiduría o encantado 1 min."},"savingThrow":"Wisdom"},
     {"id":"unwavering_majesty","name":{"en":"Unwavering Majesty","es":"Majestad Firme"},"level":6,
      "description":{"en":"Reaction: make a creature reroll attack against you; the new roll is used.","es":"Reacción: una criatura repite su ataque contra ti; usa la nueva tirada."}},
     {"id":"synthetic_versification","name":{"en":"Synthetic Versification","es":"Versificación Sintética"},"level":14,
      "description":{"en":"Advantage on rolls to communicate nonverbally; bonus action cast Suggestion at will with no spell slot.","es":"Ventaja en tiradas de comunicación no verbal; puedes lanzar Sugestión sin gasto de slot."}} ] },
  {"class_id":"bard","id":"college_of_whispers",
   "name":{"en":"College of Whispers","es":"Colegio de los Susurros"},
   "grantedAtLevel":3,
   "description_en":"Your art is subversion. You infiltrate, manipulate, and strike from the shadows using words as weapons.",
   "description_es":"Tu arte es la subversión. Infiltras, manipulas y golpeas desde las sombras con palabras como arma.",
   "features":[
     {"id":"psychic_blades","name":{"en":"Psychic Blades","es":"Hojas Psíquicas"},"level":3,
      "description":{"en":"Use Bardic Inspiration dice to add psychic damage to weapon attacks.","es":"Usa dados de inspiración para añadir daño psíquico a ataques con armas."}},
     {"id":"words_of_terror","name":{"en":"Words of Terror","es":"Palabras de Terror"},"level":3,
      "description":{"en":"Action to curse a creature in 30 ft: +1d6 psychic damage on attacks; Wis save or frightened 1 min.","es":"Acción: maldices a una criatura a 9 m; +1d6 psíquico en ataques; Sabiduría o asustado 1 min."},"savingThrow":"Wisdom"},
     {"id":"mantle_of_whispers","name":{"en":"Mantle of Whispers","es":"Manto de Susurros"},"level":6,
      "description":{"en":"Reaction when a humanoid dies within 30 ft: assume their appearance and gain their memories for 1 hour.","es":"Reacción cuando un humanoide muere a 9 m: asumes su apariencia y obtienes sus memorias durante 1 hora."}},
     {"id":"shadow_lore","name":{"en":"Shadow Lore","es":"Saber Sombrio"},"level":14,
      "description":{"en":"Cast Major Image at will as a full action.","es":"Lanzar Imagen Mayor a voluntad como acción completa."}} ] },

  # ───────────────────────────── CLERIC (+4) ───────────────────────────────
  {"class_id":"cleric","id":"life_domain",
   "name":{"en":"Life Domain","es":"Dominio de Vida"},
   "grantedAtLevel":1,
   "description_en":"You serve a deity of healing, generosity, and compassion. Your magic sustains life and repels death.",
   "description_es":"Sírves a una deidad de sanación, generosidad y compasión. Tu magia sustenta la vida y repele la muerte.",
   "features":[
     {"id":"disciple_of_life","name":{"en":"Disciple of Life","es":"Discípulo de Vida"},"level":1,
      "description":{"en":"When casting cure/heal spells of 1st level or higher, the target regains bonus HP equal to 2 + spell level.","es":"Al lanzar conjuros de curación nivel 1+, el objetivo recibe pg extra igual a 2 + nivel."}},
     {"id":"preserve_life","name":{"en":"Preserve Life","es":"Preservar Vida"},"level":2,
      "description":{"en":"Action: restore HP up to 5×cleric level to creatures within 30 ft (50 ft at 11+)","es":"Acción: restaura hasta 5×nivel de clérigo (50 ft al nivel 11+) de criaturas a 9 m."}},
     {"id":"blessed_healer","name":{"en":"Blessed Healer","es":"Sanador Bendito"},"level":6,
      "description":{"en":"When you cast a healing spell on another, you also regain 2 + spell level HP.","es":"Cuando lanzas sanación a otro, recuperas 2 + nivel pg."}},
     {"id":"divine_strike","name":{"en":"Divine Strike","es":"Golpe Divino"},"level":8,
      "description":{"en":"Once per turn, deal +1d8 radiant damage on a hit with a weapon attack (2d8 at 14).","es":"Una vez por turno, +1d8 radiante a un ataque de arma (2d8 al 14)."}},
     {"id":"supreme_healing","name":{"en":"Supreme Healing","es":"Sanación Suprema"},"level":17,
      "description":{"en":"Heal or healing word spells restore maximum HP to the target instead of rolled amount.","es":"Heal o palabra curativa restauran pg máximos en vez del valor tirado."}} ] },
  {"class_id":"cleric","id":"light_domain",
   "name":{"en":"Light Domain","es":"Dominio de Luz"},
   "grantedAtLevel":1,
   "description_en":"You serve a deity of light or are enlightened by its radiance into a burning obsession with light.",
   "description_es":"Sírves a una deidad de luz o te iluminas con su resplandor en una obsesión ardiente por la luz.",
   "features":[
     {"id":"light_bearer","name":{"en":"Light Bearer","es":"Portador de Luz"},"level":1,
      "description":{"en":"You learn the Light cantrip. Wisdom is your spellcasting ability.","es":"Aprendes el truco Luz. Sabiduría es tu Característica de Lanzamiento."}},
     {"id":"warding_flare","name":{"en":"Warding Flare","es":"Destello de Guardia"},"level":1,
      "description":{"en":"When a creature attacks you, use reaction to impose disadvantage or +1 AC.","es":"Cuando una criatura te ataca, reacción para imponer desventaja o +1 a CA."}},
     {"id":"radiance_of_the_dawn","name":{"en":"Radiance of the Dawn","es":"Resplandor del Alba"},"level":2,
      "description":{"en":"Action: 30-ft radius magical light; each creature Con save or 2d10 radiant and blinded until end of next turn (half on success).","es":"Acción: luz mágica radio 9 m; Constitución o 2d10 radiante y cegado hasta tu próximo turno."},"savingThrow":"Constitution"},
     {"id":"improved_flare","name":{"en":"Improved Flare","es":"Destello Mejorado"},"level":6,
      "description":{"en":"Use Warding Flare on allies too; reroll Warding Flare dice and choose either.","es":"Usa Destello de Guardia también sobre aliados; repites los dados."}},
     {"id":"potent_spellcasting","name":{"en":"Potent Spellcasting","es":"Lanzamiento Potente"},"level":8,
      "description":{"en":"Add Wisdom modifier to cantrip damage rolls.","es":"Suma modificador de Sabiduría al daño de trucos."}},
     {"id":"nineteen_levels","name":{"en":"Capstone","es":"Culminación"},"level":17,
      "description":{"en":"Cast Daylight and Flame Strike at will (free use).","es":"Lanza Luz Diurna y Golpe de Llama a voluntad."}} ] },
  {"class_id":"cleric","id":"nature_domain",
   "name":{"en":"Nature Domain","es":"Dominio de Naturaleza"},
   "grantedAtLevel":1,
   "description_en":"You serve a deity of nature, or you revere nature itself as a divine force.",
   "description_es":"Sírves a una deidad de naturaleza o respetas a la naturaleza como fuerza divina.",
   "features":[
     {"id":"druidic_learning","name":{"en":"Druid","es":"Druida"},"level":1,
      "description":{"en":"You learn Druidic (secret language). You can perform druid rituals.","es":"Aprendes Drúdico (lengua secreta). Puedes realizar rituales druidas."}},
     {"id":"a_heavily_armored_cleric","name":{"en":"Heavy Armor Proficiencies","es":"Competencia Armadura Pesada"},"level":1,
      "description":{"en":"You gain proficiency with heavy armor.","es":"Ganas competencia con armadura pesada."}},
     {"id":"nature_lover","name":{"en":"Animal Lovers","es":"Amor Animal"},"level":2,
      "description":{"en":"Learn Druidcraft and Speak with Animals.","es":"Aprendes Arte de druida y Hablar con animales."}},
     {"id":"transmute_stone","name":{"en":"Chameleon Soul","es":"Alma Camaleón"},"level":6,
      "description":{"en":"Spend a Channel Divinity to gain darkvision 60 ft and resistance to a damage type for 10 min.","es":"Gasta una Divinidad del Canal para obtener visión en la oscuridad 18 m y resistencia a un daño durante 10 min."}},
     {"id":"divine_strike_primal","name":{"en":"Divine Strike (Primal)","es":"Golpe Divino (Primal)"},"level":8,
      "description":{"en":"Deal +1d8 cold, fire, or thunder extra damage with melee attacks.","es":"+1d8 frío, fuego o trueno adicional en ataques cuerpo a cuerpo."}},
     {"id":"master_of_nature","name":{"en":"Master of Nature","es":"Maestro de Naturaleza"},"level":17,
      "description":{"en":"Cast Plant Growth and Wind Wall once per dawn without a slot.","es":"Lanza Crecimiento de plantas y Muro de viento una vez al amanecer sin slot."}} ] },
  {"class_id":"cleric","id":"trickery_domain",
   "name":{"en":"Trickery Domain","es":"Dominio del Engaño"},
   "grantedAtLevel":1,
   "description_en":"You serve a deity of thieves, skulduggery, trickery, or cunning. Your magic is subtle and deceptive.",
   "description_es":"Sírves a una deidad de ladrones, engaño, truco o astucia. Tu magia es sutil y engañosa.",
   "features":[
     {"id":"blessed_of_the_trickster","name":{"en":"Blessing of the Trickster","es":"Bendición del Tramposo"},"level":1,
      "description":{"en":"Cast Disguise Self at will (free).","es":"Lanza Disfrazarte a voluntad sin slot."}},
     {"id":"trickery_cloak","name":{"en":"Cloak of Shadows","es":"Capa de Sombras"},"level":2,
      "description":{"en":"Channel Divinity: become invisible for 10 min. Attack ends it.","es":"Divinidad del Canal: invisible durante 10 min. Atacar lo termina."}},
     {"id":"invoke_duplicity","name":{"en":"Invoke Duplicity","es":"Invocar Duplicidad"},"level":2,
      "description":{"en":"Channel Divinity: create a perfect illusory duplicate of yourself (max 30 ft away).","es":"Divinidad del Canal: duplicado ilusorio perfecto (hasta 9 m)."}},
     {"id":"improved_invisibility","name":{"en":"Improved Duplicity","es":"Duplicidad Mejorada"},"level":6,
      "description":{"en":"Cast Mirror Image and Major Image at will (bonus action).","es":"Lanza Imagen duplicada e Imagen mayor a voluntad."}},
     {"id":"divine_strike_stealth","name":{"en":"Divine Strike (Stealth)","es":"Golpe Divino (Sigilo)"},"level":8,
      "description":{"en":"Deal +1d8 psychic damage with weapon attack.","es":"+1d8 psíquico con ataque de arma."}},
     {"id":"improved_invisibility_powerful","name":{"en":"Improved Invisibility","es":"Invisibilidad Mejorada"},"level":17,
      "description":{"en":"Cloak of Shadows lasts while you attack (and ends after attack).","es":"Capa de Sombras persiste mientras atacas (termina tras ataque)."}} ] },

  # ───────────────────────────── DRUID (+4) ───────────────────────────────
  {"class_id":"druid","id":"circle_of_the_land",
   "name":{"en":"Circle of the Land","es":"Círculo de la Tierra"},
   "grantedAtLevel":2,
   "description_en":"Your magic is tied to a particular landscape, granting you special powers based on the land where you were initiated.",
   "description_es":"Tu magia se vincula a un terreno particular, otorgándote poderes especiales según el lugar de iniciación.",
   "features":[
     {"id":"circle_spells_land","name":{"en":"Circle Spells","es":"Conjuros del Círculo"},"level":2,
      "description":{"en":"Gain bonus spells based on your terrain (Arctic, Coast, Desert, etc.).","es":"Ganas hechizos adicionales según tu terreno (ártico, costa, desierto, etc.)."}},
     {"id":"natural_recovery","name":{"en":"Natural Recovery","es":"Recuperación Natural"},"level":2,
      "description":{"en":"During a short rest, recover spell slots whose combined levels = half druid level (rounded up), max slot 5th.","es":"En descanso corto, recuperas slots cuya suma de niveles = mitad de nivel druida (redondeado), máximo 5o."}},
     {"id":"lands_stride","name":{"en":"Land's Stride","es":"Paso de la Tierra"},"level":6,
      "description":{"en":"Movement through difficult terrain costs no extra; you have resistance to poison damage and ignore poison nonmagical spikes.","es":"El terreno difícil no cuesta extra; resistencia a veneno y atraviesas púas no mágicas."}},
     {"id":"nature_ward","name":{"en":"Nature's Ward","es":"Guardia de Naturaleza"},"level":10,
      "description":{"en":"Immune to poison and disease.","es":"Inmune a veneno y enfermedad."}},
     {"id":"nature_sanctuary","name":{"en":"Nature's Sanctuary","es":"Santuario Natural"},"level":14,
      "description":{"en":"Aberrations, elementals, fey, fiends, undead can't attack you pre-emptively and must save Wis if they do.","es":"Aberraciones, elementales, feéricos, infernales y no-muertos no te atacan primero; deben salvar Sabiduría si lo hacen."}} ] },
  {"class_id":"druid","id":"circle_of_the_moon",
   "name":{"en":"Circle of the Moon","es":"Círculo de la Luna"},
   "grantedAtLevel":2,
   "description_en":"You draw power from the moon, manifesting powerful wild shapes.",
   "description_es":"Obtienes poder de la luna, manifestando formas salvajes poderosas.",
   "features":[
     {"id":"combat_wildshape_moon","name":{"en":"Combat Wild Shape","es":"Forma Salvaje de Combate"},"level":2,
      "description":{"en":"Wild Shape as bonus action; CR up to 1 (4th: 1, 8th: 2, 12th: 3, 16th: 4, 20th: 5).","es":"Forma Salvaje como acción adicional; CR hasta 1 (4o: 1, 8o: 2, 12o: 3, 16o: 4, 20o: 5)."}},
     {"id":"elemental_wildshape","name":{"en":"Elemental Wild Shape","es":"Forma Salvaje Elemental"},"level":6,
      "description":{"en":"Wild Shape into air, earth, fire, or water elemental.","es":"Forma Salvaje en elemental de aire, tierra, fuego o agua."}},
     {"id":"primal_strike","name":{"en":"Primal Strike","es":"Golpe Primitivo"},"level":6,
      "description":{"en":"Your beast attacks count as magical.","es":"Tus ataques en forma de bestia son mágicos."}},
     {"id":"thousand_forms","name":{"en":"Thousand Forms","es":"Mil Formas"},"level":10,
      "description":{"en":"Cast Alter Self at will; immunity to being charmed or frightened.","es":"Lanza Alterar el propio aspecto a voluntad; inmune a encantamiento y miedo."}},
     {"id":"level_20_blessing","name":{"en":"Capstone","es":"Culminación Luna"},"level":20,
      "description":{"en":"Wild Shape into creatures with CR 5 with no limited-class restriction.","es":"Forma Salvaje en criaturas CR 5 sin restricción."}} ] },
  {"class_id":"druid","id":"circle_of_the_sea",
   "name":{"en":"Circle of the Sea","es":"Círculo del Mar"},
   "grantedAtLevel":2,
   "description_en":"Your magic flows from the infinite ocean, granting otherworldly forms and watery powers.",
   "description_es":"Tu magia fluye del océano infinito, otorgando formas sobrenaturales y poderes acuáticos.",
   "features":[
     {"id":"call_the_hunt","name":{"en":"Call the Hunt","es":"Llamar la Cacería"},"level":2,
      "description":{"en":"Bonus action: 5×druid level temp HP and walking speed +10 ft for 10 min.","es":"Acción adicional: 5×nivel pg temporales y +3 m velocidad durante 10 min."}},
     {"id":"mariner_companion","name":{"en":"Mariner's Senses","es":"Sentidos Marinos"},"level":2,
      "description":{"en":"Aquatic animals understand you; fish ignore you.","es":"Animales acuáticos te entienden; los peces te ignoran."}},
     {"id":"aquatic_predator","name":{"en":"Aquatic Predation","es":"Depredador Acuático"},"level":6,
      "description":{"en":"Wild Shape into aquatic cr 1 creatures with swim speeds.","es":"Forma Salvaje en criaturas acuáticas con velocidad de nado CR 1."}},
     {"id":"relentless_rage","name":{"en":"Relentless Rage","es":"Furia Implacable"},"level":6,
      "description":{"en":"When you drop to 0 HP in Wild Shape, you can keep fighting!","es":"Cuándo caes a 0 pg en Forma Salvaje, sigues luchando."}},
     {"id":"stormy_focus","name":{"en":"Stormy Wild Shape","es":"Tormenta Salvaje"},"level":10,
      "description":{"en":"Wild Shape into storm elemental-like forms.","es":"Forma Salvaje en formas tipo elemental tormentoso."}},
     {"id":"tempestuous_soul","name":{"en":"Tempestuous Soul","es":"Alma Tempestuosa"},"level":14,
      "description":{"en":"Permanent swim speed 60 ft; immune to water damage.","es":"Velocidad de nado permanente 18 m; inmune a daño de agua."}} ] },
  {"class_id":"druid","id":"circle_of_stars",
   "name":{"en":"Circle of Stars","es":"Círculo de Estrellas"},
   "grantedAtLevel":2,
   "description_en":"Your magic draws on the stellar bodies, giving you access to guiding constellations and the path of the cosmos.",
   "description_es":"Tu magia bebe de los astros, dándote acceso a constelaciones guía y al camino del cosmos.",
   "features":[
     {"id":"star_map","name":{"en":"Star Map","es":"Mapa Estelar"},"level":2,
      "description":{"en":"Channel Divinity: cast guidance on one creature and know direction to celestial pole.","es":"Divinidad del Canal: lanza guía sobre uno y conoce la dirección del polo celeste."}},
     {"id":"constellation_choice","name":{"en":"Constellation Form","es":"Forma de Constelación"},"level":2,
      "description":{"en":"Choose a constellation: archer (temp HP), chalice (healing), dragon (damage).","es":"Elige constelación: arquero (pg temp), cáliz (curación), dragón (daño)."}},
     {"id":"starlight_step","name":{"en":"Starlight Step","es":"Paso Estelar"},"level":6,
      "description":{"en":"Bonus action teleport 30 ft, leaving glowing star.","es":"Acción adicional: teletransporte 9 m, dejando estrella brillante."}},
     {"id":"starry_form_improved","name":{"en":"Starry Form Improved","es":"Forma Estelar Mejorada"},"level":6,
      "description":{"en":"Bonus action to absorb constellation features.","es":"Acción adicional para absorber traits de constelación."}},
     {"id":"wall_of_stars","name":{"en":"Wall of Stars","es":"Muro de Estrellas"},"level":10,
      "description":{"en":"Cast Wall of Stone at 2nd level once per long rest without spending a slot.","es":"Lanza Muro de Piedra nivel 2 una vez por descanso prolongado sin gastar slot."}},
     {"id":"cosmic_omen","name":{"en":"Cosmic Omen","es":"Presagio Cósmico"},"level":14,
      "description":{"en":"Initiative +1d4 cosmic bonus; reroll 1s on Initiative.","es":"Iniciativa +1d4; repite los 1s en Iniciativa."}} ] },

  # ───────────────────────────── FIGHTER (+4) ──────────────────────────────
  {"class_id":"fighter","id":"arcane_archer",
   "name":{"en":"Arcane Archer","es":"Arquero Arcano"},
   "grantedAtLevel":3,
   "description_en":"You learn to infuse arrows with magical effects. Pull back your string and release.",
   "description_es":"Aprendes a imbuir flechas con efectos mágicos. Tensa la cuerda y suelta.",
   "features":[
     {"id":"arcane_archery","name":{"en":"Arcane Archer Lore","es":"Saber de Arquero Arcano"},"level":3,
      "description":{"en":"Gain proficiency in Nature or Arcana (your choice).","es":"Ganas competencia en Naturaleza o Arcana (eliges)."}},
     {"id":"arcane_shot","name":{"en":"Arcane Shot","es":"Tiro Arcano"},"level":3,
      "description":{"en":"Bonus action: spend Arcane Shot die, replace damage with magical arrow (Banishing, Beguiling, etc.).","es":"Acción adicional: gasta dado de Tiro Arcano, sustituye daño con flecha mágica."}},
     {"id":"magic_arrow","name":{"en":"Magic Arrow","es":"Flecha Mágica"},"level":3,
      "description":{"en":"Shoot 3 arcane arrows at 7th; 4 at 11th; 5 at 15th; 6 at 18th level.","es":"Dispara 3 flechas arcanas al 7; 4 al 11; 5 al 15; 6 al 18 nivel."}},
     {"id":"curving_shot","name":{"en":"Curving Shot","es":"Tiro Curvado"},"level":7,
      "description":{"en":"Arrow ricochets around cover to hit a target.","es":"La flecha rebota alrededor de cobertura hacia el objetivo."}},
     {"id":"ever_ready_shot","name":{"en":"Ever-Ready Shot","es":"Tiro Siempre Listo"},"level":15,
      "description":{"en":"Reaction to fire arcane shot even when surprised.","es":"Reacción para disparar tiro arcano incluso sorprendido."}},
     {"id":"capstone","name":{"en":"Capstone","es":"Culminación"},"level":18,
      "description":{"en":"2 arcane shot uses per turn.","es":"2 usos de Tiro Arcano por turno."}} ] },
  {"class_id":"fighter","id":"battle_master",
   "name":{"en":"Battle Master","es":"Maestro de Batalla"},
   "grantedAtLevel":3,
   "description_en":"A warrior full of martial tricks. You learn maneuvers that are fueled by special dice called superiority dice.",
   "description_es":"Un guerrero lleno de trucos marciales. Aprendes maniobras alimentadas por dados especiales de superioridad.",
   "features":[
     {"id":"combat_superiority","name":{"en":"Combat Superiority","es":"Superioridad de Combate"},"level":3,
      "description":{"en":"Gain 4 superiority dice (d8); learn 3 maneuvers. +d8 by 7th, 10th, 15th, 18th (max d12).","es":"Ganas 4 dados (d8); aprende 3 maniobras. +d8 al 7/10/15/18 (máx d12)."}},
     {"id":"student_of_war","name":{"en":"Student of War","es":"Estudiante de Guerra"},"level":3,
      "description":{"en":"Gain proficiency with one tool (artisan's tools).","es":"Ganas competencia con una herramienta artesanal."}},
     {"id":"know_your_enemy","name":{"en":"Know Your Enemy","es":"Conoce a tu Enemigo"},"level":7,
      "description":{"en":"After 1 min observation, learn if one creature has lower AC/Dex/move than you.","es":"Tras 1 min de observación, sabes si una criatura es peor que tú en CA/Destreza/velocidad."}},
     {"id":"improved_combat_superiority","name":{"en":"Improved Combat Superiority","es":"Superioridad Mejorada"},"level":10,
      "description":{"en":"Superiority dice = d10 (15th: d12).","es":"Dados = d10 (15o: d12)."}},
     {"id":"relentless","name":{"en":"Relentless","es":"Implacable"},"level":15,
      "description":{"en":"Once per turn, when you miss with a strike, expend a superiority die; add its roll to the attack.","es":"Una vez por turno, si fallas, gasta un dado de superioridad y añade su tirada."}},
     {"id":"capstone","name":{"en":"Capstone","es":"Culminación"},"level":18,
      "description":{"en":"5 superiority dice per rest; only short rest reset.","es":"5 dados por descanso; solo cortos los reponen."}} ] },
  {"class_id":"fighter","id":"eldritch_knight",
   "name":{"en":"Eldritch Knight","es":"Caballero Sobrenatural"},
   "grantedAtLevel":3,
   "description_en":"You learn to cast spells alongside your martial training. Spell and sword in perfect harmony.",
   "description_es":"Aprendes a lanzar conjuros junto a tu entrenamiento marcial. Conjuro y espada en perfecta armonía.",
   "features":[
     {"id":"spellcasting","name":{"en":"Spellcasting","es":"Lanzamiento de Conjuros"},"level":3,
      "description":{"en":"You learn wizard cantrips and spells of 1st level or higher. INT is your spellcasting ability.","es":"Aprendes trucos y conjuros de nivel 1+ del mago. INT es tu habilidad de lanzamiento."}},
     {"id":"eldritch_strike","name":{"en":"Eldritch Strike","es":"Golpe Sobrenatural"},"level":3,
      "description":{"en":"When you hit with weapon attack, inflict disadvantage on target's next save vs your spells.","es":"Cuando impactas con arma, infliges desventaja en próxima salvación contra tus conjuros."}},
     {"id":"war_magic","name":{"en":"War Magic","es":"Magia de Guerra"},"level":7,
      "description":{"en":"Bonus action to cast a cantrip after weapon attack.","es":"Acción adicional para lanzar truco después de ataque con arma."}},
     {"id":"arcane_charge","name":{"en":"Arcane Charge","es":"Carga Arcana"},"level":10,
      "description":{"en":"Bonus action teleport 30 ft to unoccupied space you can see.","es":"Acción adicional: teletransporte 9 m a un espacio libre visible."}},
     {"id":"improved_war_magic","name":{"en":"Improved War Magic","es":"Magia de Guerra Mejorada"},"level":15,
      "description":{"en":"Action to cast a 1st level+ spell after weapon attack.","es":"Acción para lanzar conjuro de nivel 1+ después de un ataque con arma."}},
     {"id":"capstone","name":{"en":"Capstone","es":"Culminación"},"level":18,
      "description":{"en":"Cast bonus action spell of 4th level or lower after weapon attack.","es":"Acción adicional: conjuro de nivel 4 o menor después de ataque con arma."}} ] },
  {"class_id":"fighter","id":"psi_warrior",
   "name":{"en":"Psi Warrior","es":"Guerrero Psi"},
   "grantedAtLevel":3,
   "description_en":"You learn psychic abilities from an ancient tradition of psionic study. Manifest telekinetic and telepathic powers.",
   "description_es":"Aprendes habilidades psíquicas de una tradición antigua de estudio psiónico. Manifiesta poderes telequinéticos y telepáticos.",
   "features":[
     {"id":"psionic_power","name":{"en":"Psionic Power","es":"Poder Psiónico"},"level":3,
      "description":{"en":"Gain 4 psionic energy dice (d6); learn 3 psionic disciplines. INT-based.","es":"Ganas 4 dados psiónicos (d6); aprende 3 disciplinas. INT como base."}},
     {"id":"telekinetic","name":{"en":"Telekinetic","es":"Telequinético"},"level":3,
      "description":{"en":"Manifest telekinetic force: bonus action to push, pull, or thrust.","es":"Manifiesta telequinesis: acción adicional para empujar, atraer o lanzar."}},
     {"id":"protective_field","name":{"en":"Protective Field","es":"Campo Protector"},"level":7,
      "description":{"en":"When a creature is hit, use reaction to reduce damage by 1d6 + INT mod.","es":"Cuando una criatura es impactada, reacción para reducir el daño por 1d6 + INT mod."}},
     {"id":"psi_strike","name":{"en":"Psi Strike","es":"Golpe Psi"},"level":10,
      "description":{"en":"Telekinetic adds bonus force damage equal to psionic die.","es":"Telequinesis añade daño de fuerza extra igual al dado psiónico."}},
     {"id":"bulwark_of_force","name":{"en":"Bulwark of Force","es":"Baluarte de Fuerza"},"level":15,
      "description":{"en":"Reaction to redirect attack from you to an ally.","es":"Reacción: redirige un ataque contra ti hacia un aliado."}} ] },

  # ───────────────────────────── MONK (+3) ────────────────────────────────
  {"class_id":"monk","id":"way_of_mercy",
   "name":{"en":"Way of Mercy","es":"Camino de la Misericordia"},
   "grantedAtLevel":3,
   "description_en":"Your hands can both hurt and heal. You harness a mix of medicine and ki energy.",
   "description_es":"Tus manos pueden dañar y sanar. Aprovechas una mezcla de medicina y energía ki.",
   "features":[
     {"id":"hands_of_healing","name":{"en":"Hands of Healing","es":"Manos Curativas"},"level":3,
      "description":{"en":"Cost 1 ki: heal creature for 1d6 + monk level HP; bonus action.","es":"Coste 1 ki: cura a una criatura 1d6 + nivel monje; acción adicional."}},
     {"id":"flurry_of_healing","name":{"en":"Flurry of Healing","es":"Ráfaga Curativa"},"level":3,
      "description":{"en":"Cost 2 ki: bonus action to add 1d6 to two healed creatures.","es":"Coste 2 ki: acción adicional, añade 1d6 a dos curaciones."}},
     {"id":"font_of_vitality","name":{"en":"Font of Vitality","es":"Fuente de Vitalidad"},"level":6,
      "description":{"en":"Healing hands restore HP equal to 2×rolled (instead of equal).","es":"Manos curativas restauran pg igual a 2×resultado (en vez de igual)."}},
     {"id":"hand_of_excruciating_pain","name":{"en":"Hand of Excruciating Pain","es":"Mano de Dolor Agudo"},"level":6,
      "description":{"en":"Replace Flurry of Blows with striking stun creature 1 min. Wis save.","es":"Sustituye Ráfaga de Golpes: aturde criatura 1 min. Sabiduría."},"savingThrow":"Wisdom"},
     {"id":"physicians_touch","name":{"en":"Physician's Touch","es":"Toque del Médico"},"level":11,
      "description":{"en":"Cast Greater Restoration once per long rest without a slot costing 4 ki.","es":"Lanza Restauración Mayor una vez por descanso prolongado sin slot (coste 4 ki)."}},
     {"id":"hand_of_saintly_renewal","name":{"en":"Hand of Saintly Renewal","es":"Mano de Renovación"},"level":17,
      "description":{"en":"1 ki: heal 5×monk level HP to yourself; self-cleanse poisoned/blinded/deafened/paralysis.","es":"1 ki: cura 5×nivel monje para ti mismo; limpia veneno/ceguera/sordera/parálisis."}} ] },
  {"class_id":"monk","id":"way_of_shadow",
   "name":{"en":"Way of Shadow","es":"Camino de las Sombras"},
   "grantedAtLevel":3,
   "description_en":"You gain the ability to walk through shadows and strike from darkness.",
   "description_es":"Ganas la capacidad de caminar entre sombras y golpear desde la oscuridad.",
   "features":[
     {"id":"shadow_arts","name":{"en":"Shadow Arts","es":"Artes de Sombra"},"level":3,
      "description":{"en":"Cast Darkness, Darkvision, Pass Without Trace, Silence, or Minor Illusion for 2 ki.","es":"Lanza Oscuridad, Visión en la oscuridad, Pasar sin rastro, Silencio o Ilusión menor por 2 ki."}},
     {"id":"cunning_action","name":{"en":"Deflect Missiles","es":"Desviar Proyectiles"},"level":3,
      "description":{"en":"Reaction to reduce missile damage by 1d10 + Dex mod + monk level.","es":"Reacción: reduce daño de proyectil por 1d10 + Destreza + nivel monje."}},
     {"id":"extra_attack","name":{"en":"Opportunist","es":"Oportunista"},"level":6,
      "description":{"en":"Reaction attack when an ally's enemy is within 5 ft.","es":"Reacción de ataque contra un enemigo de un aliado que esté a 1,5 m o menos."}},
      {"id":"shadow_step","name":{"en":"Shadow Step","es":"Paso Sombrío"},"level":11,
      "description":{"en":"Bonus action teleport from shadow to shadow up to 60 ft.","es":"Acción adicional: teletransporte de una sombra a otra hasta 18 m."}},
     {"id":"dark_methodist","name":{"en":"Deflect Energy","es":"Desviar Energía"},"level":11,
      "description":{"en":"You can Deflect Missiles vs. any attack roll.","es":"Puedes desviar cualquier ataque con Desviar Proyectiles."}},
     {"id":"capstone","name":{"en":"Capstone","es":"Culminación"},"level":17,
      "description":{"en":"Cast Cloak of Shadows for 8 ki = invisibility for 24 hours or until you attack.","es":"Lanza Capa de Sombras por 8 ki = invisibilidad 24 h o hasta que ataques."}} ] },
  {"class_id":"monk","id":"way_of_the_four_elements",
   "name":{"en":"Way of the Four Elements","es":"Camino de los Cuatro Elementos"},
   "grantedAtLevel":3,
   "description_en":"You study the elements, becoming a conduit for elemental power.",
   "description_es":"Estudiás los elementos, volviéndote un canal para el poder elemental.",
   "features":[
     {"id":"elemental_attunement","name":{"en":"Elemental Attunement","es":"Conectando con elementos"},"level":3,
      "description":{"en":"Cast Detect Magic and Gust at will.","es":"Lanza Detectar magia y Ráfaga a voluntad."}},
     {"id":"fangs_of_the_fire_snake","name":{"en":"Fangs of the Fire Snake","es":"Colmillos de serpiente de fuego"},"level":3,
      "description":{"en":"3 ki: unarmed attacks deal 1d6 fire. Reach 10 ft.","es":"3 ki: ataques desarmados infligen 1d6 fuego. Alcance 3 m."}},
     {"id":"water_whip","name":{"en":"Water Whip","es":"Látigo de agua"},"level":6,
      "description":{"en":"2 ki: 30-ft whip pulls and damages creature.","es":"2 ki: látigo a 9 m empuja y daña."}},
     {"id":"gong_of_the_thunder","name":{"en":"Gong of the Thunder","es":"Gong del Trueno"},"level":11,
      "description":{"en":"4 ki: knock-back thunder attack.","es":"4 ki: ataque de trueno con empuje."}},
     {"id":"river_of_hungry_flame","name":{"en":"River of Hungry Flame","es":"Río de llamas hambrientas"},"level":11,
      "description":{"en":"6 ki: 6d6 fire sustained AOE.","es":"6 ki: 6d6 fuego AOE sostenido."}},
     {"id":"breathe_of_winter","name":{"en":"Breath of Winter","es":"Aliento de Invierno"},"level":17,
      "description":{"en":"8 ki: 6d6 cold cone AOE.","es":"8 ki: 6d6 frío cono AOE."}} ] },

  # ───────────────────────────── PALADIN (+3) ──────────────────────────────
  {"class_id":"paladin","id":"oath_of_glory",
   "name":{"en":"Oath of Glory","es":"Juramento de Gloria"},
   "grantedAtLevel":3,
   "description_en":"You seek to spread glory across the land and prove yourself as a paragon of honor and excellence.",
   "description_es":"Buscas difundir gloria por la tierra y demostrarte como modelo de honor y excelencia.",
   "features":[
     {"id":"oath_of_glory_features","name":{"en":"Oath Spells","es":"Conjuros del Juramento"},"level":3,
      "description":{"en":"Cast Guiding Bolt, Enhance Ability, etc. (5e official list).","es":"Lanza Proyectil guía, Potenciar aptitud, etc."}},
     {"id":"channel_divinity_peerless_athlete","name":{"en":"Peerless Athlete","es":"Atleta Sin Igual"},"level":3,
      "description":{"en":"Channel Divinity: advantage on STR/DEX/CON checks, +10 walking speed for 1 min.","es":"Divinidad del Canal: ventaja F/D/C y +3 m velocidad 1 min."}},
     {"id":"inspiring_smite","name":{"en":"Inspiring Smite","es":"Golpe Inspirador"},"level":6,
      "description":{"en":"Expend spell slot on Divine Smite: 1d8+slvl temp HP and inspire 3 allies.","es":"Gasta slot en Castigo Divino: 1d8+nivel pg temp y inspira a 3 aliados."}},
     {"id":"living_legend","name":{"en":"Living Legend","es":"Leyenda Viva"},"level":15,
      "description":{"en":"Advantage on Charisma checks; Charisma max becomes 22.","es":"Ventaja en pruebas de Carisma; Carisma máx. = 22."}},
     {"id":"oath_of_archery_inner","name":{"en":"Famous Champion","es":"Campeón Famoso"},"level":20,
      "description":{"en":"When a creature misses you, use reaction for an attack against it.","es":"Cuando una criatura te falla, reacción para atacar."}} ] },
  {"class_id":"paladin","id":"oath_of_conquest",
   "name":{"en":"Oath of Conquest","es":"Juramento de Conquista"},
   "grantedAtLevel":3,
   "description_en":"You seek to rule through martial dominance and strength over the weak.",
   "description_es":"Buscas reinar a través de la dominancia marcial y fortaleza sobre los débiles.",
   "features":[
     {"id":"oath_spells_conquest","name":{"en":"Oath Spells","es":"Conjuros del Juramento"},"level":3,
      "description":{"en":"Cast Command, Hold Person, etc.","es":"Lanza Comando, Retener persona, etc."}},
     {"id":"conquering_presence","name":{"en":"Conquering Presence","es":"Presencia Conquistadora"},"level":3,
      "description":{"en":"Channel Divinity: Wis save or frightened 1 min (10 ft radius).","es":"Divinidad del Canal: Sabiduría o asustado 1 min (radio 3 m)."},"savingThrow":"Wisdom"},
     {"id":"guided_strike","name":{"en":"Guided Strike","es":"Golpe Guiado"},"level":3,
      "description":{"en":"Channel Divinity: +10 to attack roll (must hit).","es":"Divinidad del Canal: +10 a ataque (debe impactar)."}},
     {"id":"scornful_rebuttal","name":{"en":"Scornful Rebuke","es":"Reprensión Despreciativa"},"level":7,
      "description":{"en":"Reaction to deal 2d8+CHA mod Psychic damage.","es":"Reacción: 2d8+Car psychic."}},
     {"id":"eternal_warrior","name":{"en":"Eternal Warrior","es":"Guerrero Eterno"},"level":15,
      "description":{"en":"Advantage on CON checks; temp HP at start of each turn.","es":"Ventaja en Constitución; pg temp al inicio de cada turno."}},
     {"id":"conquering_victory","name":{"en":"Conquering Victory","es":"Victoria Conquistadora"},"level":20,
      "description":{"en":"When you reduce creature to 0 HP, target another creature within 30 ft — Wis save or frightened.","es":"Al reducir a 0 pg, otro objetivo en 9 m — Sabiduría o asustado."}} ] },
  {"class_id":"paladin","id":"oath_of_redemption",
   "name":{"en":"Oath of Redemption","es":"Juramento de Redención"},
   "grantedAtLevel":3,
   "description_en":"A knight who has seen too much violence, sworn to peace and atonement.",
   "description_es":"Un caballero que ha visto demasiada violencia, jurando paz y reparación.",
   "features":[
     {"id":"oath_spells_redemption","name":{"en":"Oath Spells","es":"Conjuros del Juramento"},"level":3,
      "description":{"en":"Cast Sleep, Calm Emotions, Hold Person.","es":"Lanza Dormir, Calmar emociones, Retener persona."}},
     {"id":"rebuke_the_violent","name":{"en":"Rebuke the Violent","es":"Reprender al Violento"},"level":3,
      "description":{"en":"Channel Divinity: Reaction 2d8+CHA mod force damage to attacker.","es":"Divinidad del Canal: reacción 2d8+Car fuerza al atacante."}},
     {"id":"protective_spirit","name":{"en":"Protective Spirit","es":"Espíritu Protector"},"level":7,
      "description":{"en":"Channel Divinity (1 min): 10-ft radius. Damage taken halved; transfer to you.","es":"Divinidad del Canal (1 min): radio 3 m. Daño dividido se transfiere a ti."}},
     {"id":"aura_of_the_guardian","name":{"en":"Aura of the Guardian","es":"Aura del Guardián"},"level":7,
      "description":{"en":"Reaction: take damage instead of a creature within 30 ft.","es":"Reacción: recibe daño en lugar de otra criatura a 9 m."}},
     {"id":"protective_spirit_improved","name":{"en":"Protective Spirit Improved","es":"Espíritu Mejorado"},"level":15,
      "description":{"en":"You don't take the transferred damage; ally takes 50%, you take 50%.","es":"Tú no recibes el daño transferido; aliado recibe 50%, tú 50%."}},
     {"id":"champion_of_redemption","name":{"en":"Champion of Redemption","es":"Campeón de la Redención"},"level":20,
      "description":{"en":"Aura to absorb damage; allies take 0 damage from your redirected hit.","es":"Aura que absorbe daño; aliados reciben 0 daño de golpes redirigidos."}} ] },

  # ───────────────────────────── RANGER (+3) ───────────────────────────────
  {"class_id":"ranger","id":"beast_master",
   "name":{"en":"Beast Master","es":"Maestro de Bestias"},
   "grantedAtLevel":3,
   "description_en":"You bond with a primal beast to fight alongside you as your companion.",
   "description_es":"Te une a una bestia primordial que lucha a tu lado como compañera.",
   "features":[
     {"id":"primal_companion","name":{"en":"Primal Companion","es":"Compañero Primordial"},"level":3,
      "description":{"en":"Sense magic 30 ft; you and companion share Initiative.","es":"Detectar magia 9 m; tú y el compañero comparten Iniciativa."}},
     {"id":"beastly_ferocity","name":{"en":"Beast's Ferocity","es":"Ferocidad Bestial"},"level":3,
      "description":{"en":"If companion deals 0 damage due to low attack, it deals 1d4 instead.","es":"Si el compañero haría 0 daño, hace 1d4."}},
     {"id":"coordinated_assault","name":{"en":"Coordinated Assault","es":"Asalto Coordinado"},"level":7,
      "description":{"en":"When you attack, companion attacks same target separately.","es":"Cuando atacas, el compañero ataca el mismo objetivo."}},
     {"id":"exceptional_training","name":{"en":"Exceptional Training","es":"Entrenamiento Excepcional"},"level":11,
      "description":{"en":"Companion gains proficiency in modified stat.","es":"Compañero gana competencia en una estadística."}},
     {"id":"share_spells","name":{"en":"Share Spells","es":"Compartir Conjuros"},"level":15,
      "description":{"en":"Cast a ranger spell on self; companion also benefits.","es":"Lanza conjuro sobre ti; el compañero se beneficia."}},
     {"id":"capstone","name":{"en":"Capstone","es":"Culminación"},"level":20,
      "description":{"en":"Companion action: Stunning Strike (Wis save) or Roar (Knockback).","es":"Acción del compañero: Atronar o Rugido."}} ] },
  {"class_id":"ranger","id":"gloom_stalker",
   "name":{"en":"Gloom Stalker","es":"Acechador Sombrío"},
   "grantedAtLevel":3,
   "description_en":"You learned to fight in darkness, an ambush predator lurking in the longest shadows.",
   "description_es":"Aprendiste a luchar en la oscuridad, un depredador de emboscada que acecha en las sombras más largas.",
   "features":[
     {"id":"dreadful_strike_gloom","name":{"en":"Dreadful Strike","es":"Golpe Temible"},"level":3,
      "description":{"en":"First attack each combat: +1d8 damage.","es":"Primer ataque cada combate: +1d8 daño."}},
     {"id":"umbral_sight","name":{"en":"Umbral Sight","es":"Vista Umbría"},"level":3,
      "description":{"en":"Darkvision 60 ft; invisible to darkvision alone when in darkness.","es":"Visión en la oscuridad 18 m; invisible para visión en la oscuridad en oscuridad total."}},
     {"id":"steel_will_shadow","name":{"en":"Iron Mind","es":"Mente de Hierro"},"level":7,
      "description":{"en":"Advantage on saves vs. fear.","es":"Ventaja en salvaciones contra miedo."}},
     {"id":"strides_of_starlight","name":{"en":"Stalker's Flurry","es":"Tormenta del Acechador"},"level":11,
      "description":{"en":"Bonus action to attack twice once per short rest.","es":"Acción adicional para atacar dos veces una vez por descanso corto."}},
     {"id":"shadowy_dodge","name":{"en":"Shadowy Dodge","es":"Esquiva Sombría"},"level":15,
      "description":{"en":"Reaction when missed: attack the attacker.","es":"Reacción al ser atacado fallido: atacarlo."}} ] },
  {"class_id":"ranger","id":"horizon_walker",
   "name":{"en":"Horizon Walker","es":"Caminante del Horizonte"},
   "grantedAtLevel":3,
   "description_en":"You guard the borders between worlds, hunting aberrations that threaten them.",
   "description_es":"Guardas las fronteras entre mundos, cazando aberraciones que las amenazan.",
   "features":[
     {"id":"planar_warden","name":{"en":"Planar Warrior","es":"Guerrero Planar"},"level":3,
      "description":{"en":"Bonus: deal +1d8 force damage to aberration / fey / elemental targets until turn end.","es":"Acción adicional: +1d8 fuerza contra aberración/feérico/elemental."}},
     {"id":"ethereal_step","name":{"en":"Ethereal Step","es":"Paso Etéreo"},"level":7,
      "description":{"en":"Cast Etherealness on self and allies.","es":"Lanza Etérea sobre sí mismo."}},
     {"id":"distant_strike","name":{"en":"Distant Strike","es":"Golpe Distante"},"level":11,
      "description":{"en":"Bonus action teleport 10 ft before attack.","es":"Acción adicional: teletransporte 3 m antes del ataque."}},
     {"id":"ranger_of_the_sinkhole","name":{"en":"Spectral Defense","es":"Defensa Espectral"},"level":15,
      "description":{"en":"Reaction to give ally resistance to BPS from attack.","es":"Reacción: da resistencia B/P/C a un aliado."}} ] },

  # ───────────────────────────── ROGUE (+3) ────────────────────────────────
  {"class_id":"rogue","id":"arcane_trickster",
   "name":{"en":"Arcane Trickster","es":"Trampero Arcano"},
   "grantedAtLevel":3,
   "description_en":"You learn spells and develop techniques of arcane trickery. Focus on illusion and enchantment magic.",
   "description_es":"Aprendes conjuros y desarrollas técnicas de trampa arcana. Enfoque en ilusión y encantamiento.",
   "features":[
     {"id":"sneak_attack","name":{"en":"Sneak Attack","es":"Ataque Furtivo"},"level":3,
      "description":{"en":"+1d6 extra damage on attack with advantage (or target adjacent to ally + 0 ability cover).","es":"+1d6 en ataque con ventaja (o aliado adyacente + sin cobertura de habilidad 0)."}},
     {"id":"mage_hand_legerdemain","name":{"en":"Mage Hand Legerdemain","es":"Mano de Mago Sutil"},"level":3,
      "description":{"en":"Cast Mage Hand with 5x range, you can stow/retrieve an object, open doors, attack bonuses.","es":"Lanza Mano de mago a 5×rango, guardar/recuperar objetos, abrir puertas."}},
     {"id":"spellcasting_rogue","name":{"en":"Spellcasting (AT)","es":"Lanzamiento TA"},"level":3,
      "description":{"en":"Cast wizard cantrips and 1st level+ spells from wizard list.","es":"Lanza trucos y conjuros de nivel 1+ del mago."}},
     {"id":"magical_ambush","name":{"en":"Magical Ambush","es":"Emboscada Mágica"},"level":9,
      "description":{"en":"Creatures have disadvantage on save vs. spells from hiding.","es":"Criaturas tienen desventaja contra conjuros lanzados desde oculto."}},
     {"id":".verbose","name":{"en":"Versatile Trickster","es":"Trampero Versátil"},"level":13,
      "description":{"en":"Use bonus action Mage Hand to distract and attack with sneak attack.","es":"Uso adicional: distracción con Mano de mago y ataque furtivo."}},
     {"id":"elusive","name":{"en":"Elusive","es":"Elusivo"},"level":13,
      "description":{"en":"No attack roll has advantage against you.","es":"Sin atacante con ventaja contra ti."}} ] },
  {"class_id":"rogue","id":"phantom",
   "name":{"en":"Phantom","es":"Fantasma"},
   "grantedAtLevel":3,
   "description_en":"You channel the spirits of the dead to gain mastery of necrotic magic and stealth.",
   "description_es":"Canalizas los espíritus de los muertos para obtener dominio de la magia necrótica y furtividad.",
   "features":[
     {"id":"ghostsight","name":{"en":"Whispers of the Dead","es":"Susurros de los Muertos"},"level":3,
      "description":{"en":"Cast Augury and 7th-level Commune with the Dead.","es":"Lanza Augurio y Comulgar con los muertos."}},
     {"id":"ethereal_pick_pocket","name":{"en":"Wails from Beyond","es":"Gemidos del Más Allá"},"level":3,
      "description":{"en":"Sneak attack deals extra 2d6 necrotic on first attack from stealth.","es":"Ataque furtivo inflige +2d6 necrótico en el primer ataque desde emboscada."}},
     {"id":"skills_of_the_ghost","name":{"en":"Skills of the Ghost","es":"Habilidades del Fantasma"},"level":9,
      "description":{"en":"Mage Hand from invisible position lets you steal without disturbing.","es":"Mano de mago desde invisibilidad permite robar sin ser detectado."}},
     {"id":"souls_of_the_dead","name":{"en":"Souls of the Dead","es":"Almas de los Muertos"},"level":13,
      "description":{"en":"Use Wails from Beyond and an extra d6 necrotic per attack.","es":"Usa Gemidos del Más Allá y +1d6 necrótico por ataque."}},
     {"id":"tokens_of_fallen","name":{"en":"Tokens of the Dying","es":"Tokens del Moribundo"},"level":17,
      "description":{"en":"Capture soul of a slain humanoid; use 1d6 phantom's wails and reaction.","es":"Captura alma; usa 1d6 Gemidos Fantasma con reacción."}} ] },
  {"class_id":"rogue","id":"soulknife",
   "name":{"en":"Soulknife","es":"Cuchilla de Almas"},
   "grantedAtLevel":3,
   "description_en":"You forge your mind and weapon into a single tool of destruction. Psionic rogue with psychic blades.",
   "description_es":"Forjas tu mente y arma en una única herramienta de destrucción. Pícaro psiónico con hojas psíquicas.",
   "features":[
     {"id":"psionic_power_soulknife","name":{"en":"Psionic Power","es":"Poder Psiónico"},"level":3,
      "description":{"en":"Gain 4 psionic energy dice (d6); learn 3 psionic disciplines.","es":"Ganas 4 dados (d6); aprendes 3 disciplinas."}},
     {"id":"psychic_blades_soulknife","name":{"en":"Psychic Blades","es":"Hojas Psíquicas"},"level":3,
      "description":{"en":"Bonus action create a bonus psychic weapon attack.","es":"Acción adicional creas un ataque de arma psíquica extra."}},
     {"id":"stealth_attack","name":{"en":"Homing Strikes","es":"Golpes a Ciegas"},"level":9,
      "description":{"en":"When you miss, reroll with a psionic die.","es":"Cuando fallas, repites con dado psiónico."}},
     {"id":"soul_blades","name":{"en":"Soul Blades","es":"Hojas de Alma"},"level":13,
      "description":{"en":"Cast Blade of Disorder with PSI dice; AOE psionic attack.","es":"Lanza Hoja del Desorden con d6; AOE psiónico."}} ] },

  # ───────────────────────────── SORCERER (+4) ─────────────────────────────
  {"class_id":"sorcerer","id":"clockwork_soul",
   "name":{"en":"Clockwork Soul","es":"Alma de Relojería"},
   "grantedAtLevel":1,
   "description_en":"Your magic comes from the blessed, ordered realms of Mechanus.",
   "description_es":"Tu magia viene de los benditos y ordenados reinos de Mechanus.",
   "features":[
     {"id":"clockwork_magic","name":{"en":"Clockwork Magic","es":"Magia de Relojería"},"level":1,
      "description":{"en":"Gain 2 sorcery points to spend on Clockwork Spells at 1st level or higher.","es":"Ganas 2 puntos de hechicería para Conjuros de Relojería."}},
     {"id":"trance_of_order","name":{"en":"Trance of Order","es":"Trance del Orden"},"level":1,
      "description":{"en":"Advantage on CON saves; reroll attack rolls; restore d6 sorcery points; spend 1 sorcery point to take an extra action.","es":"Ventaja en Constitución; repite ataques; recupera 1d6 pg hechicería; por 1 punto, acción extra."}},
     {"id":"tempo_de_orden_extra","name":{"en":"Watcher's Will","es":"Voluntad del Vigía"},"level":6,
      "description":{"en":"React to attack / save with Advantage; 10 swifty uses per day.","es":"Reacción a ataque/salvación con ventaja; 10 usos diarios."}},
     {"id":"magnificent_mansion_soul","name":{"en":"Bastion of Law","es":"Baluarte de la Ley"},"level":14,
      "description":{"en":"Cast Magnificent Mansion / Mighty Fortress / Wall of Force once per long rest.","es":"Lanza Mansión magnífica / Fortaleza poderosa / Muro de fuerza una vez por descanso prolongado."}},
     {"id":"capstone_soul","name":{"en":"Capstone","es":"Culminación"},"level":18,
      "description":{"en":"Enchant mechanical advantage to allies.","es":"Encantamiento mecánico a aliados."}} ] },
  {"class_id":"sorcerer","id":"lunar_sorcery",
   "name":{"en":"Lunar Sorcery","es":"Hechicería Lunar"},
   "grantedAtLevel":1,
   "description_en":"You draw your magic from the moon, channeling its various phases.",
   "description_es":"Tu magia proviene de la luna, canalizando sus varias fases.",
   "features":[
     {"id":"lunar_magic","name":{"en":"Lunar Magic","es":"Magia Lunar"},"level":1,
      "description":{"en":"Cast 3 cantrips from lunar list; gain 4 d6 lunar sorcery points.","es":"Lanza 3 trucos lunares; 4 puntos de hechicería lunar d6."}},
     {"id":"crescent_moon","name":{"en":"Crescent Moon","es":"Luna Creciente"},"level":1,
      "description":{"en":"Cast Silence and Color Spray with lunar sorcery points (1 each).","es":"Lanza Silencio y Rociada de color con puntos lunares (1 cada uno)."}},
     {"id":"full_moon","name":{"en":"Full Moon","es":"Luna Llena"},"level":6,
      "description":{"en":"Cast Moonbeam and Faerie Fire with lunar sorcery points (2 each).","es":"Lanza Rayo de luna y Fuego de hadas (2 puntos cada uno)."}},
     {"id":"new_moon","name":{"en":"New Moon","es":"Luna Nueva"},"level":7,
      "description":{"en":"Apply diff to attacks; darkvision 120 ft; darkness gained.","es":"Aplica desventaja en ataques; visión 36 m; oscuridad."}},
     {"id":"moon_shield","name":{"en":"Shield of the Moon","es":"Escudo de la Luna"},"level":14,
      "description":{"en":"Cast Heroes' Feast and Mass Heal once per long rest.","es":"Lanza Festín de héroes y Sanación en masa una vez por descanso prolongado."}} ] },
  {"class_id":"sorcerer","id":"storm_sorcery",
   "name":{"en":"Storm Sorcery","es":"Hechicería de Tormenta"},
   "grantedAtLevel":1,
   "description_en":"You are the storm made flesh. Your magic is wild, powerful, and uncontrolled.",
   "description_es":"Eres la tormenta hecha carne. Tu magia es salvaje, poderosa e incontrolada.",
   "features":[
     {"id":"storm_magic","name":{"en":"Storm Magic","es":"Magia de Tormenta"},"level":1,
      "description":{"en":"5 sorcery points Lightning damage on each lightning spell cast.","es":"+5 puntos de hechicería en daño eléctrico por hechizo eléctrico."}},
     {"id":"tempestuous_magic","name":{"en":"Tempestuous Magic","es":"Magia Tempestuosa"},"level":1,
      "description":{"en":"After casting spell of 1st+ level, teleport 10 ft as bonus action.","es":"Tras conjuro nivel 1+, teletransporte 3 m acción adicional."}},
     {"id":"lightning_bolt_swap","name":{"en":"Lightning Strike","es":"Golpe Relampagueante"},"level":6,
      "description":{"en":"Channel Divinity-like: bonus action lightning damage to one target.","es":"Like Divinidad del Canal: acción adicional daño eléctrico."}},
     {"id":"heart_of_the_storm","name":{"en":"Heart of the Storm","es":"Corazón de la Tormenta"},"level":6,
      "description":{"en":"Resistance to thunder and lightning; magic damage from same type to creatures within 10 ft.","es":"Resistencia a trueno y eléctrico; daño mágico contra criaturas a 3 m."}},
     {"id":"soul_of_the_storm","name":{"en":"Soul of the Storm","es":"Alma de Tormenta"},"level":14,
      "description":{"en":"Cast Control Weather and Storm of Vengeance once per long rest.","es":"Lanza Controlar el clima y Tormenta de la venganza una vez por descanso prolongado."}},
     {"id":"wind_soul","name":{"en":"Wind Soul","es":"Alma de Viento"},"level":18,
      "description":{"en":"Permanent flight, resistances, immunity to gas; reduces damage type by 60 ft.","es":"Vuelo permanente, resistencias, inmunidad a gases; reduce daño en 18 m."}} ] },
  {"class_id":"sorcerer","id":"wild_magic",
   "name":{"en":"Wild Magic","es":"Magia Salvaje"},
   "grantedAtLevel":1,
   "description_en":"Your magic is unpredictable and chaotic, drawn from raw forces of creation.",
   "description_es":"Tu magia es impredecible y caótica, extraída de fuerzas crudas de la creación.",
   "features":[
     {"id":"wild_magic_surge","name":{"en":"Wild Magic Surge","es":"Irrupción de Magia Salvaje"},"level":1,
      "description":{"en":"Roll d20 when casting 1st level+ sorcerer spells: 1 triggers Surge.","es":"Tira 1d20 al lanzar conjuros de hechicero nivel 1+: 1 activa Irrupción."}},
     {"id":"tides_of_chaos","name":{"en":"Tides of Chaos","es":"Mareas del Caos"},"level":1,
      "description":{"en":"Advantage on attack/ability/save; revert uses against you.","es":"Ventaja en ataque/prueba/salvación; invierte ahora contra ti."}},
     {"id":"bend_spells","name":{"en":"Bend Luck","es":"Torcer la Suerte"},"level":6,
      "description":{"en":"+2 boost on attack/ability/save of creatures; spend sorcery points.","es":"+2 boost/incremento en ataque/prueba/salvación; gasta puntos hechicería."}},
     {"id":"controlled_surge","name":{"en":"Controlled Surge","es":"Irrupción Controlada"},"level":14,
      "description":{"en":"Surge rolls occur on 1-2; reactions don't trigger (just yours).","es":"Irrupción solo en 1-2; reacciones no la disparan (solo la tuya)."}},
     {"id":"capstone","name":{"en":"Spell Bombardment","es":"Bombardeo de Conjuros"},"level":18,
      "description":{"en":"If first spell hits a Surge: +1d6 damage per slot above 1st (apply once/turn).","es":"Si primer hechizo impacta bajo Irrupción: +1d6 por nivel de slot."}} ] },

  # ───────────────────────────── WARLOCK (+5) ──────────────────────────────
  {"class_id":"warlock","id":"archfey_patron",
   "name":{"en":"The Archfey Patron","es":"El Patrón Archifeérico"},
   "grantedAtLevel":1,
   "description_en":"Your patron is a powerful fey lord, lady of the mists, or similar. Your magic is whimsical.",
   "description_es":"Tu patrón es un poderoso señor feérico, dama de las nieblas o similar. Tu magia es caprichosa.",
   "features":[
     {"id":"fey_presence","name":{"en":"Fey Presence","es":"Presencia Feérica"},"level":1,
      "description":{"en":"Action: 10-ft radius Wis save charmed or frightened 1 round.","es":"Acción: radio 3 m, Sabiduría o encantado o asustado 1 turno."},"savingThrow":"Wisdom"},
     {"id":"dark_one","name":{"en":"Misty Escape","es":"Escape Brumoso"},"level":6,
      "description":{"en":"Reaction when damaged: teleport 60 ft and invisible until your turn.","es":"Reacción al recibir daño: teletransporte 18 m e invisible hasta tu turno."}},
     {"id":"beguiling_defenses","name":{"en":"Beguiling Defenses","es":"Defensas Engañosas"},"level":6,
      "description":{"en":"Advantage on saves vs being charmed; magic re-targets to caster.","es":"Ventaja en salvaciones contra encantamiento; magia te afecta a ti al enemigo."}},
     {"id":"soul_of_the_storm_archfey","name":{"en":"Soul of the Archfey","es":"Alma del Archifeo"},"level":10,
      "description":{"en":"Cast Charm Person and Greater Invisibility at will.","es":"Lanza Encantar persona e Invisibilidad mayor a voluntad."}},
     {"id":"capstone","name":{"en":"Dark Delirium","es":"Delirio Oscuro"},"level":14,
      "description":{"en":"Action: Wis save; creature sees nothing real; on imagination attacks.","es":"Acción: Sabiduría o ve nada real; ataca a aliados imaginarios."}} ] },
  {"class_id":"warlock","id":"celestial_patron",
   "name":{"en":"The Celestial Patron","es":"El Patrón Celestial"},
   "grantedAtLevel":1,
   "description_en":"Your patron is a celestial: an angel, couatl, deva, solars, or similar. Your weapon is light.",
   "description_es":"Tu patrón es celestial: ángel, couatl, deva, solar o similar. Tu arma es la luz.",
   "features":[
     {"id":"expanded_spell_casting","name":{"en":"Expanded Spell List (Celestial)","es":"Lista de Conjuros Expandida"},"level":1,
      "description":{"en":"Add Cure Wounds, Revivify, etc.","es":"Añade Curar heridas, Revivificar, etc."}},
     {"id":"healing_light","name":{"en":"Healing Light","es":"Luz Curativa"},"level":1,
      "description":{"en":"Bonus action: spend a slot to heal warlock level + CHA mod to target.","es":"Acción adicional: gasta slot, cura nivel + Car mod a objetivo."}},
     {"id":"radiant_soul","name":{"en":"Radiant Soul","es":"Alma Radiante"},"level":6,
      "description":{"en":"Resistance to radiant damage. Add CHA mod to radiant/fire damage from warlock cantrips and spells.","es":"Resistencia radiante. Suma Car mod al daño radiante/fuego de trucos y conjuros de brujo."}},
     {"id":"celestial_revelation","name":{"en":"Celestial Revelation","es":"Revelación Celestial"},"level":6,
      "description":{"en":"Action: see invisible, fly 10 ft, dim light; use 1/warlock level use per long rest.","es":"Acción: ver invisibles, volar 3 m, luz tenue; uso 1/nivel hechicero por descanso prolongado."}},
     {"id":"searing_vengeance","name":{"en":"Searing Vengeance","es":"Venganza Abrasadora"},"level":10,
      "description":{"en":"Reaction when reduced to 0 HP: expend slot to gain temp HP and target one creature.","es":"Reacción al caer a 0 pg: gasta slot para pg temp y dañar a un objetivo."}},
     {"id":"summon_star","name":{"en":"Summon a Star","es":"Invocar una Estrella"},"level":14,
      "description":{"en":"Cast a level 7 spell (Greater Restoration / Wall of Fire, etc.) as bonus action.","es":"Conjuro de nivel 7 (Restauración mayor / Muro de fuego, etc.) acción adicional."}} ] },
  {"class_id":"warlock","id":"fathomless_patron",
   "name":{"en":"The Fathomless Patron","es":"El Patrón Sin Fondo"},
   "grantedAtLevel":1,
   "description_en":"Your patron is Dagon, an aquatic horror, or other deep-sea entity. Your magic is the darkness of the sea.",
   "description_es":"Tu patrón es Dagon, horror acuático u otra entidad abisal. Tu magia es la oscuridad del mar.",
   "features":[
     {"id":"deep_sea_aristocracy","name":{"en":"Expanded Spell List (Fathomless)","es":"Lista Expandida"},"level":1,
      "description":{"en":"Thunderwave, Lightning Bolt, etc.","es":"Ola de trueno, Relámpago, etc."}},
     {"id":"tentacle_of_the_deep","name":{"en":"Tentacle of the Deep","es":"Tentáculo del Abismo"},"level":1,
      "description":{"en":"Bonus action create water tentacle: 1d8+CHA bludgeoning or 10 ft pull.","es":"Acción adicional crea tentáculo: 1d8+Car contundente o 3 m atracción."}},
     {"id":"guardians_of_the_depths","name":{"en":"Guardians of the Deep","es":"Guardianes de la Profundidad"},"level":6,
      "description":{"en":"Sea creatures ignore you; advantage on stealth near water.","es":"Criaturas marinas te ignoran; ventaja en Sigilo cerca del agua."}},
     {"id":"abyssal_screams","name":{"en":"Grasping Tail","es":"Cola Agarradora"},"level":10,
      "description":{"en":"Create tentacles attack with CHA mod (1d6+CHA).","es":"Creas tentáculos que atacan (1d6+Car) con Carisma."}},
     {"id":"capstone","name":{"en":"Fathomless Soul","es":"Alma Sin Fondo"},"level":14,
      "description":{"en":"Cast Cone of Cold (5/turn) or Lightning Bolt 2x per turn (free).","es":"Lanza Cono de Frío (5/turno) o Relámpago 2×/turno (gratis)."}} ] },
  {"class_id":"warlock","id":"undead_patron",
   "name":{"en":"The Undead Patron","es":"El Patrón No-Muerto"},
   "grantedAtLevel":1,
   "description_en":"Your patron is Vecna, a lich, or other powerful undead. Your magic is cold and fearsome.",
   "description_es":"Tu patrón es Vecna, un liche u otro poderoso no-muerto. Tu magia es fría y terrible.",
   "features":[
     {"id":"expanded_spell_casting_undead","name":{"en":"Expanded Spell List (Undead)","es":"Lista Expandida"},"level":1,
      "description":{"en":"False Life, Blindness/Deafness, etc.","es":"Falsa vida, Ceguera/Sordera, etc."}},
     {"id":"necrotic_husk","name":{"en":"Form of the Dead","es":"Forma de los Muertos"},"level":1,
      "description":{"en":"Advantage on death saves; you don't need to sleep; immune to sleep/disease; speak with dead.","es":"Ventaja en salvaciones contra muerte; no duermes; immune a sueño/enfermedad; hablas con muertos."}},
     {"id":"grave_managed","name":{"en":"Grave Managed","es":"Tumba Manejada"},"level":3,
      "description":{"en":"Bonus action: create skeletal form and ward zone.","es":"Acción adicional: forma esqueleto y zona de protección."}},
     {"id":"spirit_projection","name":{"en":"Spirit Projection","es":"Proyección Espiritual"},"level":6,
      "description":{"en":"Project your spirit; immune to physical; damage projection cast.","es":"Proyectas tu espíritu; inmune a físico; daño por proyección."}},
     {"id":"undying_servitude","name":{"en":"Undying Servitude","es":"Servidumbre Inmortal"},"level":10,
      "description":{"en":"Cast Animate Dead and Create Undead at will.","es":"Lanza Animar muertos y Crear no-muerto a voluntad."}} ] },
  {"class_id":"warlock","id":"hexblade_patron",
   "name":{"en":"The Hexblade Patron","es":"El Patrón Hoja Maldita"},
   "grantedAtLevel":1,
   "description_en":"Your patron is a mysterious entity from the Shadowfell. Your bond is forged with a sentient weapon.",
   "description_es":"Tu patrón es una entidad misteriosa del Páramo Sombrío. Tu vínculo se forja con un arma sensible.",
   "features":[
     {"id":"hex_magic","name":{"en":"Hex Magic","es":"Magia de Hoja"},"level":1,
      "description":{"en":"Expanded spell list: Shield, Bless, Lightning Bolt, etc.","es":"Lista expandida: Escudo, Bendecir, Relámpago, etc."}},
     {"id":"hexblade_curse","name":{"en":"Hexblade's Curse","es":"Maldición de Hoja"},"level":1,
      "description":{"en":"Bonus action target a creature; deal 1d6 + Proficiency bonus extra damage; score crits on 19-20.","es":"Acción adicional maldices: +1d6 + mod competencia; críticos en 19-20."}},
     {"id":"eldritch_invocation","name":{"en":"Accursed Specter","es":"Espectro Maldito"},"level":6,
      "description":{"en":"Spawn specter from a corpse (using a spell slot) acts on turn.","es":"Creas espectro de un cadáver (gastando slot); actúa en tu turno."}},
     {"id":"armor_of_hexes","name":{"en":"Armor of Hexes","es":"Armadura de Hoja"},"level":10,
      "description":{"en":"Reaction when hit by attack: roll d6: 4+ spell failure.","es":"Reacción al ser atacada: tira d6: 4+ hechizo fracasa."}},
     {"id":"master_of_hexes","name":{"en":"Master of Hexes","es":"Maestro de Hojas"},"level":14,
      "description":{"en":"Hexblade's Curse target = 2 creatures; restore on short rest.","es":"Maldición sobre 2 criaturas; recupera en descanso corto."}} ] },

  # ───────────────────────────── WIZARD (+6) ───────────────────────────────
  {"class_id":"wizard","id":"conjuration",
   "name":{"en":"School of Conjuration","es":"Escuela de Conjuración"},
   "grantedAtLevel":2,
   "description_en":"You specialize in instant summons, teleportation, and binding beings from other dimensions.",
   "description_es":"Te especializas en invocaciones instantáneas, teletransporte y ataduras de seres de otras dimensiones.",
   "features":[
     {"id":"conjuration_savant","name":{"en":"Conjuration Savant","es":"Sabio de Conjuración"},"level":2,
      "description":{"en":"Halves gold and time to copy conjuration spells.","es":"Reduce a la mitad el oro y tiempo para copiar conjuros de conjuración."}},
     {"id":"minor_conjuration","name":{"en":"Minor Conjuration","es":"Conjuración Menor"},"level":2,
      "description":{"en":"Action: conjure a nonmagical item (≤3 ft cube, ≤10 lb) for 1 hour.","es":"Acción: conjura un objeto no mágico (cubo ≤1,5 m, ≤5 kg) 1 hora."}},
     {"id":"benign_transposition","name":{"en":"Benign Transposition","es":"Transposición Benigna"},"level":6,
      "description":{"en":"Reaction when cast conjuration spell of 1+: teleport 30 ft.","es":"Reacción al lanzar conjuro nivel 1+: teletransporte 9 m."}},
     {"id":"focused_conjuration","name":{"en":"Focused Conjuration","es":"Conjuración Concentrada"},"level":10,
      "description":{"en":"While concentrating on a conjuration spell, don't have disadvantage on concentration saves.","es":"Concentrando conjuro de conjuración, sin desventaja en salvación de concentración."}},
     {"id":"durable_summons","name":{"en":"Durable Summons","es":"Invocaciones Durables"},"level":14,
      "description":{"en":"Summoned creatures have 30 temp HP and advantage on saves vs. being banished.","es":"Criaturas convocadas tienen 30 pg temp y ventaja contra destierro."}} ] },
  {"class_id":"wizard","id":"divination",
   "name":{"en":"School of Divination","es":"Escuela de Adivinación"},
   "grantedAtLevel":2,
   "description_en":"You seek information, expertise, foresight, and the truth of magic.",
   "description_es":"Buscas información, pericia, previsión y la verdad de la magia.",
   "features":[
     {"id":"divination_savant","name":{"en":"Divination Savant","es":"Sabio de Adivinación"},"level":2,
      "description":{"en":"Halves gold and time to copy divination spells.","es":"Reduce a la mitad el oro y tiempo para copiar conjuros de adivinación."}},
     {"id":"portent","name":{"en":"Portent","es":"Presagio"},"level":2,
      "description":{"en":"At long rest: roll 2 d20; replace any attack/save/check with prescience.","es":"Al descanso prolongado: tira 2 d20; sustituye cualquier ataque/salvación/prueba."}},
     {"id":"expert_divination","name":{"en":"Expert Divination","es":"Experto en Adivinación"},"level":6,
      "description":{"en":"Casting divination spell of 2+ level recovers a 3rd level spell slot.","es":"Lanzar conjuro adivinación de 2+ recupera un slot de nivel 3."}},
     {"id":"third_eye","name":{"en":"Third Eye","es":"Tercer Ojo"},"level":10,
      "description":{"en":"Action: gain darkvision 60 ft (or see invisible, or sense magic; SE range).","es":"Acción: visión 18 m, ver invisibles o detectar magia (a elección)."}},
     {"id":"capstone","name":{"en":"Greater Portent","es":"Presagio Mayor"},"level":14,
      "description":{"en":"Roll 4d20 for Portent at long rest.","es":"Tira 4 d20 para Presagio al descanso prolongado."}} ] },
  {"class_id":"wizard","id":"enchantment",
   "name":{"en":"School of Enchantment","es":"Escuela de Encantamiento"},
   "grantedAtLevel":2,
   "description_en":"You wield arcane influence over minds and emotions.",
   "description_es":"Empuñas influencia arcana sobre mentes y emociones.",
   "features":[
     {"id":"enchantment_savant","name":{"en":"Enchantment Savant","es":"Sabio de Encantamiento"},"level":2,
      "description":{"en":"Halves gold and time to copy enchantment spells.","es":"Reduce a la mitad el oro y tiempo para copiar conjuros de encantamiento."}},
     {"id":"hypnotic_gaze","name":{"en":"Hypnotic Gaze","es":"Mirada Hipnótica"},"level":2,
      "description":{"en":"Action: gain CHA mod charges/day; on Wis save, charmed 1 min.","es":"Acción: Carisma mod cargas/día; Sabiduría save o encantado 1 min."},"savingThrow":"Wisdom"},
     {"id":"instinctive_enchantment","name":{"en":"Instinctive Enchantment","es":"Encantamiento Instintivo"},"level":6,
      "description":{"en":"When casting an enchantment spell with Wis save, treat target's save as -1.","es":"Conjuros encantamiento con Sabiduría: salvación del objetivo es -1."}},
     {"id":"split_enchantment","name":{"en":"Split Enchantment","es":"Encantamiento Dividido"},"level":10,
      "description":{"en":"Cast a single-target enchantment on 2 creatures for slot increase.","es":"Lanza encantamiento de un objetivo a 2 criaturas a costa de un slot mayor."}},
     {"id":"modify_memory","name":{"en":"Alter Memories","es":"Alterar Memorias"},"level":14,
      "description":{"en":"Cast Modify Memory with Dispel Magic-like effect; overwriting memory.","es":"Lanza Modificar memoria similar a Disipar magia; sobrescribe memorias."}} ] },
  {"class_id":"wizard","id":"illusion",
   "name":{"en":"School of Illusion","es":"Escuela de Ilusión"},
   "grantedAtLevel":2,
   "description_en":"You focus your studies on the magic of phantasms, deception, and make-believe.",
   "description_es":"Enfocás tus estudios en la magia de fantasmas, engaños y la ilusión.",
   "features":[
     {"id":"illusion_savant","name":{"en":"Illusion Savant","es":"Sabio de Ilusión"},"level":2,
      "description":{"en":"Halves gold and time to copy illusion spells.","es":"Reduce a la mitad el oro y tiempo para copiar conjuros de ilusión."}},
     {"id":"improved_minor_illusion","name":{"en":"Improved Minor Illusion","es":"Ilusión menor mejorada"},"level":2,
      "description":{"en":"Minor Illusion can be cast as a free action and has 5-foot cube.","es":"Ilusión menor acción gratuita; cubo de 1,5 m."}},
     {"id":"malleable_illusions","name":{"en":"Malleable Illusions","es":"Ilusiones Maleables"},"level":6,
      "description":{"en":"Action: change illusion's appearance, terrain, or features.","es":"Acción: cambia la apariencia, terreno o rasgos de la ilusión."}},
     {"id":"illusory_self","name":{"en":"Illusory Self","es":"Yo Ilusorio"},"level":10,
      "description":{"en":"Reaction when hit: create illusion duplicate and swap places.","es":"Reacción al ser golpeado: duplicado ilusorio e intercambia posiciones."}},
     {"id":"illusory_reality","name":{"en":"Illusory Reality","es":"Realidad Ilusoria"},"level":14,
      "description":{"en":"Choose one illusory object to become real for 1 min.","es":"Elige un objeto ilusorio y hazlo real por 1 min."}} ] },
  {"class_id":"wizard","id":"necromancy",
   "name":{"en":"School of Necromancy","es":"Escuela de Nigromancia"},
   "grantedAtLevel":2,
   "description_en":"Your study focuses on animating the dead and corrupting life force.",
   "description_es":"Tu estudio se enfoca en animar muertos y corromper fuerza vital.",
   "features":[
     {"id":"necromancy_savant","name":{"en":"Necromancy Savant","es":"Sabio de Nigromancia"},"level":2,
      "description":{"en":"Halves gold and time to copy necromancy spells.","es":"Reduce a la mitad el oro y tiempo para copiar conjuros de nigromancia."}},
     {"id":"grim_harvest","name":{"en":"Grim Harvest","es":"Cosecha Siniestra"},"level":2,
      "description":{"en":"Damage enemy: gain HP equal to 1/3 necrotic damage; spend 1 HP to restore 1 HP.","es":"Al dañar a enemigo con necromancia, recuperas pg igual a 1/3 del daño."}},
     {"id":"undead_thralls","name":{"en":"Undead Thralls","es":"Esbirros No-Muertos"},"level":6,
      "description":{"en":"Animate Dead and spells create extra undead skeletons/zombies.","es":"Animar muertos crea esqueletos adicionales y añade 1d4 necromántico."}},
     {"id":"inured_to_undeath","name":{"en":"Inured to Undeath","es":"Insensibilidad a Muerte"},"level":6,
      "description":{"en":"Resistance to necrotic; immunity to fear.","es":"Resistencia necrótica; inmune a miedo."}},
     {"id":"capstone","name":{"en":"Command Undead","es":"Comandar No-Muertos"},"level":14,
      "description":{"en":"Cast Animate Dead at will (no slot); command undead for 24 h.","es":"Lanza Animar muertos a voluntad (sin slot); 24 h de control."}} ] },
  {"class_id":"wizard","id":"transmutation",
   "name":{"en":"School of Transmutation","es":"Escuela de Transmutación"},
   "grantedAtLevel":2,
   "description_en":"You study the magic of changing forms, altering reality, and transforming creatures.",
   "description_es":"Estudiás la magia de cambiar formas, alterar realidad y transformar criaturas.",
   "features":[
     {"id":"transmutation_savant","name":{"en":"Transmutation Savant","es":"Sabio de Transmutación"},"level":2,
      "description":{"en":"Halves gold and time to copy transmutation spells.","es":"Reduce a la mitad el oro y tiempo para copiar conjuros de transmutación."}},
     {"id":"minor_alchemy","name":{"en":"Minor Alchemy","es":"Alquimia Menor"},"level":2,
      "description":{"en":"Action: transmute a nonmagical item; lasts 1 hour.","es":"Acción: transmuta un objeto no mágico; dura 1 hora."}},
     {"id":"shapechanger_aura","name":{"en":"Shapechanger Detection","es":"Detección de Cambiaformas"},"level":6,
      "description":{"en":"Detect shapechangers within 60 ft (1 hour meditation).","es":"Detecta cambiaformas a 18 m (1 hora de meditación)."}},
     {"id":"master_transmuter","name":{"en":"Master Transmuter","es":"Maestro Transmutador"},"level":10,
      "description":{"en":"Action: gain resistance / immunity / power transformation; 1 hour.","es":"Acción: resistencia/dureza/poder de transmutación; 1 hora."}},
     {"id":"capstone","name":{"en":"Shapechanger Lord","es":"Señor Cambiaformas"},"level":14,
      "description":{"en":"Once per long rest, cast True Polymorph greater.","es":"Una vez por descanso prolongado, lanza Polimorfismo verdadero mayor."}} ] },
]

# ------------------------------------------------------------ flatten walker

SPANISH_OVERRIDES: dict[str, dict[str, str]] = {
  # key on (class_id, subclass_id), value is {field_name: spanish_text}
  # Provide wedges only where direct EN→ES translation needs canonical substitution.
  # Common cases are auto-handled below; this table is just for overrides.
}

def localize_school_subclass(val, lang, base_name_hint: str = ""):
    """Names get a simple transformation; description stays with the dict walker."""
    if isinstance(val, dict) and "en" in val and "es" in val and set(val.keys()) <= {"en", "es"}:
        return val.get(lang, "")
    if isinstance(val, list):
        return [localize_school_subclass(v, lang) for v in val]
    if isinstance(val, dict):
        return {k: localize_school_subclass(v, lang) for k, v in val.items()}
    return val

def localize(val, lang):
    if isinstance(val, dict) and "en" in val and "es" in val and set(val.keys()) <= {"en", "es"}:
        return val.get(lang, "")
    if isinstance(val, list):
        return [localize(v, lang) for v in val]
    if isinstance(val, dict):
        return {k: localize(v, lang) for k, v in val.items()}
    return val

# ------------------------------------------------------------ merge & write

def main():
    by_lang = {}
    for lang in ("en", "es"):
        classes = {}
        for fpath in (EN_DIR if lang == "en" else ES_DIR).glob("*.json"):
            try:
                classes[fpath.stem] = json.load(open(fpath, encoding="utf-8"))
            except Exception:
                classes[fpath.stem] = {}
        # Pre-cache existing subclass IDs per class
        existing = {cls_id: {s.get("id") for s in (classes.get(cls_id, {}).get("subclasses") or [])}
                    for cls_id in classes}
        added_count = 0
        skipped = []
        for sub in SUBCLASSES:
            cls_id = sub["class_id"]
            sub_id = sub["id"]
            if cls_id not in classes:
                skipped.append(("missing_class", cls_id, sub_id))
                continue
            if sub_id in existing.get(cls_id, set()):
                skipped.append(("already_present", cls_id, sub_id))
                continue
            # Localize to single-language record
            class_record = classes[cls_id]
            existing_subs = class_record.get("subclasses") or []
            if not isinstance(existing_subs, list):
                existing_subs = []
            # Apply spanish overrides from table (if any)
            sub_localized = localize(sub, lang)
            existing_subs.append(sub_localized)
            class_record["subclasses"] = existing_subs
            existing[cls_id].add(sub_id)
            added_count += 1
        # Materialize: keep canonical bucket per language so we don't cross-write
        by_lang[lang] = classes
        print(f"  {lang}: added {added_count}; skipped {len(skipped)}; total classes touched: {len([c for c in classes if classes[c].get('subclasses')])}")
        if skipped[:5]:
            print(f"    first skipped: {skipped[:5]}")

    # Sort subclasses alphabetically per class (deterministic)
    for lang, classes in by_lang.items():
        for cls_id, class_rec in classes.items():
            subs = class_rec.get("subclasses") or []
            if isinstance(subs, list):
                subs.sort(key=lambda s: (s.get("grantedAtLevel", 99) if isinstance(s, dict) else 99, s.get("id", "") or ""))
                class_rec["subclasses"] = subs

    # Write back EN and ES files (only classes that we touched or already existed)
    for lang, classes in by_lang.items():
        out_dir = EN_DIR if lang == "en" else ES_DIR
        for cls_id, class_rec in classes.items():
            out_path = out_dir / f"{cls_id}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(class_rec, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
