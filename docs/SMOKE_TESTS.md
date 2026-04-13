# SMOKE_TESTS - Pruebas manuales de flujos críticos

Pruebas manuales que se ejecutan DESPUÉS de cada sprint (y PR piloto) para validar que la app sigue funcionando sin regresiones en dominios clave.

---

## 🎯 Flujo 1: Campaña Activa (Base de todo)

**Duración:** ~3 minutos  
**Objetivo:** Validar que el estado de campaña persiste y es accesible.

### Pasos
1. Ir a Home (o recargar si ya estás logged in)
2. Crear campaña nueva:
   - Click en "Nueva Campaña" / "+ New Campaign"
   - Ingresar nombre (ej. "Test Sprint 1")
   - Click "Crear"
3. Validar: Campaña aparece en listado
4. Seleccionar campaña:
   - Click en tarjeta de campaña
   - Validar: interfaz cambia a la campaña (MainLayout muestra nombre activo)
5. Recargar app:
   - Presionar F5 o Ctrl+R
   - Esperar carga completa
6. Validar después de recargar:
   - ¿Sigue siendo la misma campaña activa?
   - ¿localStorage['activeCampaignId'] contiene el ID?
   - ¿Botón de "Campaña activa" en sidebar muestra el nombre correcto?

### ✅ Esperado
- Campaña persiste en localStorage
- UI refleja persistencia
- No hay errores en console (F12)

### ❌ Falla si
- Después de recargar, sin campaña activa
- Campaña desaparece del listado
- Error de red al cargar datos

---

## 🎯 Flujo 2: Mapas & Fog (Complejidad sincronización)

**Duración:** ~5 minutos  
**Objetivo:** Validar que fog y grid son editables y persisten en múltiples vistas.

### Pasos
1. Con campaña activa, ir a Mapas (MapsPage)
2. Crear mapa nuevo o seleccionar uno existente:
   - Click "Crear Mapa"
   - Ingresar nombre y dimensiones
   - Subir imagen (o dejar vacío)
   - Click "Crear"
3. Editar grid:
   - En vistas de mapa, buscar control de "Grid Size" o "Cell Size"
   - Cambiar valor (ej. de 50 a 75 píxeles)
   - Validar: grid visual se redibuja
4. Editar fog (si interfaz lo permite):
   - Click herramienta "Fog" o "Grid Fog"
   - Pintar 3-5 celdas grises (fog)
   - Click "Guardar"
5. Cambiar a otra pestaña/sección y volver:
   - Click en otra página (Combat o Worldpedia)
   - Volver a Mapas
6. Validar después de volver:
   - ¿Grid size sigue siendo 75?
   - ¿Fog pintadas siguen visibles?
   - ¿Sin errores en console?

### ✅ Esperado
- Grid y fog persisten
- Visual se actualiza sin lag
- API callbacks sin errores

### ❌ Falla si
- Grid se resetea
- Fog se limpia
- Error "Cannot read property fog of undefined"

---

## 🎯 Flujo 3: Combate & Proyección (Sincronización entre ventanas)

**Duración:** ~5 minutos  
**Objetivo:** Validar que cambios de turno / encuentro sincronizan entre ventanas.

### Pasos
1. Con campaña activa, ir a Combate (CombatPage)
2. Crear encuentro:
   - Click "Nuevo Encuentro" / "+ New Encounter"
   - Agregar 2 aliados y 3 enemigos (o copy from bestiary)
   - Click "Crear"
3. Iniciar combate:
   - Click "Iniciar Encuentro" / "Start Combat"
   - Validar: iniciativa ordenada, UI muestra ronda 1, turno 1
4. Cambiar turno:
   - Click "Siguiente Turno" / "Next Turn"
   - Validar: indicador de turno avanza (turno 2)
5. Proyección (si Electron/desktop disponible):
   - Abrir ventana de proyección (ej. desde SettingsSection o menu)
   - Validar: ventana muestra ronda y turno actual
6. De vuelta en ventana principal, cambiar turno nuevamente:
   - Click "Next Turn" otra vez
   - Esperar ~1-2 segundos
7. Validar en proyección sin refrescar manualmente:
   - ¿Turno en proyección cambió automáticamente?
   - ¿Sin lag > 2 segundos?

### ✅ Esperado
- Turno sincroniza entre ventanas sin recargar
- BroadcastChannel o polling funciona
- Ambas ventanas ven el mismo estado

### ❌ Falla si
- Proyección muestra turno antiguo
- Console log "BroadcastChannel not available"
- Error de API al cambiar turno

---

## 🎯 Flujo 4: Soundtrack (streaming de audio)

**Duración:** ~3 minutos  
**Objetivo:** Validar que canciones se reproducen y controles funcionan.

### Pasos
1. Con campaña activa, ir a Soundtrack (SoundtrackPage)
2. Crear playlist nueva (si no existe):
   - Click "Nueva Playlist" / "+ New Playlist"
   - Ingresar nombre
   - Agregar 2-3 canciones (buscar en librería)
   - Click "Crear"
3. Reproducir canción:
   - Click sobre canción o ícono play
   - Validar: player muestra "Now Playing"
   - Validar: barra de progreso se mueve (o simular sin audio)
4. Cambiar canción:
   - Click otra canción
   - Validar: canción anterior se pausa
   - Validar: nueva canción comienza
5. Controles:
   - Cambiar volumen (slider)
   - Validar: slider se mueve
   - Click pause/play
   - Validar: reproductor responde

### ✅ Esperado
- Canciones reproducen sin error
- Controles responden inmediatamente
- GET `/soundtrack/songs/:id/stream` devuelve 200 OK

### ❌ Falla si
- "Failed to load audio"
- Pause/play no responden
- El stream nunca inicia (timeout)

---

## 🎯 Flujo 5: Worldpedia (árbol jerárquico + export/import)

**Duración:** ~5 minutos  
**Objetivo:** Validar que notas y carpetas se pueden crear/editar/mover/exportar.

### Pasos
1. Con campaña activa, ir a Worldpedia (WorldpediaPage)
2. Crear carpeta:
   - Click "Nueva Carpeta" / "+ Folder"
   - Ingresar nombre (ej. "Test Folder")
   - Click "Crear"
3. Crear nota dentro de carpeta:
   - Click en carpeta para expandir
   - Click "+ Nueva Nota" / "+ New Note"
   - Ingresar título
   - Escribir contenido (usar rich editor)
   - Click "Guardar"
4. Editar nota:
   - Click en nota para abrir
   - Cambiar contenido
   - Click "Guardar"
5. Mover nota:
   - Arrastra nota a otra carpeta (o usar "Mover" menu)
   - Validar: nota se mueve en árbol
6. Exportar worldpedia:
   - Click "Exportar" / "Export All"
   - Validar: descarga archivo JSON
   - Inspeccionar: JSON tiene estructura `{ folders, notes }`
7. Importar worldpedia:
   - Click "Importar" / "Import"
   - Subir archivo exportado
   - Validar: carpetas y notas se recuperan

### ✅ Esperado
- CRUD de notas/carpetas funciona
- Movimiento (drag/move) persiste
- Export/import completos

### ❌ Falla si
- "Cannot create folder" error
- Nota desaparece después de editar
- Export produce JSON malformado
- Import lanza error

---

## 🚀 Ejecutar Smoke Tests

### Checklist antes de ejecutar:

- [ ] App compilada: `npm run build:all`
- [ ] Backend corriendo o app iniciada
- [ ] Usuario logged in
- [ ] Campaña ya existe (o permisos para crearla)

### Pasos

1. Abrir app (web o desktop)
2. Ejecutar flujos 1-5 en orden
3. Documentar resultado por flujo:
   - ✅ Logo al lado = Todo OK
   - ⚠️ Exclamación = Warning (funciones, pero algo raro)
   - ❌ X = Falla crítica

### Reporte

Si algún flujo falla:
1. Documentar pasos exactos para reproducir
2. Adjuntar screenshot / console error
3. Crear issue en GitHub
4. NO mergear hasta que todos estén ✅

---

**Última actualización:** 2026-04-13 (Sprint 1)  
**Versión:** 1.0  
**Frecuencia:** Ejecutar después de cada sprint + antes de release
