# Bestiary Data (D&D 5e SRD 5.1, 2014)

Estructura de datos por monstruo (por idioma) y convenciones para el split del JSON monolítico.

## Carpetas

- `en/` — un archivo JSON por monstruo en inglés.
- `es/` — un archivo JSON por monstruo en español (misma `id` y `slug`).
- `en/srd_5e_monsters.json` — archivo monolítico original (referencia y fallback temporal).

## Esquema por monstruo

Campos mínimos normalizados (JSON):

```
{
  "id": "string",
  "slug": "string-kebab",
  "lang": "en|es",
  "name": "string",
  "source": "SRD 5.1",
  "size": "Tiny|Small|Medium|Large|Huge|Gargantuan",
  "type": "string",
  "subtype": "string?",
  "alignment": "string?",
  "armorClass": { "value": 0, "type": "string?", "notes": "string?" },
  "hitPoints": { "average": 0, "roll": "XdY+Z?" },
  "speed": { "walk": 30, "fly": 0, "swim": 0, "climb": 0, "burrow": 0 },
  "abilities": { "str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10 },
  "savingThrows": { "str": 0, "dex": 0, ... }?,
  "skills": { "perception": 0, ... }?,
  "damageVulnerabilities": ["..."],
  "damageResistances": ["..."],
  "damageImmunities": ["..."],
  "conditionImmunities": ["..."],
  "senses": { "passivePerception": 10, "darkvision": "60 ft.", ... }?,
  "languages": "string?",
  "proficiencyBonus": 2,
  "challengeRating": "1/2",
  "traits": [{ "name": "", "text": "" }],
  "actions": [{ "name": "", "text": "" }],
  "reactions": [{ "name": "", "text": "" }]?,
  "legendaryActions": [{ "name": "", "text": "" }]?,
  "lairActions": [{ "name": "", "text": "" }]?,
  "regionalEffects": [{ "name": "", "text": "" }]?,
  "spellcasting": [
    {
      "header": "Spellcasting|Innate Spellcasting",
      "description": "...",
      "atWill": ["spell"],
      "daily": { "1/day": ["..."], "2/day": ["..."], "3/day": ["..."] },
      "slots": [{ "level": 1, "slots": 4, "spells": ["..."] }]
    }
  ]?,
  "environment": ["..."],
  "sourcePage": "string?",
  "notes": ["..."]
}
```

## Índices

Para listados rápidos sin abrir todos los archivos, generar índices por idioma:

```
index.en.json | index.es.json
{
  "lang": "en",
  "items": [
    { "id": "...", "slug": "...", "name": "...", "type": "...", "size": "Medium", "alignment": "...", "challengeRating": "1/4", "translated": true }
  ]
}
```

## Convenciones

- `id` y `slug` deben ser idénticos entre EN y ES para el mismo monstruo.
- Omitir campos vacíos; no usar arrays vacíos si no hay datos.
- Los textos se conservan tal cual del SRD en EN; en ES inicialmente pueden copiarse con `translated=false` hasta traducir.
- Evitar duplicidades: una criatura por `slug`.

## Plantilla mínima

Ver `TEMPLATE.monster.json` como referencia para crear/validar archivos.
