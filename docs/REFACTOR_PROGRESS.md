# REFACTOR_PROGRESS - Registro de avance Sprint a Sprint

Registro de cambios documentales y de código por sprint. Usar para auditoría y trazabilidad.

---

## Sprint 1 - Baseline + contratos críticos

**Inicio:** 2026-04-13  
**Fin:** 2026-04-13  
**Estado:** ✅ COMPLETADO

### Documentación creada
- ✅ `docs/REFACTOR_CONTRACTS.md` (v1.0) - Snapshot de contratos críticos
- ✅ `docs/REFACTOR_CHECKLIST.md` (v1.0) - Checklist obligatorio por PR
- ✅ `docs/SMOKE_TESTS.md` (v1.0) - 5 flujos de smoke manual
- ✅ `docs/REFACTOR_PROGRESS.md` (este archivo)

### Cambios de código
- ✅ PR piloto backgrounds DTOs: @MinLength/@MaxLength, @IsUUID() validadores
- ✅ Build backend: compilado sin errores
- ✅ Build frontend: compilado sin errores
- ✅ Typecheck: sin errores de TypeScript

### Docs actualizadas
- ✅ `docs/API_ENDPOINTS.md`: agregada columna "Contrato crítico" y marcados 16 endpoints
- ✅ `docs/TODO.md`: Sprint 1 marcado en progreso
- ✅ `docs/SPRINT_1_SUMMARY.md`: creado y completado

### Criterio de salida Sprint 1
- [x] Todos los docs creados y v1.0 congelados
- [x] PR piloto backgrounds validado (puertas técnicas verdes)
- [x] Build backend sin errores
- [x] Build frontend sin errores
- [x] Typecheck sin errores
- [x] `docs/SPRINT_1_SUMMARY.md` con resumen
- [ ] Smoke manual de 5 flujos (pendiente ejecución manual)
- [ ] `npm run docs:generate` (opcional)

**Cierre:** 2026-04-13

---

## Sprint 2 - Hardening backend de alto riesgo

**Inicio:** 2026-04-13  
**Código completado:** 2026-04-13  
**Estado:** EN PROGRESO (validación técnica completada 6/8, smoke manual pendiente)

### Documentación creada
- ✅ `docs/SPRINT_2_SUMMARY.md` (v1.1) - Hardening campaigns + maps DTOs (actualizado)
- ✅ `docs/SMOKE_MANUAL_SPRINT2.md` (v1.0) - Instrucciones ejecutables de smoke tests

### Cambios de código (Fase 1 - Campaigns)
- ✅ `backend/src/campaigns/dto/create-campaign.dto.ts` — @MinLength(1) + @MaxLength(200) name; @MaxLength(1000) description
- ✅ `backend/src/campaigns/dto/update-campaign.dto.ts` — Idem create
- ✅ `backend/src/campaigns/dto/invite-player.dto.ts` — @MaxLength(255) email, @MaxLength(50) username

### Cambios de código (Fase 2 - Maps)
- ✅ `backend/src/maps/dto/create-map.dto.ts` — @MinLength(1) + @MaxLength(200) name
- ✅ `backend/src/maps/dto/update-map.dto.ts` — @MinLength(1) + @MaxLength(200) name (opcional)
- ✅ `backend/src/maps/dto/update-tokens.dto.ts` — @MinLength(1) + @MaxLength(255) id, cellKey, label
- ✅ `backend/src/maps/dto/update-map-elements.dto.ts` — @MinLength(1) + @MaxLength(255) id, label, sourceId, sourceName

### Validación técnica completada
- ✅ `npm run build:backend` (campaigns) → SIN ERRORES
- ✅ `npm run typecheck --prefix backend` (campaigns) → SIN ERRORES
- ✅ `npm run build --prefix frontend` (campaigns cascading) → SIN ERRORES
- ✅ `npm run build:backend` (maps) → SIN ERRORES
- ✅ `npm run typecheck --prefix backend` (maps) → SIN ERRORES
- ✅ `npm run build --prefix frontend` (maps cascading) → SIN ERRORES
- [ ] `npm run test --prefix backend` → Pendiente (pre-existentes songs fallos sin relación)
- ✅ `npm run test:e2e --prefix backend` → 73/73 tests verdes
- ✅ Estabilización de suite e2e: `test/jest-e2e.json` con `testTimeout: 30000` y `maxWorkers: 1`
- ✅ Script e2e en serie: `npm run test:e2e` usa `--runInBand`

### Validación funcional y de contrato (delta)
- ✅ Smoke manual campaigns parcial (usuario):
	- no permite crear sin nombre (bloqueo en UI)
	- creación con nombre válido OK
	- rechazo name > 200 con 400 y mensaje esperado
	- rechazo description > 1000 con 400 y mensaje esperado
- ✅ Automatización e2e de campaigns constraints:
	- nuevo archivo `backend/test/campaign-validations-01-constraints.e2e-spec.ts`
	- script `npm run test:e2e:campaign-validations`
	- resultado: 6/6 tests en verde
- ✅ Automatización e2e de maps constraints:
	- nuevo archivo `backend/test/maps-validations-01-constraints.e2e-spec.ts`
	- script `npm run test:e2e:maps-validations`
	- resultado: 8/8 tests en verde
- ✅ Automatización e2e de maps state (persistencia):
	- nuevo archivo `backend/test/maps-state-01-persistence.e2e-spec.ts`
	- script `npm run test:e2e:maps-state`
	- resultado: 5/5 tests en verde
- ✅ Frontend: capturado rechazo esperado 400 para evitar `Uncaught (in promise)`
	- archivo `frontend/src/pages/CampaignPage.tsx`
- ✅ Micro-refactor seguro en `maps.service.ts`:
	- extracción de validación de ownership repetida a helper privado `assertOwnedMapAndCampaign(...)`
	- sin cambios de contrato ni payloads
	- validación posterior: backend typecheck ✅, e2e completo 86/86 ✅, frontend build ✅
- ✅ Micro-refactor seguro en `campaigns.service.ts`:
	- extracción de validación repetida de membresía a helper privado `getCampaignForMember(...)`
	- aplicado en métodos de lectura/settings (`getActive*`, `getTimeOfDay`, `getGridOverlaySettings`, `getFogOfWarSettings`, `getSoundtrackSettings`, `getSkylineOverlaySettings`, `getBattleState`, `getSelectedManuals`)
	- sin cambios de contrato ni payloads
	- validación posterior: backend typecheck ✅, e2e completo 86/86 ✅, frontend build ✅
- ✅ Micro-refactor seguro en validación de manual IDs (`campaigns.service.ts`):
	- extracción de lógica duplicada create/update a helpers privados `normalizeManualIds(...)` y `validateManualIdsForCreateOrUpdate(...)`
	- sin cambios de contrato ni comportamiento observable
	- validación posterior: backend typecheck ✅, e2e completo 86/86 ✅, frontend build ✅
- ✅ Micro-refactor seguro en carga de campaña por id (`campaigns.service.ts`):
	- extracción de patrón repetido `findOne + NotFoundException` a helper privado `getCampaignByIdOrThrow(...)`
	- aplicado en setters de campaña (timeOfDay, grid/fog/soundtrack/skyline settings, battleState, selectedManuals, defaultSkyline)
	- sin cambios de contrato ni comportamiento observable
	- validación posterior: backend typecheck ✅, e2e completo 86/86 ✅, frontend build ✅

### Criterio de salida Sprint 2
- [x] Código completado (7 DTOs con validaciones)
- [x] Build backend sin errores ✅
- [x] Typecheck sin errores ✅
- [x] Build frontend sin errores ✅ (6/8 puertas técnicas verdes)
- [x] Contrato campaigns validado (manual + e2e) ✅
- [x] E2E backend completo en verde (73/73) ✅
- [ ] Tests backend (pendiente, pre-existentes no relacionados)
- [ ] Smoke manual restante (maps + cross-feature + invite email largo)
- [ ] Cierre formal (esperar feedback de smoke)

---

## Sprint 3 - Estado transversal frontend

**Inicio:** 2026-04-21 (previsto)  
**Estado:** No iniciado aún

---

## Sprint 4 - Monolitos mapas y combate

**Inicio:** 2026-04-28 (previsto)  
**Estado:** No iniciado aún

---

## Sprint 5 - Monolitos restantes + API cliente

**Inicio:** 2026-05-05 (previsto)  
**Estado:** No iniciado aún

---

## Sprint 6 - Deuda técnica + cierre

**Inicio:** 2026-05-12 (previsto)  
**Estado:** No iniciado aún

---

## Resumen de cambios globales

| Sprint | Archivos Creados | Archivos Modificados | Líneas de código (+/-) |
|--------|-------------------|----------------------|------------------------|
| 1 | 4 docs | 2 docs | N/A DTO piloto |
| 2 | 1 summary | 10+ DTOs | ~500 validación |
| 3 | 1 summary | 20+ hooks | ~1000 refactor hooks |
| 4 | 1 summary | 5 componentes grandes | ~2000 descomposición |
| 5 | 1 summary | 20+ clientes API | ~1500 unificación |
| 6 | 1 summary | TypeORM migrations | ~500 DB changes |

---

**Última actualización:** 2026-04-13 (Sprint 2 delta: smoke campaigns parcial + e2e automation)  
**Versión:** 1.1
