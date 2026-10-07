/**
 * El tope de frecuencia de lo que escribe una cuenta: el avance y las canciones.
 *
 * Esas rutas ya piden cuenta y plan, pero no tenían tope, y cada petición es una
 * escritura en Postgres con un documento de hasta 128 KB. Un bucle en la consola
 * con la sesión de alguien llenaba el disco y la conexión, que es **una sola** por
 * instancia (`db/client.ts`), así que lo pagaban todos los demás (adr/0116).
 *
 * **Se cuenta por cuenta y no por dirección**: quien escribe es la cuenta, y con
 * dirección todo el mundo comparte contador si no hay `TRUSTED_PROXY_HOPS`. Lo de
 * delante —la sesión— ya está comprobado cuando se llega aquí.
 *
 * Los números son holgados a propósito. El avance se sube al terminar cada cosa
 * —una unidad, un repaso, una respuesta fallada— y una ráfaga de respuestas
 * rápidas no puede quedarse fuera; si alguna se frena, no se pierde nada: el
 * navegador se queda con lo suyo y la siguiente subida lo arrastra
 * (`subir-avance.ts`).
 */

import type { NextResponse } from 'next/server';

import { tooManyRequests } from './api-response';
import { limitRequest } from './rate-limit-db';
import { SlidingWindowRateLimiter, type RateLimitOptions } from './rate-limit';

/** Sesenta subidas del avance por minuto y cuenta: una por segundo, sin parar. */
export const TOPE_DEL_AVANCE: RateLimitOptions = { limit: 60, windowMs: 60_000 };

/** Treinta guardados de canción por minuto y cuenta, entre crear y escribir encima. */
export const TOPE_DE_CANCIONES: RateLimitOptions = { limit: 30, windowMs: 60_000 };

/** Un contador en memoria por cada uso, para cuando no hay Postgres que lo comparta. */
const enMemoria = new Map<string, SlidingWindowRateLimiter>();

/**
 * El 429 que toca, o nulo si esta petición de esta cuenta puede pasar.
 *
 * `para` va en la clave por lo mismo que en `esperaPorFrecuencia`: guardar
 * canciones y subir el avance son dos topes, y gastar uno no puede gastar el otro.
 */
export async function frenoPorCuenta(
  para: string,
  userId: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): Promise<NextResponse | null> {
  let memoria = enMemoria.get(para);
  if (memoria === undefined) {
    memoria = new SlidingWindowRateLimiter(options);
    enMemoria.set(para, memoria);
  }
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria,
    key: `${para}:cuenta:${userId}`,
    now,
    options,
  });
  return allowed ? null : tooManyRequests(retryAfterSeconds);
}
