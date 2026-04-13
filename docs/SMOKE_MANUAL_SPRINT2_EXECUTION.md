# Smoke Manual Sprint 2 - Ejecución en Vivo (2026-04-13)

**Hora inicio:** NOW  
**Responsable:** Usuario  
**Duración estimada:** 25 minutos

---

## ⚙️ Setup: Antes de comenzar

### Paso 1: Verifica que frontend está compilado
```bash
# Terminal 1 - Frontend (ya debería estar compilado)
npm --prefix frontend run build
# Resultado esperado: ✅ Compilado exitosamente (sin errores)
```

### Paso 2: Inicia backend dev server
```bash
# Terminal 2 - Backend
cd backend
npm run start:dev
# Espera: [Nest] 12345 - 04/13/2026, 13:59:56 PM     LOG [NestFactory] Application successfully started
```

### Paso 3: Inicia frontend dev server
```bash
# Terminal 3 - Frontend
cd frontend
npm run dev
# Resultado: ✅ Local: http://localhost:5173/
```

### Paso 4: Abre app en navegador
- URL: `http://localhost:5173`
- Abre DevTools: `F12` → Tab `Console`
- **Importante:** Monitorear console mientras ejecutas tests (buscar errores rojos)

---

---

## 🧪 TEST 1: Campaigns - Crear con validaciones (⏱️ 3 min)

**Flujo:** Campaigns → Nueva Campaña → Validar name

### Paso 1.1: Intenta crear campaña con name VACÍO
1. Click en **"+ Nueva Campaña"** (botón verde)
2. En campo "Nombre", deja **vacío** (no escribas nada)
3. Click en **"Crear"**
4. **Observa result:**
   - ✅ Esperado: Aparece error en rojo: `"Campaign name must not be empty"`
   - ❌ Si no aparece: Nota en console si hay error

**Documenta:** ✅ o ❌

---

### Paso 1.2: Crea campaña con name VÁLIDO
1. Click en **"+ Nueva Campaña"** nuevamente
2. En campo "Nombre", escribe: `"Test Campaign Sprint 2"`
3. Click en **"Crear"**
4. **Observa result:**
   - ✅ Esperado: Campaña aparece en lista
   - ❌ Si falla: Nota en console

**Documenta:** ✅ o ❌  
**Guarda campaignId** para tests siguientes (ej: `camp-uuid-123`)

---

### Paso 1.3: Intenta actualizar name a STRING > 200 CHARS
1. Click en campaña recién creada
2. Botón **"Editar"** (o pencil icon)
3. En campo "Nombre", **copia-pega** string de 250 caracteres:
   ```
   aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaaa
   ```
4. Click en **"Guardar"**
5. **Observa result:**
   - ✅ Esperado: Error: `"Campaign name must not exceed 200 characters"`
   - ❌ Si no aparece: Console check

**Documenta:** ✅ o ❌

---

### Paso 1.4: Intenta actualizar description > 1000 CHARS
1. En mismo dialog de edición
2. En campo "Descripción", **copia-pega** string de 1050 caracteres (copia 1000+ chars)
3. Click en **"Guardar"**
4. **Observa result:**
   - ✅ Esperado: Error: `"Campaign description must not exceed 1000 characters"`
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

## 🧪 TEST 2: Campaigns - Invitar jugador (⏱️ 2 min)

**Flujo:** Campaigns → Invitar → Validar email/username

### Paso 2.1: Intenta invitar con email > 255 CHARS
1. Desde campaña activa, botón **"Invitar Jugador"** (o similar)
2. En campo "Email", **copia-pega** email falso de 300+ caracteres:
   ```
   aaaaaaaaaa.bbbbbbbbbb.cccccccccc.dddddddddd.eeeeeeeeee.ffffffffff.gggggggggg.hhhhhhhhhh.iiiiiiiiii.jjjjjjjjjj.kkkkkkkkkk@test.com
   ```
3. Click en **"Enviar Invitación"**
4. **Observa result:**
   - ✅ Esperado: Error: `"email must not exceed 255 characters"`
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

### Paso 2.2: Intenta invitar con username > 50 CHARS
1. Botón **"Invitar Jugador"** nuevamente
2. En campo "Username" (si existe), escribe 60 chars:
   ```
   aaaaaaaaaaabbbbbbbbbbbccccccccccddddddddddeeeeeeeeeefffffffff
   ```
3. Si hay toggle "Email" / "Username", selecciona **Username**
4. Click en **"Enviar Invitación"**
5. **Observa result:**
   - ✅ Esperado: Error (si username tiene validación)
   - ⚠️  Nota: Si no hay validación de username en UI, puede ser OK (validación server-side)

**Documenta:** ✅ o ⚠️

---

### Paso 2.3: Invita a jugador VÁLIDO
1. Botón **"Invitar Jugador"**
2. En campo "Email", escribe: `testplayer@example.com`
3. Click en **"Enviar Invitación"**
4. **Observa result:**
   - ✅ Esperado: Invitación enviada; confirmación en UI (mensaje "Invitación enviada" o similar)
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

## 🧪 TEST 3: Maps - Crear con validaciones (⏱️ 3 min)

**Flujo:** Mapas → Nuevo Mapa → Validar name

### Paso 3.1: Intenta crear mapa con name VACÍO
1. Desde campaña, sección **"Mapas"**
2. Click en **"+ Nuevo Mapa"**
3. En campo "Nombre", deja **vacío**
4. Click en **"Crear"**
5. **Observa result:**
   - ✅ Esperado: Error: `"Map name must not be empty"`
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

### Paso 3.2: Crea mapa con name VÁLIDO
1. Click en **"+ Nuevo Mapa"** nuevamente
2. En campo "Nombre", escribe: `"Tavern Test"`
3. Sube una **imagen** (o usa por defecto si existe)
4. Click en **"Crear"**
5. **Observa result:**
   - ✅ Esperado: Mapa aparece en lista
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌  
**Guarda mapId** (ej: `map-uuid-456`)

---

### Paso 3.3: Intenta actualizar name > 200 CHARS
1. Click en mapa recién creado
2. Botón **"Editar Mapa"** (en header o menu)
3. En campo "Nombre", **copia-pega** 250 chars (mismo que antes)
4. Click en **"Guardar"**
5. **Observa result:**
   - ✅ Esperado: Error: `"Map name must not exceed 200 characters"`
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

## 🧪 TEST 4: Maps - Tokens y elementos (⏱️ 5 min)

**Flujo:** Mapa → Tokens/Elementos → Validar id/label

### Paso 4.1: Crea token VÁLIDO
1. Desde mapa, sección **"Tokens"** (o "Encuentros" / battle grid)
2. Click en **"+ Nuevo Token"**
3. Rellena:
   - ID: `ally-1`
   - Cell/Posición: `1:2` (o grid position)
   - Tipo: `Ally` (dropdown)
4. Click en **"Crear"**
5. **Observa result:**
   - ✅ Esperado: Token aparece en grid/mapa
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

### Paso 4.2: Intenta crear token con ID > 255 CHARS
1. Click en **"+ Nuevo Token"** nuevamente
2. En campo "ID", **copia-pega** 300 chars:
   ```
   aaaaaaaaaa...bbbbbbbbbb...(300 chars total)
   ```
3. Click en **"Crear"**
4. **Observa result:**
   - ✅ Esperado: Error: `"Token id must not exceed 255 characters"`
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

### Paso 4.3: Crea elemento (luz/pared) VÁLIDO
1. Desde mapa, sección **"Elementos"** (lights, walls, doors)
2. Click en **"+ Agregar Luz"** (o elemento)
3. Rellena:
   - ID: `light-1`
   - Posición: Centro del mapa (click o coordenadas)
   - Radio: `50`
   - Color: Blanco (o default)
4. Click en **"Crear"**
5. **Observa result:**
   - ✅ Esperado: Luz aparece en mapa
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

### Paso 4.4: Intenta crear elemento con label > 255 CHARS
1. Click en **"+ Agregar Luz"** nuevamente
2. En campo "Label", **copia-pega** 300 chars
3. Click en **"Crear"**
4. **Observa result:**
   - ✅ Esperado: Error: `"Label must not exceed 255 characters"`
   - ❌ Si falla: Console check

**Documenta:** ✅ o ❌

---

## 🧪 TEST 5: Maps - Fog of War persistence (⏱️ 5 min)

**Flujo:** Mapa → Proyección → Dibuja fog → Refresca

### Paso 5.1: Dibuja Fog de forma normal
1. Click en **"Proyectar Mapa"** o **"Vista Proyección"**
2. Herramienta Fog (pincel o similar)
3. **Dibuja** un área de fog en el mapa (cubrir ~20% del mapa)
4. **Observa result:**
   - ✅ Esperado: Fog aparece en tiempo real, área tapada con patrón
   - ❌ Si no dibuja: Console check

**Documenta:** ✅ o ❌

---

### Paso 5.2: Refresca página (F5) - Fog DEBE persistir
1. Presiona **F5** (refresh de página)
2. Espera a que cargue la app
3. Vuelve a **"Vista Proyección"** del mismo mapa
4. **Observa result:**
   - ✅ Esperado: Fog está EN EL MISMO LUGAR (persiste)
   - ❌ Si desapareció: Bug de persistencia

**Documenta:** ✅ o ❌

---

### Paso 5.3: Cambia a otra campaña y vuelve
1. Click en **"Campañas"** (sidebar)
2. Selecciona **otra campaña** (o crea una nueva rápido)
3. Luego vuelve a **campaña original**
4. Abre el **mismo mapa**
5. Proyecta nuevamente
6. **Observa result:**
   - ✅ Esperado: Fog del mapa anterior PERSISTE igual
   - ❌ Si cambió: Bug de caché

**Documenta:** ✅ o ❌

---

## 🧪 TEST 6: Cross-feature integration (⏱️ 5 min)

**Flujo:** Campaña → Múltiples mapas → Combate → Proyección → Síncron

### Paso 6.1: Crea 2 mapas en campaña
1. Desde campaña anterior, **Mapas**
2. Crea **Mapa 2** (nombre: "Forest")
3. Cambia entre Mapa 1 y Mapa 2 (click en cada uno)
4. **Observa result:**
   - ✅ Esperado: Ambos mapas cargan sin errores
   - ❌ Si falla uno: Console check

**Documenta:** ✅ o ❌

---

### Paso 6.2: Crea 3 tokens (allies) en Mapa 1
1. Vuelve a **Mapa 1** ("Tavern")
2. Crea 3 tokens:
   - Token 1: `ally-1` en posición 1:1
   - Token 2: `ally-2` en posición 2:2
   - Token 3: `ally-3` en posición 3:3
3. **Observa result:**
   - ✅ Esperado: 3 tokens visibles en grid
   - ❌ Si falta: Console check

**Documenta:** ✅ o ❌

---

### Paso 6.3: Abre combate (battle mode)
1. Click en **"Iniciar Combate"** (o "Encuentro" / "Battle")
2. Sistema debe cargar tokens de Mapa 1
3. **Observa result:**
   - ✅ Esperado: 3 tokens (allies) visibles en iniciativa/grid
   - ❌ Si faltan: Cross-feature bug

**Documenta:** ✅ o ❌

---

### Paso 6.4: Proyecta mapa en pantalla secondary (si puedes)
1. Click en **"Proyectar" / "Mostrar Proyección"**
2. Abre segunda tab/ventana con proyección
3. Desde proyección, dibuja **más fog**
4. **Observa result:**
   - ✅ Esperado: Fog actual sincroniza entre main tab y projection
   - ⚠️  Si no hay proyección: Salta este substep

**Documenta:** ✅ o ⚠️

---

### Paso 6.5: Revisa console (F12) - SIN ERRORES ROJOS
1. Presiona **F12** → Tab **Console**
2. Busca **errores rojos** (🔴 icons)
3. **Observa result:**
   - ✅ Esperado: Console limpia (solo warnings amarillos OK)
   - ❌ Si hay errores rojos: Nota el mensaje

**Documenta:** ✅ o ❌ (+ error si existe)

---

---

## ✅ RESULTADO FINAL

### Checklist de resultados

| Test | Caso | Resultado |
|------|------|-----------|
| **1** | Name vacío (rechaza) | ✅ ❌ |
| **1** | Name válido (crea) | ✅ ❌ |
| **1** | Name > 200 chars (rechaza) | ✅ ❌ |
| **1** | Description > 1000 chars (rechaza) | ✅ ❌ |
| **2** | Email > 255 chars (rechaza) | ✅ ❌ |
| **2** | Username > 50 chars (rechaza) | ✅ ❌ |
| **2** | Invitación válida | ✅ ❌ |
| **3** | Map name vacío (rechaza) | ✅ ❌ |
| **3** | Map creado válido | ✅ ❌ |
| **3** | Map name > 200 chars (rechaza) | ✅ ❌ |
| **4** | Token válido | ✅ ❌ |
| **4** | Token ID > 255 chars (rechaza) | ✅ ❌ |
| **4** | Elemento válido | ✅ ❌ |
| **4** | Elemento label > 255 chars (rechaza) | ✅ ❌ |
| **5** | Fog dibuja en tiempo real | ✅ ❌ |
| **5** | Fog persiste tras F5 | ✅ ❌ |
| **5** | Fog persiste entre campañas | ✅ ❌ |
| **6** | 2+ mapas en campaña | ✅ ❌ |
| **6** | Múltiples tokens en combate | ✅ ❌ |
| **6** | Proyección sincronizado (opcional) | ✅ ❌ ⚠️ |
| **6** | Console sin errores rojos | ✅ ❌ |

---

### ✅ SMOKE OK si:
- ✅ 18+ casos pasan (mínimo 16/20)
- ✅ Console sin errores rojos
- ✅ Validaciones rechazan edge cases correctamente
- ✅ Operaciones normales no rompen

### ❌ SMOKE BLOCKER si:
- ❌ < 16 casos fallan
- ❌ Errores rojos en consola (Network 500, crashes)
- ❌ Validaciones no funcionan

---

## 📋 Próximo paso

Cuando termines todos los tests:
1. Cuenta cuántos ✅ y ❌ obtuviste
2. Documenta en respuesta
3. Si ✅ >= 16: **Sprint 2 CIERRA FORMALMENTE** ✅
4. Si ❌ > 4: Abre issue en BACKLOG_SCHEMA.md con detalles

**Tiempo total:** ~25 minutos  
**Hora esperada fin:** NOW + 25 min

¡Adelante! 🚀
