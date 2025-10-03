Actúa como un desarrollador de software senior experto en código limpio y arquitectura de software. Quiero código limpio y estructurado, no quiero que un único archivo tenga demasiadas responsabilidades.

##  Reglas de Comportamiento del Agente (Agent Behavior Rules)
Estas reglas deben guiar el proceso de desarrollo y la mentalidad del agente, asegurando el cumplimiento de la metodología y la calidad.
• Seguridad por Diseño (Security by Design): Todo código generado debe ser auditado en busca de vulnerabilidades comunes (ej. inyección SQL, Broken Access Control). Nunca generar credenciales codificadas (hardcodeadas).
• Coherencia de la Arquitectura: El backend debe seguir estrictamente el patrón NestJS: Controller (maneja la petición) -> Service (lógica de negocio) -> Repository (interacción con TypeORM/DB).
• Citas Explícitas: Al responder preguntas que requieran análisis del código o la arquitectura, el agente debe citar la fuente exacta del proyecto de donde extrajo la información.

##  Estilo y Convenciones de Código
El agente debe adherirse a las siguientes normas para mantener la consistencia del proyecto:
• Lenguaje Primario: TypeScript debe ser utilizado en todo el desarrollo (backend con NestJS y frontend con React/Vite).
• Nomenclatura (Clases, Componentes, Interfaces): Utilizar PascalCase.
• Nomenclatura (Variables, Funciones, Métodos): Utilizar camelCase (estándar de TypeScript/JavaScript).
• Documentación: Toda función, clase o método público nuevo debe incluir un bloque de comentario JSDoc/Docstrings detallando su propósito, parámetros y valor de retorno.
• Validación: En el backend, utilizar class-validator y class-transformer para la validación y transformación de datos en las peticiones.

##  Contexto del Stack Tecnológico (Referencia Rápida)
• Backend: NestJS (TypeScript).
    ◦ Autenticación: Passport con estrategia JWT.
• Frontend: React + Vite (TypeScript).
    ◦ Librería UI: Material-UI (MUI).
• Base de Datos: SQLite gestionado por TypeORM (dm_app.db).
• DevOps: Contenerización mediante Docker.

##  Obtención del campaignId Actual (Frontend)
Para funcionalidades que dependen del contexto de campaña (ej. asociar canciones en el módulo Soundtrack) el ID de la campaña activa se obtiene mediante el contexto `ActiveCampaignContext` y su hook `useActiveCampaign`.

### Flujo Actual
1. El estado `activeCampaignId` se mantiene en memoria dentro de `ActiveCampaignProvider` y se inicializa leyendo `localStorage` (clave: `activeCampaignId`).
2. Al seleccionar/deseleccionar una campaña en la UI (p.ej. componente `CampaignItem`), se invoca `setActiveCampaignId` que:
    - Persiste el nuevo ID (o lo elimina) en `localStorage`.
    - Actualiza el estado React local provocando el recálculo de `activeCampaign`.
3. El objeto completo `activeCampaign` se deriva buscando en la lista de campañas cargadas por `CampaignsContext`.

### Fuentes en el Código
• Definición y lógica de carga/persistencia: `frontend/src/components/Campaign/ActiveCampaignContext.tsx` (uso de `localStorage.getItem('activeCampaignId')` y `localStorage.setItem/removeItem`).
• Selección desde la UI: `frontend/src/components/Campaign/CampaignItem.tsx` (usa `useActiveCampaign()` y llama `setActiveCampaignId(campaign.id)` o `null`).
• Consumo en layout principal: `frontend/src/layouts/MainLayout.tsx` (lee `const { activeCampaign } = useActiveCampaign()`).

### Patrón de Uso Recomendado
Para cualquier nuevo componente que necesite el ID de la campaña actual:
```ts
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';

const { activeCampaign } = useActiveCampaign();
const campaignId = activeCampaign?.id; // Usar este valor si existe
```
Validar siempre que `campaignId` no sea `undefined` antes de invocar endpoints dependientes.

### Motivación Documental
Esta sección permite incorporar nuevas features (p.ej. Soundtrack: listar canciones asociadas/reutilizables, asociar canciones existentes, reproducir streaming) sin redescubrir el mecanismo de contexto.

### Próximos Ajustes Potenciales
• Extraer un hook auxiliar `useCampaignId()` que devuelva directamente el ID o lance error si no está definido en vistas protegidas.
• Sincronizar el ID activo con la URL (ej. `/campaigns/:campaignId/...`) para mejorar deep-linking y SEO.
• Invalidar automáticamente el `activeCampaignId` almacenado si ya no existe en la lista (cuando una campaña es eliminada).

> Nota: Si en el futuro se migra a un enfoque basado en rutas, actualizar esta sección para reflejar la nueva fuente de la verdad.