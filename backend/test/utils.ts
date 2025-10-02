/**
 * Utilidad simple para generar un sufijo único (ms + aleatorio corto) y evitar colisiones UNIQUE
 * en ejecuciones repetidas de tests e2e sobre la misma base de datos.
 */
export function uniqueSuffix(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
}
