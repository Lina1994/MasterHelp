# TODO

Tareas pendientes para crecimiento y refactorizacion.

## Refactorizacion (monolitos)
- [ ] Revisar archivos con mas de 400 lineas reportados en FILE_REGISTRY.
- [ ] Dividir componentes con muchos hooks reportados en COMPONENTS_MAP.

## Hooks
- [ ] Revisar hooks con 0 usos detectados en HOOKS_REGISTRY.
- [ ] Consolidar hooks duplicados por dominio.

## API y contratos
- [ ] Revisar endpoints duplicados en API_ENDPOINTS.
- [ ] Documentar contratos de request/response para rutas criticas.

## Deuda tecnica
- [ ] Definir politica de migraciones TypeORM para produccion.
- [ ] Endurecer manejo de errores silenciosos en hooks de persistencia.
- [ ] Revisar validaciones DTO para campos opcionales heredados.

## Documentacion
- [ ] Completar USER_GUIDE con capturas y flujos reales.
- [ ] Completar DEV_GUIDE con ejemplos por modulo.
- [ ] Actualizar esta lista cada sprint.
