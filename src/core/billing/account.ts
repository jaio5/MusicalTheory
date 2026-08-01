/**
 * Quién eres, según la aplicación.
 *
 * Es una forma pura y sin dependencias porque la usan las dos orillas: el
 * servidor la construye leyendo la sesión y la base de datos, y el navegador la
 * recibe ya hecha para saber qué enseñar. Poniéndola aquí, ninguna de las dos
 * tiene que importar de la otra.
 *
 * No lleva contraseña, ni identificador de la fila, ni nada que el navegador no
 * necesite. Lo que no se necesita arriba no sube.
 */

import { DEFAULT_PLAN, type PlanId } from './plans';

export interface Account {
  /** El correo con el que se entró, o nulo si no se ha entrado. */
  readonly email: string | null;
  readonly plan: PlanId;
  /**
   * El modelo que hay configurado en el servidor.
   *
   * Viaja hasta el navegador porque **los cupos se calculan desde el precio del
   * modelo**: sin saber cuál es, la pantalla no puede decir cuántas peticiones da
   * un plan. Es el identificador público del modelo, no una clave ni un secreto.
   */
  readonly aiModel: string;
  /**
   * Llamadas al modelo que quedan hoy y este mes.
   *
   * Dos y no una porque hay dos topes: el del mes protege el dinero y el del día
   * evita que alguien se funda el mes el día uno. Nulo cuando no se puede saber
   * —sin cuenta no hay fila que contar—, y nulo se enseña distinto de un cero,
   * que es «no te queda ninguna».
   */
  readonly aiLeftToday: number | null;
  readonly aiLeftMonth: number | null;
}

/**
 * El modelo que se supone cuando el servidor no dice cuál hay.
 *
 * El mismo que el de las rutas por defecto. Que sea el más caro es lo prudente:
 * los cupos que enseñe la pantalla serán los más pequeños posibles, y nunca
 * prometerá más de lo que el servidor va a dar.
 */
export const DEFAULT_AI_MODEL = 'claude-opus-5';

export const ANONYMOUS: Account = {
  email: null,
  plan: DEFAULT_PLAN,
  aiModel: DEFAULT_AI_MODEL,
  aiLeftToday: null,
  aiLeftMonth: null,
};

/**
 * Lo más corta que puede ser una contraseña.
 *
 * Vive aquí y no junto al cifrado porque la piden los dos lados: el formulario
 * para no dejar enviar, y el servidor para rechazar a quien no pase por el
 * formulario. Escrita dos veces, el día que suba a doce el formulario dejaría
 * enviar contraseñas que el servidor rechaza.
 *
 * Ocho y no doce, y sin exigir mayúsculas ni símbolos: las reglas de composición
 * empujan a `Password1!` y ya no las recomienda nadie. Lo que protege de verdad
 * es que el cifrado sea lento, y de eso se encarga scrypt.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function isSignedIn(account: Account): boolean {
  return account.email !== null;
}
