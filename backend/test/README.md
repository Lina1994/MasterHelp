# E2E Tests (Backend)

Este directorio contiene las pruebas End-to-End para el backend (NestJS). La suite valida reglas de negocio críticas: ownership de campañas, flujo completo de invitaciones y gestión de jugadores.

## Convención de nombres

Los archivos de invitaciones siguen un prefijo numerado que refleja orden lógico de complejidad y dependencias conceptuales:

```
campaign-invitations-01-basic.e2e-spec.ts
campaign-invitations-02-decline-reinvite.e2e-spec.ts
campaign-invitations-03-duplicate-invite.e2e-spec.ts
campaign-invitations-04-rerespond.e2e-spec.ts
campaign-invitations-05-username.e2e-spec.ts
campaign-invitations-06-forbidden-respond.e2e-spec.ts
campaign-invitations-07-not-found.e2e-spec.ts
```

Otros dominios:
```
campaign-ownership.e2e-spec.ts
campaign-remove-player.e2e-spec.ts
```

Regla general:
- `campaign-<subdominio>-NN-descriptor.e2e-spec.ts` para escenarios con progresión lógica.
- Evitar dependencias entre archivos (cada test crea su propio set de datos).

## Idempotencia y `uniqueSuffix()`

Para evitar errores de constraint UNIQUE en la base SQLite persistente, **no se limpian tablas** entre ejecuciones.
En su lugar, los tests generan usernames/emails únicos mediante la utilidad `uniqueSuffix()` definida en `utils.ts`:

```ts
export function uniqueSuffix(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
}
```

Uso típico dentro de un test:
```ts
const suf = uniqueSuffix();
const username = `user_${suf}`;
const email = `user_${suf}@example.com`;
```

Beneficios:
- Evita dependencia en orden de ejecución.
- Permite re-ejecutar una sola spec sin “limpiar” estado global.
- Minimiza coste de re-configuración TypeORM o writes masivos para truncar tablas.

## Política: No limpiar DB en E2E

Motivos para no truncar/limpiar automáticamente:
1. Simula entorno más realista (crecimiento de datos) para detectar potencial degradación futura.
2. Elimina necesidad de exponer DataSource en tests o usar hooks costosos.
3. Evita condiciones de carrera si en un futuro se paralelizan suites (cada test usa sufijos únicos).

Si se necesitara un entorno totalmente efímero:
- Alternativa A: Configurar un módulo de test que use SQLite en memoria (`:memory:`) con `synchronize: true`.
- Alternativa B: Usar un archivo temporal por ejecución (p.ej. `dm_app.test.<PID>.db`).

## Errores esperados y aserciones flexibles
Algunos endpoints pueden devolver `200` o `201` dependiendo de convenciones del controller (crear vs responder). Los tests aceptan ambos cuando la semántica subyacente es equivalente.

Ejemplo:
```ts
expect([200,201]).toContain(res.status);
```

## Cobertura actual resumida
- Ownership: actualización y borrado restringidos al owner.
- Invitaciones: ciclos invited → (accept|decline) → re-invite → active; duplicados; re-responder; forbidden respond; not found.
- Gestión jugadores: remove player (403 non-owner, 404 inexistente, éxito), no se prueba self-remove porque owner no se materializa como `CampaignPlayer`.

## Buenas prácticas al añadir nuevas specs
1. Incluir comentario inicial listando escenarios cubiertos.
2. Usar `uniqueSuffix()` para todo recurso identificable (username/email/nombre campaña si aplica).
3. Mantener cada spec independiente (no confiar en datos creados por otra spec).
4. Aserciones específicas sobre status codes y mensajes relevantes (`message` esperado en errores).
5. Evitar sleeps arbitrarios; preferir respuestas directas del servidor (no hay polling aquí).

## Comandos útiles
Ejecutar toda la suite E2E:
```
npm run test:e2e
```
Ejecutar un archivo específico:
```
npm run test:e2e -- campaign-invitations-03-duplicate-invite.e2e-spec.ts
```

## Próximas mejoras sugeridas
- Workflow CI (GitHub Actions) con: lint + unit + e2e.
- Config de TypeORM especial de test (SQLite memoria) para mayor velocidad si la suite crece.
- Factories reutilizables (helpers) para crear usuario/campaña y reducir repetición.
- Asignar códigos de error internos (p.ej. `INV_ALREADY_RESPONDED`) para aserciones más robustas que dependan menos de texto.

---
Última actualización: (mantener fecha manualmente)
