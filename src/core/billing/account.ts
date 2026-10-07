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
  /**
   * Cómo quiere que le llamen, si lo ha dicho.
   *
   * Sube hasta el navegador porque de él sale la letra del avatar y el saludo del
   * perfil. Es lo único que se enseña de quien entra, y por eso se puede cambiar
   * sin tocar el correo: el correo identifica la cuenta, el nombre no.
   */
  readonly name: string | null;
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
 * El modelo que contesta si nadie dice otro, y el que se supone cuando el
 * servidor no dice cuál hay.
 *
 * **Sonnet 5.5** (adr/0103). Fue Opus 5, y con él Básico daba 73 preguntas al
 * mes: unas dos al día, escaso para estudiar. Sonnet 5.5 cuesta la mitad por
 * pregunta y su pensamiento se apaga (`between_tools`), así que no hay que
 * pagarle una reserva para pensar; Opus 5.5, que es más barato que Opus 5 por
 * token, no se puede apagar y por pregunta sale casi seis veces más caro. La
 * respuesta va atada a un esquema y se valida contra el dominio: lo que se paga
 * de más con Opus no se nota en lo que llega.
 *
 * Que la pantalla y el servidor supongan el mismo es lo que importa: el servidor
 * manda el suyo en la cuenta (`aiModel`), y este solo se usa mientras no ha
 * llegado.
 */
export const DEFAULT_AI_MODEL = 'claude-sonnet-5-5';

export const ANONYMOUS: Account = {
  email: null,
  name: null,
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

/**
 * Lo más largo que puede ser el nombre.
 *
 * Sesenta caracteres es lo que ya recortaba el servidor al registrar. Está aquí
 * para que el formulario impida escribir lo que el servidor iba a recortar sin
 * decirlo: un nombre que se guarda a medias parece un fallo de la aplicación.
 */
export const MAX_NAME_LENGTH = 60;

/**
 * Cómo se le llama a quien entra.
 *
 * El nombre si lo ha dicho, y si no la parte del correo antes del arroba. Nunca
 * el correo entero: no cabe en la barra de arriba y la mitad de detrás no
 * identifica a nadie.
 */
export function displayName(account: Account): string {
  const name = account.name?.trim() ?? '';
  if (name !== '') {
    return name;
  }
  return account.email?.split('@')[0] ?? 'tu cuenta';
}

/**
 * La letra del avatar.
 *
 * Una sola, en mayúscula, y sacada de cómo se le llama. En mayúscula por CSS no:
 * un `text-transform` no cambia lo que lee un lector de pantalla, y aquí el
 * botón se anuncia por su nombre completo de todas formas.
 *
 * Un nombre que empieza por emoji o por un carácter fuera del plano básico se
 * parte en dos si se corta por `[0]`, así que se corta por puntos de código.
 */
export function avatarInitial(account: Account): string {
  const [first] = [...displayName(account)];
  /* v8 ignore next -- `displayName` nunca devuelve vacio: sin nombre ni correo dice «tu cuenta» */
  return (first ?? '?').toUpperCase();
}
