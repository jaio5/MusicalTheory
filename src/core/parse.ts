/**
 * Leer lo que llega de fuera, sin creerse nada.
 *
 * Está aquí arriba y no dentro de un contrato porque lo necesitan tres —ideas,
 * profesor y versiones— y un feature no importa de otro. Estaba escrito tres
 * veces, letra por letra: la tercera copia fue la que lo hizo evidente.
 *
 * TypeScript puro, como todo `core/`: aquí no hay `Request`, ni `fetch`, ni
 * conocimiento de HTTP. Solo la pregunta de si eso que ha llegado tiene la forma
 * que se esperaba.
 */

/**
 * Si eso es un objeto con claves, y no un array ni nulo.
 *
 * Los arrays se excluyen a propósito: `typeof [] === 'object'` y sin esta
 * comprobación un cuerpo que llega como lista pasaría por objeto vacío y todos
 * sus campos saldrían indefinidos, que es un fallo silencioso en vez de un
 * rechazo.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * El cuerpo de una petición como objeto, o vacío si no lo es.
 *
 * Un cuerpo mal formado se lee como uno vacío y no como un error: lo que decide
 * si falta algo es la validación de cada campo, que ya sabe qué falta y puede
 * decirlo. Un `try/catch` en cada ruta contestando «cuerpo inválido» diría menos.
 */
export function isRecordOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
