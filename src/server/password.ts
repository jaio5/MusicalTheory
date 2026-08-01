/**
 * Cifrado de contraseñas con lo que ya trae Node.
 *
 * `scrypt` viene en el módulo `crypto` de la biblioteca estándar, así que aquí no
 * entra ninguna dependencia. No es celo de artesano: bcrypt y argon2 se compilan
 * al instalar, y una dependencia que se compila es la que rompe el despliegue en
 * la máquina que no tiene compilador. Es la misma razón por la que la detección
 * de tono es propia y está escrita en [adr/0002](../../docs/adr/0002-deteccion-de-tono-propia.md).
 *
 * `scrypt` es de las tres funciones que recomienda OWASP para esto, junto con
 * argon2 y bcrypt, y es la única que no hay que instalar.
 *
 * El formato guardado lleva sus propios parámetros dentro:
 *
 * ```
 * scrypt$16384$8$1$<sal en base64>$<clave en base64>
 * ```
 *
 * Con los parámetros dentro, subirlos mañana no invalida lo guardado hoy: cada
 * contraseña se comprueba con los suyos y se puede volver a cifrar con los
 * nuevos la próxima vez que alguien entre.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Coste de la función. 16384 vueltas es lo que recomienda Node en su propia
 * documentación y tarda unos 100 ms, que es tiempo de sobra para que probar
 * contraseñas a lo bruto no sea negocio y poco para que entrar se note lento.
 */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Node se queda corto de memoria con estos parámetros si no se le sube el tope. */
const MAXMEM = 64 * 1024 * 1024;

async function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: MAXMEM });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Si la contraseña es la que corresponde a lo guardado.
 *
 * La comparación es en tiempo constante: comparar con `===` filtra por cuánto
 * tarda en fallar cuántos bytes iniciales acertaste, y eso se puede usar para
 * adivinar la clave byte a byte.
 *
 * Cualquier cosa rara en lo guardado —formato viejo, campos de menos, base64
 * inválido— es un no, nunca una excepción: una fila estropeada no puede tirar la
 * pantalla de entrar.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  const n = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(rawSalt!, 'base64');
    const expected = Buffer.from(rawKey!, 'base64');
    if (salt.length === 0 || expected.length === 0) {
      return false;
    }
    const key = await derive(password, salt, n, r, p);
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
