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
 * scrypt$16384$8$5$<sal en base64>$<clave en base64>
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
 * Coste de la función: una de las cinco combinaciones que da OWASP, todas con la
 * misma defensa y que solo cambian memoria por paralelismo
 * (`Password_Storage_Cheat_Sheet`, apartado scrypt).
 *
 * **La de antes no estaba en esa lista.** `N=16384, r=8, p=1` es el ejemplo de la
 * documentación de Node, no una recomendación, y medido en este equipo tardaba
 * 31 ms y no los 100 que decía este comentario. Las cinco de OWASP cuestan lo
 * mismo en procesador —`N·r·p` igual—, así que se elige por la memoria: con
 * `N=2^14, r=8, p=5` cada comprobación ocupa 16 MiB, lo mismo que antes, y tarda
 * unos 120 ms (medido el 2 de octubre de 2026: 119 ms). La de `N=2^17, p=1` tarda
 * 289 ms y pide 128 MiB **por intento**, y cinco a la vez serían 640 MiB de un
 * servidor pequeño: esa memoria es justo la que se ahorra quien ataca.
 */
const N = 16_384;
const R = 8;
const P = 5;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Node se queda corto de memoria con estos parámetros si no se le sube el tope, y
 * tiene que caber también lo guardado con otros más altos.
 */
const MAXMEM = 64 * 1024 * 1024;

/**
 * Lo más larga que puede ser una contraseña: 1024 caracteres.
 *
 * **No había tope**, y lo que lo acotaba era lo que dejara pasar el cuerpo de la
 * petición: la entrada la lee Auth.js sin el tope de 128 KB de las demás rutas, y
 * una de 10 MB en ligaduras —que NFKC triplica— llegaba entera a `scrypt`. Mil
 * caracteres sobran para cualquier gestor de contraseñas (suelen dar de 20 a 64) y
 * para una frase larga, y dejan el trabajo de antes de `scrypt` en nada
 * ([adr/0113](../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 *
 * Lo comprueban quien crea, cambia y restablece una contraseña —con el resultado
 * `contrasena-corta`, que quiere decir «fuera de medida»— y `verifyPassword`, que
 * dice que no sin derivar nada.
 */
export const MAX_PASSWORD_LENGTH = 1024;

/** Si una contraseña nueva tiene una longitud que se acepta: ni corta ni enorme. */
export function contrasenaDeMedida(password: unknown, minimo: number): password is string {
  return (
    typeof password === 'string' &&
    password.length >= minimo &&
    password.length <= MAX_PASSWORD_LENGTH
  );
}

/** Los parámetros con los que se cifra hoy, en el orden del formato guardado. */
function parametros(): string {
  return ['scrypt', N, R, P].join('$');
}

/**
 * Una contraseña cifrada que no es de nadie, **con los parámetros de hoy**.
 *
 * Sirve para comprobar la contraseña también cuando el correo no existe. Sin
 * esto, entrar con un correo desconocido contesta en un milisegundo y entrar con
 * uno conocido tarda cien: la diferencia se mide desde fuera y regala una lista
 * de quién tiene cuenta aquí. Vive aquí y no en `auth.ts` para que suba sola el
 * día que suban los parámetros: con los de antes escritos a mano, igualaba el
 * tiempo de una cuenta vieja y no el de una nueva.
 *
 * Iguala el correo que no existe con una cuenta de hoy; una cuenta **de antes**
 * tarda menos, y eso lo iguala `igualarCoste`.
 */
export const HASH_DE_NADIE = [
  parametros(),
  Buffer.alloc(SALT_LENGTH).toString('base64'),
  Buffer.alloc(KEY_LENGTH).toString('base64'),
].join('$');

/**
 * Si lo guardado se cifró con otros parámetros y hay que volver a cifrarlo.
 *
 * Se mira al entrar, que es el único momento en que se tiene la contraseña en
 * claro. Una fila que ni siquiera tiene el formato no se toca: no se ha podido
 * comprobar, así que no hay contraseña buena con la que reescribirla.
 */
export function necesitaRecifrar(stored: string): boolean {
  const parts = stored.split('$');
  return parts.length === 6 && parts.slice(0, 4).join('$') !== parametros();
}

async function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: MAXMEM });
}

/**
 * Lo que cuesta en procesador comprobar lo guardado: `N·r·p`, la cuenta con la
 * que OWASP compara sus cinco combinaciones. Cero si no tiene el formato, que es
 * lo que tarda `verifyPassword` en decir que no.
 */
function costeDe(stored: string): number {
  const [nombre, rawN, rawR, rawP] = stored.split('$');
  const numeros = [rawN, rawR, rawP].map(Number);
  const validos = numeros.every((x) => Number.isInteger(x) && x > 0);
  return nombre === 'scrypt' && validos ? numeros.reduce((a, b) => a * b, 1) : 0;
}

/**
 * Gasta lo que le falte a una comprobación fallida para costar lo de hoy.
 *
 * **El tiempo al entrar delataba las cuentas viejas.** `HASH_DE_NADIE` lleva
 * `p=5` y tarda unos 119 ms; una cuenta cifrada antes de subir los parámetros,
 * con `p=1`, tarda unos 31. Con la contraseña mal, la diferencia se mide desde
 * fuera y dice qué correos tienen cuenta desde hace tiempo y no han vuelto a
 * entrar, que son justo las cuentas más fáciles de robar: nadie mira su correo.
 *
 * Se deriva lo que falta **con los mismos `N` y `r` de hoy y solo el `p` que
 * sobra** —cuatro para una de `p=1—, y no otra comprobación entera contra
 * `HASH_DE_NADIE`: sumar los 119 ms a los 31 dejaría la cuenta vieja en 150, que
 * también se distingue. Con la contraseña buena no hace falta: entra y se vuelve
 * a cifrar, y eso ya cuesta lo de hoy.
 *
 * Devuelve el `p` que ha derivado, cero si no hacía falta: es lo que mira el test
 * sin medir tiempos, que en un CI compartido no dicen nada.
 */
export async function igualarCoste(stored: string): Promise<number> {
  const falta = N * R * P - costeDe(stored);
  if (falta <= 0) {
    return 0;
  }
  const p = Math.ceil(falta / (N * R));
  await derive('', Buffer.alloc(SALT_LENGTH), N, R, p);
  return p;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, N, R, P);
  return [parametros(), salt.toString('base64'), key.toString('base64')].join('$');
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
  // Más larga que el tope ya no se guarda ninguna, así que no puede ser la buena:
  // se dice que no sin gastar `scrypt` en ella. Una de antes del tope que lo
  // pasara —mil caracteres a mano— tendría que pedir el enlace de recuperarla.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
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
