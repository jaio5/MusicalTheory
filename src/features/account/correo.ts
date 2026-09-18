/**
 * Si un correo tiene forma de correo.
 *
 * Existe porque el navegador ya lo comprobaba **y lo decía en inglés**: la
 * burbuja de `type="email"` la escribe el navegador en su idioma, y aquí se veía
 * «Please include an '@' in the email address» encima de un formulario en
 * español. No se puede traducir esa burbuja; lo que se puede es no dejar que
 * salga, y decirlo con el `Aviso` que esta aplicación ya usa para todo lo demás.
 *
 * **No valida de verdad, y no debe.** Un correo solo se sabe bueno mandándole
 * algo; la regla de aquí es la mínima que evita el error tonto —falta la arroba,
 * falta el dominio, hay un espacio— sin rechazar direcciones raras pero legales.
 * Quien decide de verdad es el servidor.
 */
export function pareceUnCorreo(correo: string): boolean {
  const limpio = correo.trim();
  if (limpio === '' || /\s/.test(limpio)) {
    return false;
  }
  const partes = limpio.split('@');
  if (partes.length !== 2) {
    return false;
  }
  const [antes, despues] = partes as [string, string];
  return (
    antes !== '' && despues.includes('.') && !despues.startsWith('.') && !despues.endsWith('.')
  );
}

/** Lo que se dice cuando no lo parece. */
export const CORREO_MAL = 'Ese correo no tiene buena pinta: repásalo y vuelve a probar.';
