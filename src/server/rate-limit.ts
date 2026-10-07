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

import { createHash } from 'node:crypto';

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
  return proxyDeclarado() ? Number(process.env['TRUSTED_PROXY_HOPS']) : 0;
}

/**
 * Si quien despliega ha dicho cuántos proxies hay, **cero incluido**.
 *
 * `TRUSTED_PROXY_HOPS=0` y no ponerla se comportan igual —nadie se cree la
 * cabecera—, pero no significan lo mismo: el cero es «sé que no hay proxy y
 * acepto un contador para todos», y no ponerla suele ser olvido. Solo lo segundo
 * merece el aviso de arranque ([adr/0113](../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 */
export function proxyDeclarado(): boolean {
  const crudo = process.env['TRUSTED_PROXY_HOPS'];
  return crudo !== undefined && /^\d+$/.test(crudo.trim());
}

/**
 * Lo que se escribe en el registro al arrancar en producción sin decir cuántos
 * proxies hay, o nulo si no hace falta decir nada.
 *
 * **No se niega a arrancar**, y es una decisión pesada en
 * [adr/0113](../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md):
 * el Docker de casa sirve en producción sin proxy delante, y ahí no hay valor
 * correcto que poner. Pero tampoco pasa en silencio: con un contador para todo el
 * mundo, diez peticiones de cualquiera dejan sin IA, sin registro y sin entrar a
 * todos los demás durante un minuto. Por eso el aviso es un bloque de error y no
 * una línea más, y se repite en cada arranque.
 */
export function avisoDeProxy(): string | null {
  if (process.env.NODE_ENV !== 'production' || proxyDeclarado()) {
    return null;
  }
  const crudo = process.env['TRUSTED_PROXY_HOPS'];
  const porque =
    crudo === undefined || crudo.trim() === ''
      ? 'TRUSTED_PROXY_HOPS no está puesta'
      : `TRUSTED_PROXY_HOPS=«${crudo}» no es un entero no negativo`;
  return [
    '',
    '################################################################################',
    `# AVISO: ${porque}.`,
    '# No se cree X-Forwarded-For y TODAS las peticiones comparten un solo contador:',
    '# diez peticiones de cualquiera dejan sin IA, sin registro y sin entrar a todos.',
    '# Detrás de un proxy, pon cuántos hay (1 con nginx, Caddy o Vercel).',
    '# Sin proxy y a sabiendas, pon TRUSTED_PROXY_HOPS=0 y este aviso se calla.',
    '# Ver docs/DESPLIEGUE.md, «Detrás de un proxy».',
    '################################################################################',
    '',
  ].join('\n');
}

/** Escribe el aviso de arriba, si toca. Lo llama `src/instrumentation.ts` al arrancar. */
export function avisarSiFaltaElProxy(): void {
  const aviso = avisoDeProxy();
  if (aviso !== null) {
    console.error(aviso);
  }
}

/** La clave de todos cuando no hay de quién fiarse. */
export const SIN_DIRECCION = 'sin-proxy-de-confianza';

let avisado = false;

/** Cuatro números de 0 a 255 separados por puntos, o nulo si no es eso. */
function octetos(texto: string): number[] | null {
  const partes = texto.split('.');
  if (partes.length !== 4 || !partes.every((p) => /^\d{1,3}$/.test(p))) {
    return null;
  }
  const numeros = partes.map(Number);
  return numeros.every((n) => n <= 255) ? numeros : null;
}

/**
 * Los ocho grupos de una IPv6, o nulo si no lo es.
 *
 * Acepta la forma comprimida (`::`) y la que lleva una IPv4 al final
 * (`::ffff:192.0.2.1`). Escrita a mano y no con `net.isIPv6` porque lo que hace
 * falta no es saber si es válida, sino **sus grupos**, para quedarse con el /64.
 */
function gruposIPv6(texto: string): number[] | null {
  const ultimo = texto.lastIndexOf(':');
  let cabeza = texto;
  const cola: number[] = [];
  if (texto.slice(ultimo + 1).includes('.')) {
    const v4 = octetos(texto.slice(ultimo + 1));
    if (v4 === null) {
      return null;
    }
    cola.push(v4[0]! * 256 + v4[1]!, v4[2]! * 256 + v4[3]!);
    // `::1.2.3.4` deja `:` y hay que devolverle los dos puntos de la compresión;
    // `::ffff:1.2.3.4` deja `::ffff`, que ya está bien.
    cabeza = texto.slice(0, ultimo);
    if (cabeza.endsWith(':')) {
      cabeza += ':';
    }
  }

  const mitades = cabeza.split('::');
  if (mitades.length > 2) {
    return null;
  }
  const leer = (trozo: string) => (trozo === '' ? [] : trozo.split(':'));
  const izquierda = leer(mitades[0]!);
  const derecha = mitades.length === 2 ? leer(mitades[1]!) : [];
  if (![...izquierda, ...derecha].every((g) => /^[0-9a-f]{1,4}$/.test(g))) {
    return null;
  }

  const escritos = izquierda.length + derecha.length + cola.length;
  const comprimido = mitades.length === 2;
  if (comprimido ? escritos > 7 : escritos !== 8) {
    return null;
  }
  const ceros: number[] = Array.from({ length: 8 - escritos }, () => 0);
  return [
    ...izquierda.map((g) => parseInt(g, 16)),
    ...ceros,
    ...derecha.map((g) => parseInt(g, 16)),
    ...cola,
  ];
}

/** Lo más que se guarda de una dirección que no se ha sabido leer. */
const MAX_DIRECCION = 64;

/**
 * La dirección tal y como cuenta para un tope: una IPv4 entera, **una IPv6 por
 * su /64**.
 *
 * Una conexión doméstica o un servidor alquilado reciben un /64 entero —dieciocho
 * trillones de direcciones— y cambiar de una a otra es gratis. Contando por
 * dirección suelta, cien IPv6 del mismo /64 eran cien contadores, y el tope no
 * paraba a nadie: lo reprodujeron tres auditorías, contra entrar, contra la IA y
 * contra las métricas ([adr/0113](../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 *
 * Antes de agrupar se normaliza lo que puede escribirse de varias maneras: los
 * corchetes y el puerto (`[2001:db8::1]:443`, `192.0.2.1:8080`), la zona
 * (`fe80::1%eth0`), las mayúsculas, los ceros comprimidos y **una IPv4 escrita
 * como IPv6** (`::ffff:192.0.2.1`), que es la misma máquina y vuelve a ser IPv4.
 * Lo que no se sabe leer se queda como está, recortado: viene de nuestro proxy, y
 * si no es una dirección es un proxy mal configurado, no algo que agrupar.
 */
export function agruparDireccion(cruda: string): string {
  let texto = cruda.trim().toLowerCase();
  const entreCorchetes = /^\[([^\]]*)\](?::\d+)?$/.exec(texto);
  if (entreCorchetes !== null) {
    texto = entreCorchetes[1]!;
  } else if (/^[\d.]+:\d+$/.test(texto)) {
    texto = texto.slice(0, texto.lastIndexOf(':'));
  }
  const zona = texto.indexOf('%');
  if (zona !== -1) {
    texto = texto.slice(0, zona);
  }

  const v4 = octetos(texto);
  if (v4 !== null) {
    return v4.join('.');
  }
  const grupos = texto.includes(':') ? gruposIPv6(texto) : null;
  if (grupos === null) {
    return texto.slice(0, MAX_DIRECCION);
  }
  const mapeada = grupos.slice(0, 5).every((g) => g === 0) && grupos[5] === 0xffff;
  if (mapeada) {
    return [grupos[6]! >> 8, grupos[6]! & 255, grupos[7]! >> 8, grupos[7]! & 255].join('.');
  }
  return `${grupos
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}

/**
 * Con qué se identifica a quien pide: la dirección que vio **el último proxy de
 * confianza**, contando desde la derecha de `X-Forwarded-For`, y agrupada por
 * `agruparDireccion` —una IPv6 cuenta por su /64—.
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
 * más; uno por cabecera no frena nada. En producción se avisa al arrancar
 * (`avisoDeProxy`) y otra vez aquí, la primera vez que pasa.
 */
export function requesterKey(headers: Headers): string {
  const saltos = saltosDeConfianza();
  if (saltos === 0) {
    if (!avisado && process.env.NODE_ENV === 'production' && !proxyDeclarado()) {
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
  const vista = cadena[Math.max(0, cadena.length - saltos)];
  return vista === undefined ? 'desconocido' : agruparDireccion(vista);
}

/** La huella de un texto, corta: para claves, no para guardar secretos. */
function huella(texto: string): string {
  return createHash('sha256').update(texto).digest('hex').slice(0, 32);
}

/**
 * El correo de un tope, convertido en una huella de largo fijo.
 *
 * **Antes iba entero en la clave**, y la clave es la columna con índice único de
 * `rate_limits`: un correo de 4 MB reventaba el índice —Postgres no indexa filas
 * de más de 8 KB—, el error se tragaba y el tope caía al contador de memoria, que
 * es por proceso y guardaba esos megas un cuarto de hora. Veinte peticiones así
 * llevaban el proceso de 46 a 687 MB.
 *
 * Normalizado como se guarda —minúsculas y sin espacios alrededor— para que
 * «A@b.com» y «a@b.com» sigan siendo el mismo cupo, y con huella para que la
 * tabla de topes no sea además una lista de correos en claro. Lo que no es una
 * cadena cuenta como la cadena vacía: el mismo cupo para todo lo raro.
 */
export function huellaDeCorreo(correo: unknown): string {
  return huella(typeof correo === 'string' ? correo.trim().toLowerCase() : '');
}

/** Lo más largo que puede ser una clave antes de cambiarla por su huella. */
export const MAX_CLAVE = 200;

/**
 * La clave tal cual, o su huella si es más larga que `MAX_CLAVE`.
 *
 * Es la red de debajo de `huellaDeCorreo`: quien forme una clave con algo que
 * llega de fuera y se olvide de acotarlo no vuelve a reventar el índice ni a
 * guardar megas en memoria. Se aplica en `limitRequest`, que es por donde pasan
 * todas.
 */
export function acotarClave(clave: string): string {
  return clave.length <= MAX_CLAVE ? clave : `huella:${huella(clave)}`;
}
