# DEV_GUIDE

Guia para desarrolladores que contribuyen a la aplicacion.

## 1. Setup local
- Requisitos (Node, npm).
- Instalacion de dependencias.
- Comandos de desarrollo web y desktop.

## 2. Arquitectura
- Frontend: React + Vite + TypeScript.
- Backend: NestJS + TypeORM + SQLite.
- Desktop: Electron.

## 3. Convenciones de codigo
- Backend: Controller -> Service -> Repository.
- DTOs con class-validator/class-transformer.
- Componentes y clases en PascalCase.
- Funciones y variables en camelCase.

## 4. Contextos y hooks clave
- ActiveCampaignContext y useCampaignId.
- Hooks de mapa (tokens, elementos, fog, audio).

## 5. Flujo para agregar una feature
- Backend: entidad, dto, servicio, controlador, modulo.
- Frontend: api, hook, componente, pagina.
- Integracion de estados y sincronizacion.

## 6. Sistema de mapas
- Grid y fog.
- Elementos editables.
- Sincronizacion de proyeccion.

## 7. Soundtrack y efectos
- Reproduccion principal.
- Fuentes de sonido por mapa.

## 8. Calidad y verificacion
- Typecheck frontend/backend.
- E2E y pruebas manuales.

## 9. Documentacion viva
- Ejecutar `npm run docs:generate` para actualizar registros.
- Revisar `docs/TODO.md` y `BACKLOG_SCHEMA.md`.
