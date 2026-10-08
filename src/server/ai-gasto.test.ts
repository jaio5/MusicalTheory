import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Gasto from './ai-gasto';

/**
 * El techo de gasto de todos, contra Postgres de verdad (adr/0114).
 *
 * Su corrección la sostiene una sentencia —los cuatro topes en el `where` del
 * `on conflict`—, así que se prueba como el cupo: con la base delante y con
 * peticiones a la vez, que es justo lo que una comprobación en dos pasos deja
 * pasar.
 */

let base: BaseDePrueba;
let gasto: typeof Gasto;

const HOY = new Date('2026-10-07T12:00:00Z');
const MAÑANA = new Date('2026-10-08T12:00:00Z');
const OTRO_MES = new Date('2026-11-01T00:30:00Z');

const VARIABLES = [
  'IA_TOPE_DIARIO_USD',
  'IA_TOPE_MENSUAL_USD',
  'IA_TOPE_GRATIS_DIARIO_USD',
  'IA_TOPE_GRATIS_MENSUAL_USD',
];

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  gasto = await import('./ai-gasto');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});
afterEach(() => {
  for (const v of VARIABLES) {
    delete process.env[v];
  }
});

/** Topes en dólares, para leerlos de un vistazo. */
function topes(diario: number, mensual: number, gratisDiario: number, gratisMensual: number) {
  process.env['IA_TOPE_DIARIO_USD'] = String(diario);
  process.env['IA_TOPE_MENSUAL_USD'] = String(mensual);
  process.env['IA_TOPE_GRATIS_DIARIO_USD'] = String(gratisDiario);
  process.env['IA_TOPE_GRATIS_MENSUAL_USD'] = String(gratisMensual);
}

const DOLAR = 1_000_000;

describe('los topes', () => {
  it('de serie, prudentes y con lo gratis por debajo', () => {
    const t = gasto.topesDeGasto();

    expect(t).toEqual({
      diario: 10 * DOLAR,
      mensual: 150 * DOLAR,
      gratisDiario: 2 * DOLAR,
      gratisMensual: 30 * DOLAR,
    });
    expect(t.gratisDiario).toBeLessThan(t.diario);
    expect(t.gratisMensual).toBeLessThan(t.mensual);
  });

  it('del entorno, en dólares; lo que no se entiende no apaga el tope', () => {
    process.env['IA_TOPE_DIARIO_USD'] = '2.5';
    process.env['IA_TOPE_MENSUAL_USD'] = 'diez';
    process.env['IA_TOPE_GRATIS_DIARIO_USD'] = '-1';
    process.env['IA_TOPE_GRATIS_MENSUAL_USD'] = '0';

    expect(gasto.topesDeGasto()).toEqual({
      diario: 2.5 * DOLAR,
      mensual: 150 * DOLAR,
      gratisDiario: 2 * DOLAR,
      // Cero vale, y cierra lo gratis.
      gratisMensual: 0,
    });
  });
});

describe('reservar', () => {
  /**
   * **El ataque**: muchas peticiones a la vez. Leer y luego escribir las dejaría
   * pasar todas; la sentencia única deja pasar exactamente las que caben.
   */
  it('cien a la vez no pasan del tope', async () => {
    topes(1, 100, 1, 100);
    const resultados = await Promise.all(
      Array.from({ length: 100 }, () => gasto.reservarGasto(30_000, false, HOY)),
    );

    // 1 $ entre 0,03 $: treinta y tres caben, ni una más.
    expect(resultados.filter((r) => r.kind === 'ok')).toHaveLength(33);
    expect(resultados.find((r) => r.kind === 'tope')).toEqual({
      kind: 'tope',
      quien: 'todos',
      cuando: 'dia',
    });
    expect((await gasto.gastoDelMes(HOY))?.micros).toBe(33 * 30_000);
  });

  it('lo gratis tiene su techo, más bajo, y no cierra lo que se paga', async () => {
    topes(10, 100, 0.1, 100);

    const gratis = [];
    for (let i = 0; i < 5; i += 1) {
      gratis.push(await gasto.reservarGasto(30_000, true, HOY));
    }
    expect(gratis.map((r) => r.kind)).toEqual(['ok', 'ok', 'ok', 'tope', 'tope']);
    expect(gratis[3]).toEqual({ kind: 'tope', quien: 'gratis', cuando: 'dia' });

    expect((await gasto.reservarGasto(30_000, false, HOY)).kind).toBe('ok');
  });

  it('el día se renueva y el mes sigue; el mes nuevo empieza de cero', async () => {
    topes(0.1, 0.15, 10, 10);
    for (let i = 0; i < 3; i += 1) {
      await gasto.reservarGasto(30_000, false, HOY);
    }
    expect(await gasto.reservarGasto(30_000, false, HOY)).toMatchObject({ cuando: 'dia' });

    // Mañana el día está a cero, pero el mes lleva 0,09 y caben dos más.
    expect((await gasto.reservarGasto(30_000, false, MAÑANA)).kind).toBe('ok');
    expect((await gasto.reservarGasto(30_000, false, MAÑANA)).kind).toBe('ok');
    expect(await gasto.reservarGasto(30_000, false, MAÑANA)).toEqual({
      kind: 'tope',
      quien: 'todos',
      cuando: 'mes',
    });

    expect((await gasto.reservarGasto(30_000, false, OTRO_MES)).kind).toBe('ok');
  });

  it('el mes de lo gratis también cierra', async () => {
    topes(10, 10, 10, 0.05);
    expect((await gasto.reservarGasto(30_000, true, HOY)).kind).toBe('ok');
    expect(await gasto.reservarGasto(30_000, true, MAÑANA)).toEqual({
      kind: 'tope',
      quien: 'gratis',
      cuando: 'mes',
    });
  });

  it('lo que no cabe ni con todo a cero no llega a la base', async () => {
    topes(0.01, 1, 1, 1);
    expect(await gasto.reservarGasto(30_000, false, HOY)).toEqual({
      kind: 'tope',
      quien: 'todos',
      cuando: 'dia',
    });
    expect(await gasto.gastoDelMes(HOY)).toBeNull();
  });

  it('si la base no contesta, no se sirve', async () => {
    await base.ejecutar('alter table ai_gasto rename to ai_gasto_roto');
    try {
      expect(await gasto.reservarGasto(1, false, HOY)).toEqual({ kind: 'sin-contador' });
      // Y asentar no revienta: la reserva se queda, que es contar de más.
      await gasto.asentarGasto({ mes: '2026-10', dia: '2026-10-07', micros: 5, gratis: false }, 0);
      expect(await gasto.gastoDelMes(HOY)).toBeNull();
    } finally {
      await base.ejecutar('alter table ai_gasto_roto rename to ai_gasto');
    }
  });
});

describe('asentar lo gastado de verdad', () => {
  it('cambia la reserva por lo real, en el mes, el día y lo gratis', async () => {
    topes(1, 1, 1, 1);
    const r = await gasto.reservarGasto(30_000, true, HOY);
    if (r.kind !== 'ok') {
      throw new Error(r.kind);
    }

    await gasto.asentarGasto(r.reserva, 4_321);

    expect(await gasto.gastoDelMes(HOY)).toMatchObject({
      micros: 4_321,
      diaMicros: 4_321,
      gratisMicros: 4_321,
      gratisDiaMicros: 4_321,
    });
  });

  it('lo de pago no toca lo gratis; devolver deja el contador como estaba', async () => {
    topes(1, 1, 1, 1);
    const r = await gasto.reservarGasto(30_000, false, HOY);
    if (r.kind !== 'ok') {
      throw new Error(r.kind);
    }

    await gasto.devolverGasto(r.reserva);

    expect(await gasto.gastoDelMes(HOY)).toMatchObject({ micros: 0, gratisMicros: 0 });
  });

  it('pasada la medianoche, el día de hoy no se toca', async () => {
    topes(1, 1, 1, 1);
    const ayer = await gasto.reservarGasto(30_000, false, HOY);
    await gasto.reservarGasto(10_000, false, MAÑANA);
    if (ayer.kind !== 'ok') {
      throw new Error(ayer.kind);
    }

    await gasto.asentarGasto(ayer.reserva, 0);

    expect(await gasto.gastoDelMes(MAÑANA)).toMatchObject({ micros: 10_000, diaMicros: 10_000 });
  });

  it('si se pasó de lo reservado, también lo cuenta', async () => {
    topes(1, 1, 1, 1);
    const r = await gasto.reservarGasto(1_000, false, HOY);
    if (r.kind !== 'ok') {
      throw new Error(r.kind);
    }

    await gasto.asentarGasto(r.reserva, 1_500);

    expect((await gasto.gastoDelMes(HOY))?.micros).toBe(1_500);
  });
});

describe('cuándo vuelve a abrir', () => {
  it('a medianoche UTC, o el día uno', () => {
    expect(gasto.segundosHastaQueAbra('dia', new Date('2026-10-07T23:59:00Z'))).toBe(60);
    expect(gasto.segundosHastaQueAbra('mes', new Date('2026-12-31T23:00:00Z'))).toBe(3600);
  });
});

describe('sin base de datos', () => {
  it('no hay contador, y no se sirve', async () => {
    const url = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      expect(await gasto.reservarGasto(1, false, HOY)).toEqual({ kind: 'sin-contador' });
      expect(await gasto.gastoDelMes(HOY)).toBeNull();
      await gasto.asentarGasto({ mes: '2026-10', dia: '2026-10-07', micros: 1, gratis: false }, 0);
    } finally {
      process.env['DATABASE_URL'] = url;
    }
  });
});

describe('quién cierra', () => {
  const t = { diario: 10, mensual: 100, gratisDiario: 5, gratisMensual: 50 };
  const fila = { micros: 0, dia: '2026-10-07', diaMicros: 0, gratisMicros: 0, gratisDiaMicros: 0 };
  const DIA = fila.dia;

  /**
   * Cada tope, **justo en el borde y uno por encima**: llegar al tope cabe,
   * pasarse no. Un `>=` en vez de `>` cerraría un céntimo antes, y uno de los
   * topes saltado dejaría la razón a otro; las dos cosas pasaban con los tests de
   * arriba, que van por la base y no miran por qué cierra.
   */
  it.each([
    ['todos', 'mes', { ...fila, micros: 95 }, false],
    ['todos', 'dia', { ...fila, micros: 5, diaMicros: 5 }, false],
    ['gratis', 'mes', { ...fila, micros: 45, gratisMicros: 45 }, true],
    ['gratis', 'dia', fila, true],
  ] as const)('%s, por el %s: llegar al tope cabe, pasarse no', (quien, cuando, lleva, gratis) => {
    expect(gasto.topeQueCierra(lleva, 5, gratis, DIA, t)).toBeNull();
    expect(gasto.topeQueCierra(lleva, 6, gratis, DIA, t)).toEqual({ quien, cuando });
  });

  it('lo de pago no mira los topes de lo gratis', () => {
    expect(
      gasto.topeQueCierra({ ...fila, gratisMicros: 50, gratisDiaMicros: 5 }, 1, false, DIA, t),
    ).toBeNull();
  });

  it('el de todos manda sobre el de lo gratis, y el mes sobre el día', () => {
    const llena = { micros: 100, dia: DIA, diaMicros: 10, gratisMicros: 50, gratisDiaMicros: 5 };
    expect(gasto.topeQueCierra(llena, 1, true, DIA, t)).toEqual({ quien: 'todos', cuando: 'mes' });
    expect(gasto.topeQueCierra({ ...llena, micros: 0 }, 1, true, DIA, t)).toEqual({
      quien: 'todos',
      cuando: 'dia',
    });
    expect(gasto.topeQueCierra({ ...llena, micros: 0, diaMicros: 0 }, 1, true, DIA, t)).toEqual({
      quien: 'gratis',
      cuando: 'mes',
    });
  });

  it('sin fila, solo cuenta lo que se pide', () => {
    expect(gasto.topeQueCierra(null, 5, true, DIA, t)).toBeNull();
    expect(gasto.topeQueCierra(null, 6, true, DIA, t)).toEqual({ quien: 'gratis', cuando: 'dia' });
    expect(gasto.topeQueCierra(null, 10, false, DIA, t)).toBeNull();
    expect(gasto.topeQueCierra(null, 11, false, DIA, t)).toEqual({ quien: 'todos', cuando: 'dia' });
  });

  it('una fila de otro día no cuenta para hoy', () => {
    expect(
      gasto.topeQueCierra({ ...fila, diaMicros: 10, gratisDiaMicros: 5 }, 1, true, '2026-10-08', t),
    ).toBeNull();
    expect(gasto.topeQueCierra({ ...fila, gratisDiaMicros: 5 }, 1, true, '2026-10-07', t)).toEqual({
      quien: 'gratis',
      cuando: 'dia',
    });
  });
});
