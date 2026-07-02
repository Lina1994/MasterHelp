# Archivos obsoletos / candidatos a revisión

> **Propósito**: documento de trabajo. NO se ha modificado ni borrado ningún archivo del proyecto. Cada entrada debe revisarse manualmente antes de tomar medidas (borrar, mover a `archive/`, refactorizar, etc.).
>
> **Cómo se generó**: combinación de `git status`, búsqueda de imports entrantes, `find` por nombres sospechosos (`tmp_*`, lock files), inspección de archivos a 0 bytes y revisión de `git log --diff-filter=D` últimos 12 meses.
>
> **Fecha de generación**: 2026-06-22.

---

## 1 · Archivos untracked (git status) — borrar alta probabilidad

Rutas absolutas relativas al root del repo (`C:\CODE V2\dm-app\MasterHelp`):

| Ruta | Tipo | Notas |
|---|---|---|
| `./tmp_docx_dump.json` | 2146 líneas, ~200 KB | Dump estructural del DOCX; generado por `tmp_extract_docx.py`. |
| `./tmp_extract_docx.py` | 45 líneas | Script one-off para extraer estilos del DOCX. |
| `./tmp_find_masterhelp.py` | 46 líneas | Script buscador. |
| `./tmp_generate_masterhelp.py` | 1297 líneas | Script grande de generación del manual. No invocado desde código. |
| `./tmp_inspect_docx.py` | 43 líneas | Script de inspección. |
| `./~$sterHelp.docx` | binario | Lock file de Office al abrir `MasterHelp.docx`. No debe versionarse. |

> **Ningún archivo del repo referencia estas rutas** (`grep` exhaustivo sobre `*.ts`, `*.tsx`, `*.js`, `*.json`, `*.cjs`, `*.yml`, `*.md`).

---

## 2 · `tmp_*` committed en `backend/` — borrar alta probabilidad

| Ruta | Tamaño | Notas |
|---|---|---|
| `backend/tmp_check_character_media.js` | 40 líneas | Script JS suelto en backend, sin `package.json` propio. |
| `backend/tmp_check_character_media_schema.js` | 34 líneas | Idem, segundo guion relacionado. |
| `backend/tmp_ranger_en.json` | 47 líneas | Datos de clase Ranger en EN, encoding con nulos. |
| `backend/tmp_ranger_es.json` | 47 líneas | Idem en ES. |
| `backend/tmp_sorcerer_en.json` | 150 líneas | Datos Sorcerer EN. |
| `backend/tmp_sorcerer_es.json` | 150 líneas | Hechicero ES. |
| `backend/tmp_warlock_en.json` | 84 líneas | Datos Warlock EN. |
| `backend/tmp_warlock_es.json` | 84 líneas | Brujo ES. |

> **Carrier**: estos `tmp_*` no aparecen en `git status` (tracked). Conviene decidir si se purgan del historial o se archivan aparte.

---

## 3 · `tmp_*` committed en raíz — borrar alta probabilidad

| Ruta | Tamaño | Notas |
|---|---|---|
| `./tmp_apply_divider_fix.py` | 120 líneas | Fix puntual de divisores SVG (probablement ya integrado). |
| `./tmp_cleanup_divider_fix.py` | 71 líneas | Limpieza de `</div>` extra. |
| `./tmp_druid_en.json` | 130 líneas | Datos Druid EN. |
| `./tmp_druid_es.json` | 130 líneas | Datos Druida ES. |

(Los 5 scripts/docx ya listados arriba también están en raíz: `tmp_docx_dump.json`, `tmp_extract_docx.py`, `tmp_find_masterhelp.py`, `tmp_generate_masterhelp.py`, `tmp_inspect_docx.py`.)

---

## 4 · Directorios vacíos / no usados

| Ruta | Tamaño | Notas |
|---|---|---|
| `backend/data/tmp/` | 0 bytes | Carpeta vacía. No hay referencias en código (`grep "data/tmp"`). Probable residuo. |

> NOTA: `backend/data/media/` (629 MB) y `backend/data/manuals/` (5,1 MB) NO son obsoletos — contienen subidas de usuarios y manuales — pero conviene auditorías de tamaño aparte.

---

## 5 · Archivos a 0 bytes (probablemente placeholders o restos de migración)

### Frontend
- `frontend/src/api/shopsApi.ts`
- `frontend/src/components/characters/CharacterImageCropper.tsx`
- `frontend/src/components/characters/CroppedAvatarImage.tsx`

### Backend
- `backend/src/characters/entities/character-media.entity.ts`
- `backend/src/projected-character.controller.ts`
- `backend/src/projected-character.entity.ts`
- `backend/src/projected-character.module.ts`
- `backend/src/projected-character.service.ts`

> **Cross-check**: `grep -rln "shopsApi\|CharacterImageCropper\|CroppedAvatarImage\|projected-character\|ProjectedCharacter"` no devuelve resultados. Confirmado: **nadie los importa**. Candidato fuerte a borrar (o restaurar contenido desde git si fue accidentalmente vaciado).

---

## 6 · Candidatos a huérfanos en `frontend/src/` (sin imports detectados)

Búsqueda por basename en todos los `*.ts`/`*.tsx`. **Cada uno debe verificarse manualmente** porque la heurística puede fallar con nombres repetidos:

| Ruta | Riesgo | Verificación adicional |
|---|---|---|
| `frontend/src/components/Campaign/campaignUtils.ts` | medio | Buscar funciones exportadas en uso implícito. |
| `frontend/src/components/DebugUserInfo.tsx` | alto | Suena a herramienta de depuración olvidada. |
| `frontend/src/components/Map/LightPreviewLayer.tsx` | medio | Comprobar si el sistema de luces se migró a otro módulo. |
| `frontend/src/components/player/GlobalPlayerBar.tsx` | medio | Existe `GlobalPlayerContext`/`Drawer`; el "Bar" puede ser redundante. |
| `frontend/src/components/soundEffects/PresetDialog.tsx` | medio | Comprobar si existe diálogo equivalente en otra ruta. |
| `frontend/src/components/soundtrack/SoundtrackSettingsCard.tsx` | medio | Verificar uso en `SoundtrackPage.tsx`. |
| `frontend/src/pages/CampaignBestiaryDetailPage.tsx` | medio | Comprobar ruta en `router/index.tsx`. |
| `frontend/src/utils/hpRoll.ts` | bajo | Utilidad pequeña; verificar antes de borrar. |

### Falso positivo confirmado
- `frontend/src/components/Campaign/ActiveCampaignProvider.tsx` → **SÍ se usa** (referenciado por `App.tsx` y `ActiveCampaignContext.tsx`). No borrar.

---

## 7 · Archivos eliminados recientemente (auditoría de regresión)

`git log --diff-filter=D --name-only --since="12 months ago"`:

| Commit | Fecha | Archivo borrado |
|---|---|---|
| `c1251c47` | 2026-05-23 | `frontend/src/components/scenes/menus/TextContextualMenu.tsx` |
| `f1a311b3` | 2026-05-16 | `backend/data/media/scene-videos/1/1778874500938-8dcbf825-...mp4` |

> Auditoría: `grep -rln "TextContextualMenu"` no devuelve ningún import vigente → **borrado limpio, sin huérfanos**.

---

## 8 · Recomendación de procedimiento

1. **Borrado inmediato (alto valor, bajo riesgo)**:
   - Los 6 untracked del root (`tmp_docx_dump.json`, 4× `tmp_*.py`, `~$sterHelp.docx`).
   - Los 8 archivos a 0 bytes listados arriba (verificar primero con `git log -p <file>` si fueron vaciados por accidente).
   - El directorio vacío `backend/data/tmp/`.

2. **Borrado con cautela (revisar origen antes)**:
   - Los 8 `tmp_*` committed en `backend/`.
   - Los 7 `tmp_*` committed en raíz.
   - Los 8 candidatos huérfanos en `frontend/src/`.

3. **No borrar sin investigar más**:
   - Contenido de `backend/data/media/` y `backend/data/manuals/` (es data de usuario).
   - Cualquier archivo que un `grep` no detectó pero que pueda cargarse dinámicamente (`import()` con strings, requiere introspección manual).

4. **Si algún archivo tiene valor histórico** (ej. `tmp_generate_masterhelp.py` de 1297 líneas parece el generador del manual), considerar moverlo a `scripts/archive/` en lugar de borrarlo.

---

## 9 · Cómo reproducir este informe

```bash
# Untracked
git status --porcelain
git ls-files --others --exclude-standard

# tmp_* files
find . -name "tmp_*" ! -path "*/node_modules/*" ! -path "*.git/*" ! -path "*/release/*"

# Lock files
find . -name "~$*" ! -path "*/node_modules/*" ! -path "*.git/*"

# Empty source files
find frontend/src backend/src -type f -size 0

# Files deleted recently
git log --all --diff-filter=D --name-only --pretty=format:"%h %ad %s" --date=short --since="12 months ago"
```
