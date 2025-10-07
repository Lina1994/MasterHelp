# Bestiary ES – Glosario rápido y checklist

Objetivo: mantener traducciones consistentes en los JSON per-monster en `backend/data/manuals/dnd5e-2014/monsters/es`.

## Glosario recomendado (EN → ES)

- Armor Class → Clase de armadura (CA)
- Hit Points → Puntos de golpe (PG)
- Speed → Velocidad
  - walk → a pie | swim → nadar | fly → volar | climb → trepar | burrow → excavar
- Saving Throws → Tiradas de salvación
- Skills → Habilidades
- Senses → Sentidos
  - darkvision → visión en la oscuridad | blindsight → vista ciega | tremorsense → sentido de vibración | truesight → visión verdadera | passive Perception → Percepción pasiva
- Languages → Idiomas
- Challenge → Desafío (ND) / Rango de Desafío (CR)
- Traits → Rasgos
- Actions → Acciones
- Reactions → Reacciones
- Legendary Actions → Acciones legendarias
- Melee Weapon Attack → Ataque de arma cuerpo a cuerpo
- Ranged Weapon Attack → Ataque de arma a distancia
- Hit → Impacto
- Reach → Alcance
- Target → Objetivo
- Damage → Daño
- Damage Immunities → Inmunidades al daño
- Damage Resistances → Resistencias al daño
- Damage Vulnerabilities → Vulnerabilidades al daño
- Condition Immunities → Inmunidades a condiciones
- Advantage/Disadvantage → Ventaja/Desventaja
- Recharge → Recarga

Nombres de tipos/tamaños/alineamientos:
- Types: aberration → aberración; beast → bestia; celestial → celestial; construct → constructo; dragon → dragón; elemental → elemental; fey → feérico; fiend → infernal; giant → gigante; humanoid → humanoide; monstrosity → monstruosidad; ooze → limo; plant → planta; undead → no muerto
- Sizes: Tiny → Diminuto; Small → Pequeño; Medium → Mediano; Large → Grande; Huge → Enorme; Gargantuan → Colosal
- Alignments: lawful → legal; neutral → neutral; chaotic → caótico; good → bueno; evil → malvado; unaligned → no alineado

Daños y condiciones (SRD):
- acid → ácido; bludgeoning → contundente; cold → frío; fire → fuego; force → fuerza; lightning → relámpago; necrotic → necrótico; piercing → perforante; poison → veneno; psychic → psíquico; radiant → radiante; slashing → cortante; thunder → trueno
- blinded → cegado; charmed → hechizado; deafened → ensordecido; frightened → asustado; grappled → agarrado; incapacitated → incapacitado; invisible → invisible; paralyzed → paralizado; petrified → petrificado; poisoned → envenenado; prone → derribado; restrained → restringido; stunned → aturdido; unconscious → inconsciente

## Checklist por archivo

1) name traducido y coherente con slug si aplica.
2) Campos meta: type/size/alignment en ES consistente con glosario.
3) Bloques SRD: Armor Class/Hit Points/Speed/Saving Throws/Skills/Senses/Languages/Challenge.
4) Rasgos/Acciones/Acciones legendarias: títulos y texto en ES; métricas (alcance, daño, recarga) preservadas.
5) Listas de resistencias/inmunidades/vulnerabilidades/condiciones en ES.
6) Números, dados y CD: no traducir notación (e.g., 2d6+3), CD → CD 13.
7) Marcar `translated: true` cuando el contenido principal esté en español.
8) Ejecutar reindexado: `npm --prefix backend run monsters:reindex:es`.

## Automatización útil

- Marcar traducidos automáticamente:
  `node backend/scripts/mark-translated-es.cjs --manual dnd5e-2014`

- Reconstruir índice ES:
  `npm --prefix backend run monsters:reindex:es`
