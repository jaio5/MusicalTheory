/**
 * Comparar dos cosas secretas sin que el reloj cuente por dónde se parecen.
 *
 * `===` sobre cadenas se para en el primer carácter distinto, y esa diferencia se
 * mide desde fuera: probando un carácter cada vez se reconstruye un secreto
 * entero sin acertar ninguno. Es la misma razón por la que `password.ts` compara
 * así los hashes de contraseña desde el principio.
 *
 * Está aquí y no dentro de quien lo usa porque lo necesitan la firma del webhook
 * y el vale de recuperación, y estaba escrito dos veces letra por letra.
 */

import { timingSafeEqual } from 'node:crypto';

/**
 * Dos hexadecimales, comparados en tiempo constante.
 *
 * Longitudes distintas se rechazan de entrada, y eso **no filtra nada**: lo que
 * mide un HMAC-SHA256 o un SHA-256 no es secreto, es una constante conocida por
 * cualquiera. Lo que hay que ocultar es en qué carácter se dejan de parecer.
 *
 * Lo que no es hexadecimal se rechaza en vez de reventar: llega de fuera, y una
 * excepción aquí sería un 500 donde corresponde un «eso no vale».
 */
export function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
