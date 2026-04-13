# REFACTOR_CHECKLIST - Validación por PR de Refactorización

Checklist obligatorio para cada PR de refactor. Todos los items deben estar en ✅ antes de merge.

---

## ✅ PUERTA TÉCNICA (obligatoria)

- [ ] **Build Frontend sin errores:** `npm --prefix frontend run build` → exit code 0
- [ ] **Typecheck Backend sin errores:** `npm --prefix backend run typecheck` → exit code 0
- [ ] **Tests Backend verdes:** `npm --prefix backend run test` → todos los tests PASS
- [ ] **E2E Backend verde (si hay cambios en controller/service):** `npm --prefix backend run test:e2e` → todos PASS
- [ ] **Sin breaking changes en imports públicos:** archivos en `frontend/src/api/` y `frontend/src/hooks/` mantienen firmas públicas

---

## ✅ PUERTA FUNCIONAL (smoke manual de 5 flujos)

### 1. Flujo Campaña Activa
- [ ] Crear campaña nueva
- [ ] Seleccionar campaña (click en CampaignItem)
- [ ] Recargar app (F5 o Ctrl+R)
- [ ] Validar: la misma campaña sigue siendo activa
- [ ] Esperado: `localStorage['activeCampaignId']` persiste

### 2. Flujo Mapas & Fog
- [ ] Seleccionar campaña
- [ ] Entrar a Mapas (página MapsPage)
- [ ] Editar grid (cambiar cellSize)
- [ ] Editar fog (pintar celdas grises)
- [ ] Guardar
- [ ] Cambiar a otra pestaña/ventana y volver
- [ ] Validar: fog y grid persisten correctamente
- [ ] Esperado: GET `/maps/:id/fog` devuelve cells sin cambios de estructura

### 3. Flujo Combate & Proyección
- [ ] Crear encuentro en CombatPage
- [ ] Agregar 2+ participantes
- [ ] Cambiar turno en ventana principal (click Next Turn)
- [ ] Abrir ventana de proyección (si desktop/Electron disponible)
- [ ] Validar: el turno sincroniza en proyección
- [ ] Volver a ventana principal, cambiar turno otra vez
- [ ] Validar: proyección actualiza
- [ ] Esperado: BroadcastChannel y/o poll sincroniza sin delay > 1s

### 4. Flujo Soundtrack
- [ ] Entrar a SoundtrackPage
- [ ] Reproducir una canción (hace click en play)
- [ ] Validar: audio suena (o simular stream sin audio)
- [ ] Cambiar a otra canción
- [ ] Validar: anterior se pausa, nueva comienza
- [ ] Esperado: GET `/soundtrack/songs/:id/stream` devuelve stream sin errores

### 5. Flujo Worldpedia
- [ ] Entrar a WorldpediaPage
- [ ] Crear carpeta nueva
- [ ] Crear nota dentro de carpeta
- [ ] Editar nota (cambiar contenido)
- [ ] Guardar
- [ ] Mover nota a carpeta distinta
- [ ] Validar: árbol actualiza
- [ ] Exportar worldpedia (si botón disponible)
- [ ] Importar snapshot anterior
- [ ] Validar: árbol y notas recuperadas
- [ ] Esperado: GET `/worldpedia/:campaignId/tree` devuelve estructura sin cambios

---

## ✅ PUERTA DE CONTRATO (cambios de API)

**Solo si el PR modifica endpoints en `backend/src/*/controller.ts` o `backend/src/*/service.ts`:**

- [ ] **Listar endpoints modificados:** (ej. PATCH /campaigns/:id/fog-of-war)
- [ ] **Para CADA endpoint:**
  - [ ] Obtener payload ANTES del cambio (curl o Postman)
  - [ ] Obtener payload DESPUÉS del cambio
  - [ ] Comparación: 
    - ✅ Campos obligatorios NO cambiaron de tipo
    - ✅ Si agregaste campo, es nullable/optional
    - ✅ Si removiste campo, fue realmente private (no en docs/REFACTOR_CONTRACTS.md)
  - [ ] Documentar en PR: "Cambios de contrato (si hay)" o "Sin cambios de contrato"
- [ ] **Snapshot de respuesta:** adjunta request/response en comentario del PR para auditoria

---

## ✅ PUERTA DE COMPATIBILIDAD (si tocas componentes frontend)

**Solo si el PR modifica componentes en `frontend/src/components/` o `frontend/src/pages/`:**

- [ ] **Props públicas NO cambiaron:** si otro componente importa/usa el componente modificado, sus props siguen validando
- [ ] **Hooks públicos NO cambiaron firma:** si otros componentes llaman el hook, param y return siguen iguales (mínimamente)
- [ ] **Si SI cambian:** documentar migración en PR message y actualizar consumidores en el mismo commit

---

## ✅ VALIDACIÓN DE CAMBIOS DE TAMAÑO/COMPLEJIDAD

**Aplica si el PR reduce size o complejidad (lo ideal):**

- [ ] **Archivo original:** líneas de código
- [ ] **Archivo refactorizado:** líneas de código
- [ ] **Reducción esperada:** X líneas
- [ ] **Métodos/hooks nuevos:** cantidad y resumen
- [ ] **Métodos/hooks removidos:** cantidad (deberían ser 0 de no existentes)

---

## ✅ DOCUMENTACIÓN ACTUALIZADA

- [ ] Si creaste/modificaste archivo público: actualizar comentarios JSDoc
- [ ] Si cambiaste flujo interno: actualizar docs/DEV_GUIDE.md si aplica
- [ ] Si tocaste API: cambios reflejados en docs/API_ENDPOINTS.md (si son públicos)
- [ ] Ejecutar: `npm run docs:generate` al finalizar

---

## 🎯 Regla de oro

**Si algún item de las 3 puertas falla:**
- ❌ NO mergear
- ❌ NO hacer commit hasta que esté en verde
- ❌ Documentar en issue por qué falló y cómo arreglarlo

---

## Plantilla para PR message

```markdown
## Cambios
- [x] Refactor de [componente/módulo]
- [x] Reducción de X líneas

## Validación
- [x] Puerta técnica: ✅ build + typecheck + tests
- [x] Puerta funcional: ✅ smoke en [flujos probados]
- [x] Puerta contrato: ✅ [endpoints afectados]

## Cambios de tamaño
- Antes: X líneas
- Después: Y líneas
- Reducción: Z%

## Documentación
- [x] JSDoc actualizado
- [x] docs:generate ejecutado
```

---

**Última actualización:** 2026-04-13 (Sprint 1)  
**Versión:** 1.0  
**Estado:** ACTIVO (aplicable desde ahora)
