/**
 * El límite de frecuencia respaldado por la base de datos.
 *
 * El de memoria (`rate-limit.ts`) sigue existiendo y sigue siendo el que se usa
 * cuando no hay base de datos, que es la mitad de las veces: un clon recién
 * bajado funciona sin Postgres.
 *
 * Con base de datos, el contador se comparte entre instancias. **Sin esto, el
 * límite real es el escrito multiplicado por cuántos servidores haya**, y quien
 * lo despliega no se entera: los números de la configuración siguen diciendo
 * diez.
 *
 * La cuenta sube y comprueba su tope **en la misma sentencia**, igual que el cupo
 * de la IA. Con dos —leer y luego escribir— dos peticiones simultáneas leen el
 * mismo número y las dos pasan.
 */

import { sql } from 'drizzle-orm';

import { db } from './db/client';
import { rateLimits } from './db/schema';
import {
  DEFAULT_RATE_LIMIT,
  type RateLimitOptions,
  type RateLimitResult,
  type SlidingWindowRateLimiter,
} from './rate-limit';

/**
 * Registra una petición y dice si pasa.
 *
 * Devuelve nulo cuando no hay base de datos o la consulta falla, y quien llama
 * decide qué hacer con eso. **No se falla cerrado**: dejar sin pedir ideas a todo
 * el mundo porque el contador no contesta es peor que el abuso del que defiende,
 * y el cupo del plan —que sí vive en Postgres y sí es la puerta del dinero— sigue
 * en pie de todos modos.
 */
export async function checkRateLimit(
  key: string,
  now: Date,
  options: RateLimitOptions,
): Promise<RateLimitResult | null> {
  const database = db();
  if (database === null) {
    return null;
  }

  const windowStart = new Date(now.getTime() - options.windowMs);

  try {
    const [row] = await database
      .insert(rateLimits)
      .values({ key, windowStart: now, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          // Si la ventana guardada ya ha caducado, esta petición empieza una
          // nueva y el contador vuelve a uno. Si no, suma.
          count: sql`case when ${rateLimits.windowStart} <= ${windowStart} then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${rateLimits.windowStart} <= ${windowStart} then ${now} else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

    if (row === undefined) {
      return null;
    }

    const remaining = Math.max(0, options.limit - row.count);
    if (row.count <= options.limit) {
      return { allowed: true, remaining, retryAfterSeconds: 0 };
    }

    const acaba = row.windowStart.getTime() + options.windowMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((acaba - now.getTime()) / 1000)),
    };
  } catch {
    return null;
  }
}

/**
 * Borra las ventanas que ya no cuentan.
 *
 * La tabla crece con cada dirección que pasa por aquí, así que hay que vaciarla.
 * Se llama de vez en cuando desde las rutas, como el `prune` del de memoria, y no
 * desde una tarea programada: una tarea más que desplegar y vigilar para borrar
 * filas de tres columnas no compensa.
 */
export async function pruneRateLimits(before: Date): Promise<void> {
  const database = db();
  if (database === null) {
    return;
  }
  try {
    await database.delete(rateLimits).where(sql`${rateLimits.windowStart} < ${before}`);
  } catch {
    // Que no se pueda limpiar no puede tumbar la petición que venía a otra cosa.
  }
}

/**
 * Cuánto se espera antes de barrer la tabla, y cada cuánto se barre.
 *
 * Una de cada cincuenta peticiones, más o menos: barrer en todas sería una
 * escritura de más por petición para borrar unas pocas filas, y no barrer nunca
 * deja crecer la tabla con cada dirección que pasa. El «más o menos» sale del
 * contador de peticiones y no de `Math.random`, para que sea previsible.
 */
const CADA_CUANTAS = 50;
let vistas = 0;

/**
 * El límite de frecuencia de una ruta, con base de datos si la hay.
 *
 * Uno u otro y no los dos: con los dos, cada petición contaría en dos sitios y
 * habría que razonar sobre cuál gana. El de memoria queda para las copias sin
 * Postgres, que siguen funcionando enteras menos las cuentas.
 *
 * Si la base de datos no contesta, **se cae al de memoria** en vez de rechazar.
 * Dejar sin usar la aplicación a todo el mundo porque el contador de frecuencia
 * no responde es peor que el abuso del que defiende, y la puerta del dinero —el
 * cupo del plan— sigue en pie de todos modos.
 */
export async function limitRequest(input: {
  readonly memoria: SlidingWindowRateLimiter;
  readonly key: string;
  readonly now: number;
  readonly options?: RateLimitOptions;
}): Promise<RateLimitResult> {
  const options = input.options ?? DEFAULT_RATE_LIMIT;
  const compartido = await checkRateLimit(input.key, new Date(input.now), options);

  if (compartido !== null) {
    vistas += 1;
    if (vistas % CADA_CUANTAS === 0) {
      await pruneRateLimits(new Date(input.now - options.windowMs));
    }
    return compartido;
  }

  input.memoria.prune(input.now);
  return input.memoria.check(input.key, input.now);
}
