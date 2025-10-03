# Backend (NestJS)

Este backend implementa la API principal de la aplicación (NestJS + TypeORM + JWT).

## Stack Principal
- NestJS 10
- TypeORM (SQLite)
- Autenticación JWT (Passport)
- class-validator / class-transformer

## TypeScript / Toolchain
La versión de TypeScript está fijada explícitamente en `5.3.3` para garantizar compatibilidad con la versión actual de `@typescript-eslint` utilizada en el proyecto. Esto elimina el warning de:
```
WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.
```
Si se desea actualizar a una versión más reciente de TypeScript, se debe coordinar también la actualización de `@typescript-eslint/*` a una versión que declare soporte para esa versión de TS.

### Política de Versionado
- Mantener versión de TypeScript fija (sin caret) para builds reproducibles.
- Actualizar en bloque (TS + @typescript-eslint + posible ajuste de reglas ESLint) cuando se verifique soporte estable.

## Scripts
Ver `package.json` para la lista completa. Algunos relevantes:
- `npm run start:dev` – desarrollo con watch.
- `npm run lint` – lint con ESLint + Prettier (aplica `--fix`).
- `npm run test:e2e` – pruebas end-to-end (ver `test/README.md`).

## Estructura Arquitectura
Sigue el patrón NestJS estándar:
Controller -> Service -> Repository (vía TypeORM)

Módulos actuales:
- `auth` (login, registro, reset password)
- `users` (gestión de preferencias, perfil propio)
- `campaigns` (campañas, jugadores, invitaciones)

## Seguridad
- JWT Bearer para endpoints protegidos.
- Guards adicionales para ownership de campañas.
- Validaciones exhaustivas en DTOs con class-validator.

## Testing
- E2E tests en `backend/test` (ver README dedicado).
- Pendiente: añadir primeras unit tests (services aislados).

## Documentación relacionada
- Tests E2E: `backend/test/README.md`
- Backlog / Esquema: `BACKLOG_SCHEMA.md` (raíz del repositorio)
- Workflow CI: `.github/workflows/ci.yml`
- Dependencias automatizadas: `.github/dependabot.yml` (cuando exista)

## Próximas mejoras sugeridas
- Añadir script `typecheck` (`tsc --noEmit`).
- Factories / builders para reducir repetición en E2E.
- Dependabot / Renovate para orquestar upgrades coordinados.

---
Última actualización: 2025-10-02
