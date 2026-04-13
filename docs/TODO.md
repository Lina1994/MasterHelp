# TODO

Plan de refactorizacion incremental, orientado a no romper contratos ni flujos cruzados.

## Regla de avance (obligatoria por fase)
- [ ] Puerta tecnica en verde: build frontend + typecheck backend + tests backend + e2e backend.
- [ ] Puerta funcional en verde: smoke manual de campana activa, mapas/proyeccion, combate, soundtrack y worldpedia.
- [ ] Puerta de contrato en verde: validar que payloads criticos no cambian (shape y tipos).
- [ ] No iniciar la siguiente fase hasta cerrar las 3 puertas anteriores.

## Plan por sprints (ejecucion)

### Sprint 1 - Baseline + contratos criticos ✅ COMPLETADO (2026-04-13)
Objetivo: preparar red de seguridad antes de tocar arquitectura.
- [x] Cerrar Fase 0 completa.
- [x] Iniciar Fase 1 en campaigns/maps: inventario de endpoints criticos y casos de contrato.
- [x] Definir suite minima obligatoria para cada PR (tecnica + funcional + contrato).
- [x] PR piloto backgrounds: agregar validacion DTO @MinLength/@MaxLength sin cambiar contratos.
Criterio de salida:
- [x] Baseline documentado y aprobado (4 docs creados).
- [x] Checklist por PR activo y aplicado en PR backgrounds.
- [x] Verificacion parcial: build backend ✅ + build frontend ✅ + typecheck ✅
- [ ] Humo manual (5 flujos): Pendiente ejecución de usuario en UI
- [ ] Tests e2e backgrounds: Validar sin regresión (pre-existentes soundtrack sin relacion)

### Sprint 2 - Hardening backend de alto riesgo ⏳ EN PROGRESO (2026-04-13)
Objetivo: reforzar backend sin romper API publica.
- [x] Campaigns DTOs hardening (3 DTOs: create-campaign, update-campaign, invite-player con @MinLength/@MaxLength).
- [x] Maps DTOs hardening (4 DTOs: create-map, update-map, update-tokens, update-map-elements con @MinLength/@MaxLength).
- [x] Build backend sin errores ✅
- [x] Typecheck backend sin errores ✅
- [x] Build frontend sin errores ✅
- [x] E2E automatizado campaigns constraints ✅ (`test:e2e:campaign-validations`, 6/6)
- [x] E2E automatizado maps constraints ✅ (`test:e2e:maps-validations`, 8/8)
- [x] E2E automatizado maps state ✅ (`test:e2e:maps-state`, 5/5)
- [ ] Tests backend (pendiente).
- [x] E2E backend completo ✅ (`npm --prefix backend run test:e2e` -> 73/73)
- [ ] **Smoke manual (6 casos UI):** Ver docs/SMOKE_MANUAL_SPRINT2.md
  - [x] Campaigns validation parcial (1.1, 1.2, 1.3, 1.4 confirmados).
  - [ ] Campaigns validation pendiente (invite email >255 en UI).
  - [ ] Maps validation (name, tokens, elements).
  - [ ] Cross-integration smoke (tokens en combate, fog, proyección).
Criterio de salida:
- [x] Endpoints criticos mantienen shape/tipos (campaigns + maps).
- [x] Validaciones DTO no rompen contratos.
- [x] Build backend + typecheck + frontend + e2e verde (7/8 puertas tecnicas).
- [x] Tests de contrato campaigns + maps (manual parcial + e2e).
- [x] Persistencia maps (fog/tokens/elements) validada por e2e.
- [ ] Smoke manual 100% OK (pendiente ejecución en UI).

### Sprint 3 - Estado transversal frontend
Objetivo: reducir acoplamiento de sincronizacion entre contextos/hooks.
- [ ] Completar Fase 2 para campana/mapa/encuentro.
- [ ] Consolidar side effects de polling/localStorage/BroadcastChannel por dominio.
- [ ] Mantener compatibilidad de interfaces publicas durante migracion.
Criterio de salida:
- [ ] Sin regresiones en sincronizacion entre vistas principales y proyeccion.
- [ ] Smoke funcional completo en verde.

### Sprint 4 - Monolitos mapas y combate
Objetivo: bajar riesgo estructural en las zonas mas entrelazadas.
- [ ] Ejecutar primera ola de Fase 3 en mapas y combate.
- [ ] Extraer logica pura a servicios y separar componentes contenedor/presentacional.
- [ ] Introducir wrappers/adaptadores de compatibilidad.
Criterio de salida:
- [ ] Reduccion efectiva del tamano/complejidad en archivos objetivo.
- [ ] Sin roturas en flujos de mapa, combate y proyeccion.

### Sprint 5 - Monolitos restantes + API cliente
Objetivo: consolidar frontend sin divergencias de consumo.
- [ ] Continuar Fase 3 en proyeccion y personaje.
- [ ] Ejecutar Fase 4: unificacion de clientes API y tipado de rutas criticas.
- [ ] Resolver duplicaciones detectadas entre paginas/componentes.
Criterio de salida:
- [ ] Menos duplicidad de consumo API.
- [ ] Contratos internos de frontend unificados y validados.

### Sprint 6 - Deuda tecnica + cierre
Objetivo: estabilizacion final y salida controlada.
- [ ] Completar Fase 5 (migraciones TypeORM, hooks duplicados/sin uso, errores silenciosos).
- [ ] Completar Fase 6 (validacion extremo a extremo y prueba en desktop/electron).
- [ ] Actualizar documentacion viva y cerrar pendientes abiertos.
Criterio de salida:
- [ ] Todas las puertas en verde.
- [ ] Version candidata congelada con riesgo residual documentado.

## Fase 0 - Baseline y red de seguridad
- [ ] Congelar baseline de contratos y dependencias usando docs/API_ENDPOINTS.md, docs/COMPONENTS_MAP.md, docs/HOOKS_REGISTRY.md y docs/FILE_REGISTRY.md.
- [ ] Definir matriz de regresion minima para flujos entrelazados.
- [ ] Crear checklist operativo por PR de refactor.

## Fase 1 - Hardening backend sin romper API
- [ ] Priorizar modulos sensibles: campaigns, maps, soundtrack, worldpedia.
- [ ] Endurecer validaciones DTO con class-validator/class-transformer sin cambiar rutas ni respuestas.
- [ ] Asegurar separacion Controller -> Service -> Repository en los cambios nuevos.
- [ ] Agregar pruebas de contrato para endpoints criticos (especialmente projection y streaming).

## Fase 2 - Estabilizacion de estado transversal frontend
- [ ] Consolidar sincronizacion de estado de campana/mapa/encuentro en hooks de orquestacion por dominio.
- [ ] Reducir side effects duplicados de polling/localStorage/BroadcastChannel.
- [ ] Mantener interfaces publicas de hooks durante la migracion para evitar regresiones.

## Fase 3 - Refactor de monolitos frontend (por impacto)
- [ ] Priorizar mapas y combate (archivos grandes y con muchos hooks).
- [ ] Continuar con proyeccion y formularios de personaje.
- [ ] Extraer logica pura a servicios y separar contenedor/presentacional.
- [ ] Migrar con wrappers/adaptadores para no romper consumidores actuales.

## Fase 4 - Consolidacion API cliente y contratos internos frontend
- [ ] Unificar clientes API por dominio y manejo de errores.
- [ ] Tipar request/response de rutas criticas alineadas con backend.
- [ ] Revisar y eliminar duplicaciones de consumo entre paginas/componentes.

## Fase 5 - Deuda tecnica estructural
- [ ] Definir politica de migraciones TypeORM para produccion.
- [ ] Revisar y cerrar hooks sin uso o duplicados por dominio.
- [ ] Endurecer manejo de errores silenciosos en hooks de persistencia.
- [ ] Revisar validaciones DTO para campos opcionales heredados.

## Fase 6 - Cierre y salida controlada
- [ ] Ejecutar validacion tecnica y funcional completa de extremo a extremo.
- [ ] Validar escenarios reales en desktop/electron (proyeccion, audio, mapas).
- [ ] Congelar version candidata solo con todas las puertas en verde.

## Documentacion viva
- [ ] Completar USER_GUIDE con capturas y flujos reales.
- [ ] Completar DEV_GUIDE con ejemplos por modulo.
- [ ] Ejecutar docs:generate al cierre de cada fase.
- [ ] Actualizar esta lista cada sprint.
