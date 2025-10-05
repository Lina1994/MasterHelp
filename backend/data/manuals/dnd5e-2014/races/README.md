Races dataset for D&D 5e 2014 manual

- Files: races.en.json, races.es.json
- Format: normalized JSON suitable for character builder automation (no free text as single blobs)

Schema v1 (per race):
{
  "id": "dwarf",
  "name": "Dwarf",
  "source": "PHB 2014 / SRD 5.1",
  "abilityBonuses": { "con": 2 },
  "age": { "maturity": 50, "youngUntil": 50, "max": 350 },
  "size": "Medium",
  "sizeDetails": { "heightMinInches": 48, "heightMaxInches": 60, "weightAvgLbs": 150 },
  "alignment": { "tendencies": ["lawful", "good"] },
  "speed": { "walk": 25, "noHeavyArmorPenalty": true },
  "languages": ["Common", "Dwarvish"],
  "proficiencies": {
    "weapons": ["Battleaxe", "Handaxe", "Throwing Hammer", "Warhammer"],
    "armor": [],
    "tools": []
  },
  "senses": { "darkvision": 60, "noColor": true },
  "traits": [
    { "id": "dwarven_resilience", "name": "Dwarven Resilience", "description": "You have advantage on saving throws against poison, and you have resistance against poison damage.", "effects": [{ "type": "advantage_saves", "vs": ["poison"] }, { "type": "resistance", "damage": ["poison"] }] },
    { "id": "dwarven_combat_training", "name": "Dwarven Combat Training", "description": "You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.", "effects": [{ "type": "proficiency_weapons", "weapons": ["Battleaxe","Handaxe","Light Hammer","Warhammer"] }] },
    { "id": "stonecunning", "name": "Stonecunning", "description": "Whenever you make a History check related to the origin of stonework, you are considered proficient and add double your proficiency bonus.", "effects": [{ "type": "expertise_check", "skill": "History", "condition": "checks related to the origin of stonework" }] }
  ],
  "choices": [
    {
      "id": "tool_proficiency_choice",
      "type": "tool_proficiency",
      "category": "artisan_tools",
      "options": ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"],
      "count": 1
    }
  ],
  "subraces": [
    {
      "id": "hill_dwarf",
      "name": "Hill Dwarf",
      "abilityBonuses": { "wis": 1 },
      "traits": [ { "id": "dwarven_toughness", "name": "Dwarven Toughness", "effects": [{ "type": "hp_per_level", "value": 1 }] } ]
    },
    {
      "id": "mountain_dwarf",
      "name": "Mountain Dwarf",
      "abilityBonuses": { "str": 2 },
      "proficiencies": { "armor": ["Light Armor", "Medium Armor"] },
      "traits": []
    }
  ]
}

Notes:
- Keep effects typed and machine-readable; avoid narrative-only text.
- Localize names and language names in ES file; keep ids stable across locales.
- Choices: represent selectable options with a "choices" array; the builder can resolve them interactively.
 - Traits vs Choices: cuando un rasgo requiere una elección (p.ej., herramientas de artesano), puedes añadir un trait descriptivo (sin efectos) además de la entrada en "choices" para conservar la redacción original.
