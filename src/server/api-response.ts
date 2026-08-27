/**
 * El sobre con el que contestan las rutas cuando contestan que no.
 *
 * Todas usan la misma forma —`{ error: { code, message } }`, con la frase ya en
 * español y diciendo qué hacer— y la armaban a mano veinte veces. Aquí está una
 * sola, y su gemela del navegador que lo lee está en `state/api-error.ts`.
 *
 * `code` y `message` van juntos y no se elige uno: el código es lo que deja a la
 * pantalla hacer algo distinto —un «no entra en tu plan» lleva a los planes— y la
 * frase es lo que se lee. Con solo el código habría que traducirlo en el
 * navegador, y entonces la ruta podría negar lo que la pantalla promete.
 */

import { NextResponse } from 'next/server';

/**
 * «Has ido demasiado deprisa», con su `Retry-After`.
 *
 * Estaba escrita en cuatro rutas con la misma frase, el mismo estado y la misma
 * cabecera. La cabecera es la parte que se olvida al copiar, y sin ella un
 * cliente educado no sabe cuánto esperar y vuelve a probar en seguida.
 */
export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
      },
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}
