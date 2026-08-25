/**
 * Comprobar que un webhook viene de verdad de Stripe.
 *
 * Sin el SDK de Stripe, con `crypto` de la biblioteca estándar. Es la misma
 * razón que hay detrás de `password.ts` —`scrypt` en vez de bcrypt— y de
 * [adr/0002](../../../docs/adr/0002-deteccion-de-tono-propia.md): el SDK entero
 * para calcular un HMAC de veinte líneas es una dependencia que hay que
 * actualizar, auditar y cargar en el arranque de una ruta.
 *
 * **Esto es lo único que separa cambiar el plan de alguien que ha pagado de
 * cambiárselo a cualquiera que sepa la dirección del webhook.** Un webhook sin
 * comprobar es un formulario público para darse el plan Pro, y por eso todo lo
 * de este fichero es puro y está probado a fondo.
 *
 * Stripe manda la firma en una cabecera con esta forma:
 *
 * ```
 * Stripe-Signature: t=1492774577,v1=5257a869e7...,v1=otra
 * ```
 *
 * Y firma la cadena `${t}.${cuerpo}` con HMAC-SHA256 y el secreto del endpoint.
 * Puede venir más de un `v1` mientras se rota el secreto, así que valen todas.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cuánto se acepta de diferencia entre el reloj de Stripe y el nuestro.
 *
 * Cinco minutos, que es lo que recomienda Stripe. No es margen para relojes mal
 * puestos: es lo que impide que alguien que haya capturado una petición válida
 * la repita mañana. Sin este tope, una firma correcta vale para siempre.
 */
export const TOLERANCE_SECONDS = 300;

interface ParsedSignature {
  readonly timestamp: number;
  readonly signatures: readonly string[];
}

/**
 * Parte la cabecera. Devuelve nulo si no tiene la forma esperada.
 *
 * Lo que no entiende se ignora en vez de rechazarse: Stripe manda también `v0`
 * para otra cosa, y una versión nueva de la firma no debe tumbar las que sí
 * sabemos comprobar.
 */
export function parseSignatureHeader(header: unknown): ParsedSignature | null {
  if (typeof header !== 'string' || header === '') {
    return null;
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const at = part.indexOf('=');
    if (at < 0) {
      continue;
    }
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();

    if (key === 't') {
      const parsed = Number(value);
      // Segundos desde epoch. Un `t` que no es un número entero positivo no es
      // una marca de tiempo, y tratarlo como cero abriría la puerta a firmas
      // sin caducidad.
      timestamp = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    } else if (key === 'v1' && value !== '') {
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }
  return { timestamp, signatures };
}

/** Compara dos hexadecimales sin que el tiempo diga cuántos caracteres coinciden. */
function sameSignature(a: string, b: string): boolean {
  // Distinta longitud no se puede comparar en tiempo constante, y tampoco hace
  // falta: la longitud de un HMAC-SHA256 no es secreta.
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export type SignatureVerdict = 'ok' | 'sin-firma' | 'caducada' | 'no-cuadra';

/**
 * Si ese cuerpo, con esa cabecera, lo ha firmado quien tiene el secreto.
 *
 * `body` es el **texto crudo** de la petición, no el objeto ya interpretado.
 * Volver a serializar el JSON cambia los espacios y el orden de las claves, y la
 * firma deja de cuadrar: es el fallo clásico de esta integración, y por eso la
 * ruta lee `request.text()` y no `request.json()`.
 *
 * El instante entra por parámetro, como en todo el dominio de este proyecto, y
 * eso es lo que permite probar la caducidad sin esperar cinco minutos.
 */
export function verifyStripeSignature(input: {
  readonly body: string;
  readonly header: unknown;
  readonly secret: string;
  /** Segundos desde epoch. */
  readonly now: number;
  readonly toleranceSeconds?: number;
}): SignatureVerdict {
  const parsed = parseSignatureHeader(input.header);
  if (parsed === null || input.secret === '') {
    return 'sin-firma';
  }

  const tolerance = input.toleranceSeconds ?? TOLERANCE_SECONDS;
  // En valor absoluto: una marca de tiempo en el futuro es tan sospechosa como
  // una vieja, y solo puede venir de un reloj mal puesto o de alguien probando.
  if (Math.abs(input.now - parsed.timestamp) > tolerance) {
    return 'caducada';
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${parsed.timestamp}.${input.body}`)
    .digest('hex');

  return parsed.signatures.some((signature) => sameSignature(signature, expected))
    ? 'ok'
    : 'no-cuadra';
}
