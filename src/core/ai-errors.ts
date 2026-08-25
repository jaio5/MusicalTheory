/**
 * Cómo dicen que no las tres rutas de IA.
 *
 * Los siete códigos estaban declarados **tres veces, idénticos**, en los
 * contratos de ideas, profesor y versiones. Escribí el tercero copiando el
 * primero, que es exactamente cómo se separan: el día que haga falta un código
 * nuevo hay que acordarse de añadirlo en los tres, y el que se olvide se
 * descubre cuando una ruta contesta algo que su pantalla no sabe leer.
 *
 * **Las frases no se comparten, y no es un olvido.** Cada ruta explica lo suyo:
 * «se te han acabado las ideas de hoy» y «se te han acabado las preguntas de
 * hoy» son la misma situación y no la misma frase. Lo que se comparte es el
 * vocabulario; lo que se dice con él, no.
 *
 * Está en `core/` porque lo necesitan tres features y un feature no importa de
 * otro. Es TypeScript puro: aquí no hay HTTP ni estados.
 */

export const AI_ERROR_CODES = [
  /** Falta algo en la petición, o lo que hay no vale. */
  'invalid_request',
  /** Demasiadas seguidas desde la misma dirección. */
  'rate_limited',
  /** El modelo no contesta, o no hay clave para hablarle. */
  'model_unavailable',
  /** Contestó, pero lo que dijo no pasa la comprobación contra el dominio. */
  'unparseable_response',
  /** Sin cuenta no hay a quién contarle el gasto de la IA. */
  'account_required',
  /** El plan no lo incluye. La ruta añade con cuál sí. */
  'plan_required',
  /** El plan lo incluye, pero ya se gastó el cupo de llamadas al modelo. */
  'quota_exhausted',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** El sobre con el que contestan. La misma forma que el resto de las rutas. */
export interface AiError {
  readonly error: { readonly code: AiErrorCode; readonly message: string };
}

/**
 * Arma el error con la frase que le toca.
 *
 * `message` se puede pasar para reescribirla con lo concreto: el candado dice
 * qué plan hace falta y cuánto cuesta, y el cupo dice cuántas peticiones eran.
 * Un mensaje genérico obligaría a adivinar.
 */
export function aiError(
  code: AiErrorCode,
  messages: Readonly<Record<AiErrorCode, string>>,
  message?: string,
): AiError {
  return { error: { code, message: message ?? messages[code] } };
}
