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