/**
 * Límite de frecuencia de las rutas de IA.
 *
 * Cada petición cuesta dinero, y la interfaz tiene botones que invitan a
 * pulsarlos seguidos. El contrato ya declaraba `rate_limited`; esto es quien lo
 * emite.
 *
 * Es una ventana deslizante en memoria, con el reloj por parámetro para poder
 * probarla. Va aparte del handler porque así se prueba sin levantar el
 * servidor ni tocar el modelo.
 *
 * **Esto es el límite por minuto, no el cupo del plan.** Son dos cosas distintas
 * y las dos hacen falta: esto defiende de pulsar veinte veces el mismo botón, y
 * el cupo diario de `ai-usage.ts` defiende de pasarse la tarde gastando. Este no
 * sabe de planes a propósito: aunque pagues, no hay motivo para hacer diez
 * peticiones en un segundo.
 */

export interface RateLimitOptions {
  /** Cuántas peticiones caben en la ventana. */
  readonly limit: number;
  readonly windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 };

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Cuántas quedan en esta ventana. */
  readonly remaining: number;
  /** Segundos que hay que esperar. Cero si se puede pasar. */
  readonly retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  readonly #hits = new Map<string, number[]>();
  readonly #options: RateLimitOptions;

  constructor(options: RateLimitOptions = DEFAULT_RATE_LIMIT) {
    this.#options = options;
  }

  /** Registra una petición y dice si pasa. */
  check(key: string, now: number): RateLimitResult {
    const { limit, windowMs } = this.#options;
    const since = now - windowMs;

    const recent = (this.#hits.get(key) ?? []).filter((at) => at > since);

    if (recent.length >= limit) {
      this.#hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }

    recent.push(now);
    this.#hits.set(key, recent);
    return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
  }

  /**
   * Suelta las entradas que ya no cuentan. El handler la llama de vez en
   * cuando: sin esto, el mapa crece con cada dirección que pasa por aquí.
   */
  prune(now: number): void {
    const since = now - this.#options.windowMs;
    for (const [key, hits] of this.#hits) {
      const recent = hits.filter((at) => at > since);
      if (recent.length === 0) {
        this.#hits.delete(key);
      } else {
        this.#hits.set(key, recent);
      }
    }
  }

  get size(): number {
    return this.#hits.size;
  }
}

/**
 * Con qué se identifica a quien pide. La cabecera puede traer una cadena de
 * proxies: la primera es la del cliente.
 *
 * No es a prueba de nada —quien quiera saltárselo puede— pero no es eso lo que
 * defiende: defiende de pulsar el botón veinte veces seguidas.
 */
export function requesterKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded !== null && forwarded !== '') {
    return forwarded.split(',')[0]?.trim() ?? 'desconocido';
  }
  return headers.get('x-real-ip') ?? 'desconocido';
}
