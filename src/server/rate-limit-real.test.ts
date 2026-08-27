import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as RateLimitDb from './rate-limit-db';
import { SlidingWindowRateLimiter } from './rate-limit';

/**
 * El límite de frecuencia contra Postgres de verdad.
 *
 * Existe porque el otro test de esto —`rate-limit-db.test.ts`— lee el código
 * fuente para comprobar que no se cuela un `Date` dentro de una plantilla `sql`,
 * y eso fue lo que se pudo hacer mientras no había forma de levantar una base de
 * datos en un test. Ahora la hay, así que esto ejecuta la sentencia.
 *
 * **Y era justo el sitio donde hacía falta.** La sentencia estuvo mal una fase
 * entera: fallaba, el `catch` se la tragaba, el límite caía al de memoria y desde
 * fuera todo funcionaba sin compartir nada entre instancias. Un test que la
 * ejecuta es lo único que lo habría visto.
 */

let base: BaseDePrueba;
let limitador: typeof RateLimitDb;

const AHORA = Date.UTC(2026, 7, 25, 18, 0, 0);
const VENTANA = { limit: 3, windowMs: 60_000 };

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  limitador = await import('./rate-limit-db');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});

/** Un limitador de memoria nuevo, para que no arrastre nada entre tests. */
function memoria(): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(VENTANA);
}

function pedir(key: string, now: number, mem = memoria()) {
  return limitador.limitRequest({ memoria: mem, key, now, options: VENTANA });
}

describe('contar contra la base de datos', () => {
  it('la sentencia se ejecuta: cuenta y sobra una menos cada vez', async () => {
    const primera = await pedir('ip:1', AHORA);
    const segunda = await pedir('ip:1', AHORA);

    expect(primera).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    expect(segunda).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
  });

  it('pasado el tope se rechaza, y se dice cuánto falta', async () => {
    for (let i = 0; i < 3; i += 1) {
      await pedir('ip:2', AHORA);
    }

    const pasada = await pedir('ip:2', AHORA + 10_000);

    expect(pasada.allowed).toBe(false);
    expect(pasada.remaining).toBe(0);
    // La ventana empezó hace diez segundos y dura sesenta.
    expect(pasada.retryAfterSeconds).toBe(50);
  });

  it('cada clave cuenta por su lado', async () => {
    await pedir('ip:3', AHORA);
    await pedir('ip:3', AHORA);

    expect((await pedir('ip:4', AHORA)).remaining).toBe(2);
  });

  it('el contador se comparte: dos instancias suman en el mismo sitio', async () => {
    // Es la razón de que esto exista. Cada llamada lleva su propio limitador de
    // memoria —son dos servidores distintos— y aun así la cuenta es una.
    await pedir('ip:5', AHORA, memoria());
    await pedir('ip:5', AHORA, memoria());
    await pedir('ip:5', AHORA, memoria());

    expect((await pedir('ip:5', AHORA, memoria())).allowed).toBe(false);
  });

  it('caducada la ventana, se empieza de cero', async () => {
    for (let i = 0; i < 3; i += 1) {
      await pedir('ip:6', AHORA);
    }

    const despues = await pedir('ip:6', AHORA + 60_001);

    expect(despues).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
  });

  it('sin base de datos se cae al de memoria en vez de rechazar', async () => {
    // Dejar sin usar la aplicación a todo el mundo porque el contador no
    // contesta es peor que el abuso del que defiende, y la puerta del dinero
    // —el cupo del plan— sigue en pie de todos modos.
    const guardada = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    const mem = memoria();

    try {
      const primera = await pedir('ip:7', AHORA, mem);
      const segunda = await pedir('ip:7', AHORA, mem);

      expect(primera.allowed).toBe(true);
      expect(segunda.remaining).toBe(1);
    } finally {
      process.env['DATABASE_URL'] = guardada;
    }
  });
});

describe('vaciar la tabla', () => {
  it('se barre de vez en cuando, no en cada petición', async () => {
    // Una de cada cincuenta: barrer siempre sería una escritura de más por
    // petición para borrar unas pocas filas, y no barrer nunca deja crecer la
    // tabla con cada dirección que pasa por aquí.
    for (let i = 0; i < 60; i += 1) {
      await pedir(`ip:barrido:${i}`, AHORA);
    }

    // Lo que se comprueba es que el barrido corre sin lanzar y sin borrar lo que
    // aún cuenta: la clave de arriba sigue con su ventana viva.
    expect((await pedir('ip:barrido:0', AHORA)).remaining).toBe(1);
  });
});
