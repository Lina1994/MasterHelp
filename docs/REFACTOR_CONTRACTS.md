# REFACTOR_CONTRACTS - Snapshot de Contratos Críticos

Línea base de estructuras JSON rígidas que **NO deben cambiar** durante refactorización. Estos son contratos públicos consumidos por frontend y/o ventanas de proyección.

## Endpoints públicos sin autenticación (MÁS críticos)

### GET `/campaigns/projection/:id/battle-state`
**Consumidor:** Frontend (ProjectionMapPage, ProjectionSkylinePage)  
**Estructura esperada:**
```json
{
  "battleParticipants": [
    {
      "id": "uuid",
      "name": "string",
      "type": "character|monster",
      "hp": number,
      "maxHp": number,
      "armorClass": number,
      "initiative": number,
      "initiativeBonus": number
    }
  ],
  "activeCombatant": "uuid | null",
  "round": number,
  "turn": number
}
```
**Restricción:** No renombrar campos, no cambiar tipos. Agregar campos opcionales está OK si son nullable.

---

### GET `/campaigns/projection/:id/skyline-overlay`
**Consumidor:** Frontend (ProjectionSkylinePage)  
**Estructura esperada:**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "string",
      "x": number,
      "y": number,
      "z": number,
      "opacity": number,
      "visible": boolean
    }
  ],
  "opacity": number,
  "enabled": boolean
}
```
**Restricción:** Shape idéntico. No cambiar orden de campos.

---

### GET `/campaigns/projection/:id/default-skyline`
**Consumidor:** Frontend (ProjectionSkylinePage)  
**Estructura esperada:**
```json
{
  "url": "string (URI data:image/...)",
  "width": number,
  "height": number,
  "mimeType": "image/png | image/jpeg"
}
```
**Restricción:** URL debe ser accesible sin autenticación.

---

## Endpoints privados críticos (autenticados pero impacto alto)

### PATCH `/campaigns/:id/fog-of-war`
**Consumidor:** Frontend (MapElementsEditorLayer, ProjectedMapMirror)  
**Default request:**
```json
{
  "type": "grid | organic",
  "cells": ["A1", "A2", "B1"]  // or encoded string array
}
```
**Response:**
```json
{
  "type": "grid | organic",
  "cells": ["A1", "A2", "B1"],
  "updatedAt": "ISO8601"
}
```
**Restricción:** Formato de cell IDs debe ser parseable (no cambiar naming).

---

### GET `/maps/:id/image?size=thumb|preview|full`
**Consumidor:** Frontend (todos los componentes que muestran mapas)  
**Respuesta:** Stream binario + Headers:
```
Content-Type: image/png | image/jpeg
Content-Length: number
Content-Disposition: inline; filename="..."
```
**Restricción:** Query param `size` debe aceptar exactamente esos 3 valores. No cambiar nombre del param.

---

### PATCH `/campaigns/:id/grid-overlay`
**Consumidor:** Frontend (MapGridOverlay)  
**Default request:**
```json
{
  "cellSize": number,
  "opacity": number,
  "visible": boolean,
  "enabled": boolean
}
```
**Response:** Idéntico a request.  
**Restricción:** Ni renombres ni cambies tipos.

---

### PATCH `/campaigns/:id/active-map`
**Consumidor:** Frontend (ActiveMapContext)  
**Default request:**
```json
{
  "mapId": "uuid | null"
}
```
**Response:**
```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "activeMapId": "uuid | null"
}
```
**Restricción:** `null` debe representar "sin mapa activo".

---

### PATCH `/campaigns/:id/active-encounter`
**Consumidor:** Frontend (ActiveEncounterContext, CombatView)  
**Default request:**
```json
{
  "encounterId": "uuid | null"
}
```
**Response:**
```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "activeEncounterId": "uuid | null"
}
```
**Restricción:** `null` debe caer a "sin encuentro activo".

---

### POST `/campaigns/:id/invite`
**Consumidor:** Frontend (CampaignInviteForm)  
**Default request:**
```json
{
  "email": "string (email)"
}
```
**Response:**
```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "email": "string",
  "status": "pending | accepted | rejected",
  "createdAt": "ISO8601"
}
```
**Restricción:** Valores de `status` son fijos.

---

### GET `/campaigns/:id/manuals`
**Consumidor:** Frontend (CampaignSettingsModal, múltiples diálogos de CRUD)  
**Response:**
```json
{
  "manuals": [
    {
      "id": "uuid",
      "name": "string",
      "type": "official | custom"
    }
  ]
}
```
**Restricción:** No renombres `type` ni sus valores.

---

## Endpoints de streaming (especiales)

### GET `/soundtrack/songs/:id/stream`
**Consumidor:** Frontend (GlobalPlayerContext, audio playback)  
**Respuesta:** Binary stream + Headers:
```
Content-Type: audio/mpeg | audio/wav | audio/ogg
Content-Length: number
Accept-Ranges: bytes (REQUIRED para seek)
```
**Restricción:** MUST soportar HTTP Range requests para que seek en UI funcione.

---

### GET `/shops/:shopId/cells/:cellId/stream`
**Consumidor:** Frontend (MediaCell)  
**Respuesta:** Binary stream de media + Headers:
```
Content-Type: image/* | audio/* (según media)
Content-Length: number
```
**Restricción:** Mismo que songs/stream.

---

## Estructura de entidades base (NO deben cambiar tipos en DB)

### Campaign
```typescript
{
  id: UUID,
  name: string,
  description?: string,
  owner: User,
  players: User[],
  activeMapId?: UUID,
  activeEncounterId?: UUID,
  activeSkylineCharacterId?: UUID,
  // "ANY" de estos 3 **nunca** deben ser no-nullable
}
```

### Map
```typescript
{
  id: UUID,
  campaignId: UUID,
  name: string,
  image: Buffer | null,
  imageVariants: {
    thumb?: URL,
    preview?: URL,
    full?: URL
  },
  tokens: MapToken[],
  elements: MapElement[],
  fog: { cells: string[] },
  organicFog?: { strokes: [...] }
}
```

---

## Cómo usar este documento

1. **Antes de cambiar un endpoint:** busca su entrada aquí.
2. **Si existe entrada:** los campos son rígidos, no puedes cambiar sin actualizar también consumidores.
3. **Si no existe entrada:** es "privado/bajo-riesgo", puedes cambiar pero documenta en PR.
4. **Post-cambio:** ejecuta snapshot test o comparación manual de payloads vs este documento.

---

**Última actualización:** 2026-04-13 (Sprint 1)  
**Versión:** 1.0  
**Estado:** CONGELADO (cambios requieren aprobación)
