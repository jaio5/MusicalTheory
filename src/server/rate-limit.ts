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
      /* v8 ignore next -- se llega aqui porque hay al menos `limit` pulsaciones, asi que hay una primera */
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
 * Cuántos proxies de confianza hay delante, leído de `TRUSTED_PROXY_HOPS`.
 *
 * Cero si no está, si no es un entero o si es negativo: **sin decirlo, no se
 * cree ninguna cabecera**. Un número mal escrito no puede convertirse en fiarse
 * de lo que mande el cliente.
 */
export function saltosDeConfianza(): number {
  const crudo = process.env['TRUSTED_PROXY_HOPS'];
  const n = Number(crudo);
  return crudo === undefined || crudo === '' || !Number.isInteger(n) || n < 0 ? 0 : n;
}

/** La clave de todos cuando no hay de quién fiarse. */
export const SIN_DIRECCION = 'sin-proxy-de-confianza';

let avisado = false;

/**
 * Con qué se identifica a quien pide: la dirección que vio **el último proxy de
 * confianza**, contando desde la derecha de `X-Forwarded-For`.
 *
 * Antes se tomaba la primera de la cadena, y esa la escribe el cliente: con doce
 * peticiones cambiando la cabecera, cada una tenía su propio contador y el tope
 * no paraba a nadie. Cada proxy **añade** a la derecha la dirección de quien le
 * habló, así que lo único fiable es lo que añadieron los nuestros: con un proxy
 * delante, la última; con dos —una CDN y un nginx—, la penúltima. Lo de su
 * izquierda puede ser cualquier cosa.
 *
 * **Sin `TRUSTED_PROXY_HOPS` no se cree ninguna cabecera**, ni esta ni
 * `X-Real-IP`, y todo el mundo comparte un contador. No hay alternativa mejor:
 * `next start` pone `X-Forwarded-For` con la dirección del socket **solo si no
 * venía ya** (`??=` en `base-server.js`), así que desde aquí no se distingue la
 * que puso Next de la que escribió el cliente. Un contador compartido frena de
 * más; uno por cabecera no frena nada. En producción se avisa una vez en el
 * registro, porque frenar de más sin decirlo parecería una avería.
 */
export function requesterKey(headers: Headers): string {
  const saltos = saltosDeConfianza();
  if (saltos === 0) {
    if (!avisado && process.env.NODE_ENV === 'production') {
      avisado = true;
      console.warn(
        '[límite de frecuencia] sin TRUSTED_PROXY_HOPS no se cree X-Forwarded-For: todas las peticiones comparten contador. Ver docs/DESPLIEGUE.md.',
      );
    }
    return SIN_DIRECCION;
  }

  const cadena = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((trozo) => trozo.trim())
    .filter((trozo) => trozo !== '');
  // Con menos entradas que proxies, la más a la izquierda: es la que puso el
  // primero de los nuestros que la recibió. Sin ninguna, nadie la puso, y eso en
  // un despliegue con proxy es un proxy mal configurado, no un cliente.
  return cadena[Math.max(0, cadena.length - saltos)] ?? 'desconocido';
}
