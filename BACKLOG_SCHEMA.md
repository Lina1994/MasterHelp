# Backlog & Schema Roadmap

Este documento recoge la evolución planificada del modelo de datos y dominios funcionales, organizado por fases incrementales para llegar desde el MVP actual hasta las funcionalidades avanzadas descritas en `context/COntexto de la aplicación.txt`.

## Leyenda de Prioridad
- P0: Bloqueador / Necesario para continuidad inmediata.
- P1: Esencial MVP extendido (después de P0, antes de features ricas).
- P2: Valor narrativo medio / mejora de experiencia.
- P3: Avanzado / inmersión / optimización.

## Fase Actual (MVP Base)
Entidades existentes:
- `user` (id, username, email, password(hash), language, theme)
- `campaign` (id UUID, name, description?, imageUrl?, ownerId FK->user, createdAt, updatedAt)
- `campaign_player` (id, campaignId FK, userId FK, role (owner|player), status (invited|active|declined))

Endpoints críticos:
- Auth (login, register, forgot/reset password)
- Campaign CRUD (owner restricted en update/delete)
- Invite / accept / decline (invitaciones)
- List campaigns (owner o player)

P0 reforzar:
- Verificación explícita de ownership en update/delete/ invite/remove player.

## Fase 1 – Extensión Narrativa Inicial (P1)
Objetivo: Añadir soporte de notas y diario básico, sin calendario complejo.

### Nuevas Entidades
1. `campaign_note`
   - id (uuid)
   - campaignId FK
   - title (string)
   - content (text/markdown)
   - visibility: enum('master','players')
   - createdAt, updatedAt
   - authorId FK (opcional si se quiere rastreo)

2. `journal_entry`
   - id (uuid)
   - campaignId FK
   - date (ISO simple o epoch)  // Se reemplazará en Fase 2 por calendario custom
   - content (text/markdown)
   - visibility: enum('master','players')
   - createdAt

### Reglas
- Solo master crea/edita/elimina (`campaign_note`, `journal_entry` con visibility master).
- Players pueden leer solo entradas con visibility players.

### Migraciones sugeridas
```sql
ALTER TABLE campaign_note ...;
```
(Implementar con TypeORM migrations, no `synchronize` en entornos productivos.)

## Fase 2 – Worldpedia y Estructura Jerárquica (P1/P2)
Objetivo: Notas estructuradas y repositorio de lore.

### Nuevas Entidades
1. `worldpedia_folder`
   - id (uuid)
   - campaignId FK
   - name (string)
   - parentId (nullable FK self)
   - createdAt / updatedAt

2. `worldpedia_note`
   - id (uuid)
   - campaignId FK
   - folderId FK (nullable para notas raíz)
   - title (string)
   - content (markdown / richtext plano inicial)
   - createdAt / updatedAt
   - linksExtracted (JSON array opcional para indexación) // P3

### Futuro (Enlaces)
- Fase inicial: parse ligero de patrones `[[Note:ID]]` en frontend.
- Fase avanzada: tabla `worldpedia_link` (sourceId, targetId, createdAt).

## Fase 3 – Mapas y Multimedia Básico (P2)
Objetivo: Mostrar mapas e imágenes en ventanas secundarias (web tabs primero).

### Nuevas Entidades
1. `map`
   - id (uuid)
   - campaignId FK
   - name
   - group (string?)
   - baseImageUrl (string)
   - timeOfDayVariants: JSON? { dawn?, morning?, afternoon?, night? } (P3 optimizar)
   - createdAt / updatedAt

2. `map_song`
   - id
   - mapId FK
   - context: enum('base','battle_easy','battle_medium','battle_hard','battle_deadly','battle_extreme')
   - timeOfDay? (dawn|morning|afternoon|night)
   - trackId FK (relación con tabla soundtrack futura)

### Consideraciones Técnicas
- Multi-resolución / blobs posponer a P3.
- Inicial: almacenamiento de URL (puede ser local static folder).

## Fase 4 – Sonido, Encuentros y Combate (P2/P3)
Objetivo: Estructurar combate y ambientación sonora.

### Nuevas Entidades
1. `soundtrack_track`
   - id (uuid)
   - campaignId FK (o global scope con null)
   - name
   - group? (string)
   - fileUrl
   - createdAt

2. `soundeffect`
   - id
   - name
   - fileUrl

3. `sound_preset`
   - id
   - name
   - presetItems JSON [{ soundEffectId, volume, loopMode }]

4. `encounter`
   - id (uuid)
   - campaignId FK
   - name
   - createdAt

5. `encounter_entity`
   - id
   - encounterId FK
   - type: enum('player','enemy','ally')
   - refId (FK -> character / bestiary_enemy) (para stats) // o JSON snapshot
   - initiative (int|null)
   - hpCurrent (int|null)

6. `combat_state` (opcional inicial)
   - id
   - encounterId FK
   - round (int)
   - activeEntityId (ref encounter_entity)
   - status JSON (condiciones / efectos) // posponer detalle.

## Fase 5 – Bestiary, Characters, Spells (P2)
Objetivo: Soporte de entidades ricas import/export.

### Nuevas Entidades
1. `bestiary_enemy`
   - id
   - campaignId FK (o global library flag)
   - name, cr, type, alignment, size, xp, ac, hp, speed, stats(FUE...CAR), senses, languages
   - resistances / immunities / vulnerabilities (JSON arrays)
   - traits / actions / legendaryActions / reactions (JSON array objects)
   - imageUrl, tokenUrl

2. `character`
   - id
   - campaignId FK
   - name, playerName, class, level, background, race, alignment
   - stats, hp, inventory, spells summary (JSON incremental)
   - visibility: enum('master','players') // para fichas ocultas

3. `spell`
   - id
   - campaignId FK (o global)
   - name, school, level, range, duration, ritual (bool), concentration (bool), components (JSON), description
   - damage? area? scaling? (JSON) // simplificar al inicio.

## Fase 6 – Misiones y Dependencias Narrativas (P2)
### Nuevas Entidades
1. `mission`
   - id
   - campaignId FK
   - title
   - description
   - state: enum('unaccepted','accepted','completed')
   - prerequisiteMissionId (nullable)
   - createdAt / updatedAt

2. `mission_log` (opcional si quieres histórico)
   - id
   - missionId FK
   - stateBefore
   - stateAfter
   - timestamp

## Fase 7 – Worldpedia Avanzada y Enlaces (P3)
- `worldpedia_link` (sourceNoteId, targetNoteId, createdAt)
- Indexado de backlinks para navegación inversa.

## Fase 8 – Integraciones y Automatización (P3)
- Tabla `integration_setting` (id, userId, provider (alexa|hue|...), credentials encrypted JSON)
- Tabla `map_light_trigger` (id, mapId, provider, payload JSON, eventType (enter|battle|timeOfDayChange))

## Reglas Transversales
1. Ownership: Todas las entidades con `campaignId` deben validar que el usuario es owner o tiene permisos adecuados.
2. Visibility: Campos `visibility` se aplican sistemáticamente a queries para jugadores.
3. Soft Delete (Futuro P3): Añadir `deletedAt` para evitar pérdida accidental.
4. Indexación mínima recomendada:
   - `campaign_player(campaignId,userId)` unique.
   - `worldpedia_folder(campaignId,parentId)`.
   - `journal_entry(campaignId,date)`.
   - `encounter(campaignId)`.

## Evolución Técnica Sugerida
- Antes de Fase 2: introducir migraciones TypeORM y desactivar `synchronize` en producción.
- Antes de Fase 3: decidir estrategia de almacenamiento binario (filesystem vs object storage) para mapas/imágenes/audio.
- Antes de Fase 4: abstraer capa de media (upload service) para evitar refactors masivos.
- Antes de Fase 5: normalizar validaciones y extraer DTO comunes (NameWithDescriptionDto, PaginatedQueryDto...).

## Métricas de Sanidad por Fase
| Fase | Métrica Clave | Umbral Aceptable |
|------|---------------|------------------|
| MVP  | Flujo campaña completo | >95% éxito en smoke tests |
| 1    | Notas creadas / campaña | >=1 pública y 1 privada |
| 2    | Notas worldpedia enlazadas | >=10% uso de enlaces |
| 3    | Mapas activos / campaña | >=1 con variante |
| 4    | Encuentros ejecutados / sesión | >=1 |
| 5    | Bestiary entries reusadas | >=30% en encuentros |

## Riesgos y Mitigaciones
| Riesgo | Mitigación |
|--------|-----------|
| Crecimiento explosivo de tablas | Introducir migraciones y versionado schema temprano |
| Blobs en SQLite hinchan DB | Postergar multi-resolución y usar URLs externas |
| Fugas de datos máster a jugadores | Implementar systematically filtros `visibility` |
| Complejidad Combat prematura | Iterar: primero iniciativa estática, luego efectos |
| Integraciones externas inestables | Diseñar adaptadores e inyectarlos (Strategy pattern) |

## Checklist Pre-Fase Nueva
- [ ] Migraciones al día.
- [ ] Tests smoke pasan.
- [ ] No endpoints sin guard añadidos.
- [ ] Documentado en CHANGELOG.md (opcional).

---

Este backlog es vivo. Actualizar tras cada Fase completada.
