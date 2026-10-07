/**
 * El secreto con el que se firma la cookie de sesión, si vale.
 *
 * Con él se firma la sesión y se saca el HMAC que guarda el gasto de una cuenta
 * borrada (`ai-usage.ts`, adr/0114). Uno corto —«x», «secreto»— se adivina por
 * fuerza bruta, y entonces la cookie se falsifica y la tabla de la herencia
 * vuelve a ser un diccionario de correos. Por eso **uno corto cuenta como
 * ninguno**: la aplicación se queda sin cuentas, que es lo seguro, y lo dice al
 * arrancar en vez de callarlo. 32 es lo que da `openssl rand -base64 32` y lo
 * que pide Auth.js para su propio secreto.
 */
export const LARGO_MINIMO_DEL_SECRETO = 32;

export function secretoDeSesion(): string | null {
  const valor = process.env['AUTH_SECRET'];
  return valor === undefined || valor.length < LARGO_MINIMO_DEL_SECRETO ? null : valor;
}

/** El aviso de arranque si hay secreto pero no vale, o nulo. */
export function avisoDeSecreto(): string | null {
  const valor = process.env['AUTH_SECRET'];
  if (valor === undefined || valor === '' || valor.length >= LARGO_MINIMO_DEL_SECRETO) {
    return null;
  }
  return (
    `AUTH_SECRET tiene ${valor.length} caracteres y hacen falta al menos ` +
    `${LARGO_MINIMO_DEL_SECRETO}: las cuentas quedan apagadas hasta que lo cambies ` +
    '(`openssl rand -base64 32`).'
  );
}
