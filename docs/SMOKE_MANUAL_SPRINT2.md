# Smoke Manual Tests - Sprint 2 (Campaigns + Maps DTOs)

**Objetivo:** Validar que cambios en DTO validations (campaigns + maps) no rompen flujos de usuario.

**Tiempo estimado:** 25 minutos total

**Prerrequisito:** App ejecutándose localmente (backend + frontend)

---

## Test 1: Campaigns - Crear campaña con validaciones (3 min)

### Pasos:
1. Abre **Campaigns** sección en la UI
2. Click en **"+ Nueva Campaña"**
3. Intenta crear campaña con nombre vacío ("")
   - **Esperado:** Sistema rechaza con error de validación ("Campaign name must not be empty")
4. Crea campaña con nombre válido (ej: "Test Campaign")
   - **Esperado:** ✅ Campaña creada exitosamente
5. Intenta actualizar nombre a string > 200 caracteres (copia-pega 250 chars)
   - **Esperado:** Sistema rechaza con error ("Campaign name must not exceed 200 characters")
6. Intenta actualizar descripción a > 1000 caracteres
   - **Esperado:** Sistema rechaza con error ("Campaign description must not exceed 1000 characters")

### Checklist:
- [ ] Rechazo de nombre vacío
- [ ] Creación correcta con nombre válido
- [ ] Rechazo de nombre > 200 chars
- [ ] Rechazo de descripción > 1000 chars

---

## Test 2: Campaigns - Invitar jugador con validaciones (2 min)

### Pasos:
1. Desde la campaña creada en Test 1, abre **Invitar Jugador**
2. Intenta invitar con email > 255 caracteres (fake: "x" * 250 + "@test.com")
   - **Esperado:** Sistema rechaza con error de validación
3. Intenta invitar con username > 50 caracteres
   - **Esperado:** Sistema rechaza con error
4. Invita a un jugador válido (ej: "testplayer@example.com")
   - **Esperado:** ✅ Invitación enviada exitosamente

### Checklist:
- [ ] Rechazo de email > 255 chars
- [ ] Rechazo de username > 50 chars
- [ ] Invitación exitosa con datos válidos

---

## Test 3: Maps - Crear mapa con validaciones (3 min)

### Pasos:
1. Desde campaña activa, abre **Mapas**
2. Click **"+ Nuevo Mapa"**
3. Intenta crear mapa con nombre vacío ("")
   - **Esperado:** Sistema rechaza ("Map name must not be empty")
4. Crea mapa con nombre válido (ej: "Tavern")
   - **Esperado:** ✅ Mapa creado
5. En edición de mapa, intenta cambiar nombre a > 200 caracteres
   - **Esperado:** Sistema rechaza

### Checklist:
- [ ] Rechazo de nombre vacío
- [ ] Creación exitosa
- [ ] Rechazo de nombre > 200 chars

---

## Test 4: Maps - Tokens y elementos con validaciones (5 min)

### Pasos:
1. Desde mapa activo, abre **Tokens** sección
2. Click **"+ Nuovo Token"** y crea token con:
   - ID válido (ej: "ally-1")
   - CellKey válido (ej: "1:2")
   - Type: "ally"
   - **Esperado:** ✅ Token creado
3. Intenta crear token con ID > 255 caracteres
   - **Esperado:** Sistema rechaza ("Token id must not exceed 255 characters")
4. Abre **Elementos del Mapa** (paredes, puertas, luces)
5. Crea elemento "Light" con:
   - ID válido (ej: "light-1")
   - Posición, radio, color
   - **Esperado:** ✅ Elemento creado
6. Intenta crear elemento con label > 255 caracteres
   - **Esperado:** Sistema rechaza

### Checklist:
- [ ] Token creado exitosamente
- [ ] Rechazo de token ID > 255 chars
- [ ] Elemento creado exitosamente
- [ ] Rechazo de label > 255 chars

---

## Test 5: Maps - Fog of War persistence (5 min)

### Pasos:
1. Desde mapa, abre **Fog of War** (proyección)
2. Revela/oculta areas normalmente (dibuja fog)
   - **Esperado:** ✅ Fog se actualiza en tiempo real
3. Refrescar página (F5)
   - **Esperado:** ✅ Fog persiste igual que antes
4. Cambiar a otra campaña y volver
   - **Esperado:** ✅ Fog de mapa mantiene estado anterior

### Checklist:
- [ ] Fog updates en tiempo real
- [ ] Fog persiste tras F5
- [ ] Fog persiste al cambiar campaña

---

## Test 6: Cross-feature integration (5 min)

### Pasos:
1. Crea nueva campaña
2. Crea 2 mapas en esa campaña
3. Opens Map 1, agrega 3 tokens (allies)
4. Abre batalla (Combat)
   - **Esperado:** ✅ Tokens visibles en combate
5. Actualiza nombre del mapa a nombre > 200 chars
   - **Esperado:** ✅ Rechazado; nombre anterior persiste
6. Proyecta mapa en pantalla secundaria (Projection)
   - **Esperado:** ✅ Fog, tokens, elementos síncron correctamente

### Checklist:
- [ ] Múltiples mapas funcionales
- [ ] Tokens visibles en combate
- [ ] Validaciones no rompen persistencia
- [ ] Proyección sincronizada

---

## ✅ Criterio de éxito

**Sprint 2 Smoke OK si:**
- ✅ Todos los rechasos de validación funcionan (6 casos edge)
- ✅ Operaciones normales no tienen regresiones
- ✅ Persistencia de datos (fog, token, mapa) intacta
- ✅ Sincronización en proyección funcional
- ✅ Sin errores en consola del navegador (F12)

**Logs a revisar (F12 Console):**
- Error messages de validación deben ser claros (no "undefined" o crashes)
- No debe haber "404" o "500" en red (Network tab)

---

## 📋 Resultado final

Si todos los tests pasan:
- [ ] Marcar como **✅ SMOKE MANUAL OK**
- [ ] Documentar cualquier bug encontrado en ISSUES.md
- [ ] Proceder a cierre de Sprint 2

Si algún test falla:
- [ ] Documentar pasos para reproducir
- [ ] Marcar como **❌ BLOCKER**
- [ ] Pausar Sprint 2 hasta investigar
