import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeRetention, shiftDay, type VisitorDays } from '@core/analytics';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Metricas from './metricas';

/**
 * La analítica contra Postgres de verdad (PGlite), porque lo que aquí puede salir
 * mal es un `on conflict`: que veinte visitas en una tarde cuenten como veinte
 * vueltas, o que alguien que vuelve parezca nuevo.
 */

let base: BaseDePrueba;
let m: typeof Metricas;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  m = await import('./metricas');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});

const HOY = '2026-10-07';

async function sumados(): Promise<Record<string, number>> {
  const leido = await m.leerMetricas(HOY);
  return Object.fromEntries(
    (leido?.ultimos30 ?? []).map(({ evento, ruta, cuenta }) => [`${evento}${ruta}`, cuenta]),
  );
}

describe('el seudónimo', () => {
  it('no es el identificador, y la cuenta y el navegador no chocan', () => {
    const id = 'f8a7b0c4-0000-4000-8000-000000000001';
    expect(m.seudonimo('cuenta', id)).not.toContain(id);
    expect(m.seudonimo('cuenta', id)).toMatch(/^[0-9a-f]{32}$/);
    expect(m.seudonimo('cuenta', id)).not.toBe(m.seudonimo('navegador', id));
  });

  it('depende del secreto: sin él no se puede volver a la persona', () => {
    const antes = process.env['AUTH_SECRET'];
    process.env['AUTH_SECRET'] = 'uno';
    const conUno = m.seudonimo('cuenta', 'x');
    process.env['AUTH_SECRET'] = 'otro';
    const conOtro = m.seudonimo('cuenta', 'x');
    delete process.env['AUTH_SECRET'];
    const sinSecreto = m.seudonimo('cuenta', 'x');
    process.env['AUTH_SECRET'] = antes;
    if (antes === undefined) {
      delete process.env['AUTH_SECRET'];
    }
    expect(new Set([conUno, conOtro, sinSecreto]).size).toBe(3);
  });
});

describe('lo sumado', () => {
  it('se suma por día, evento y ruta, sin nadie dentro', async () => {
    await m.registrarEvento({ evento: 'visita', ruta: '/afinar', visitante: null }, HOY);
    await m.registrarEvento({ evento: 'visita', ruta: '/afinar', visitante: null }, HOY);
    await m.registrarEvento({ evento: 'toma-grabada', ruta: '', visitante: null }, HOY);

    expect(await sumados()).toEqual({ 'visita/afinar': 2, 'toma-grabada': 1 });
  });

  it('lo de hace más de treinta días no sale en el último mes', async () => {
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: null }, shiftDay(HOY, -30));
    expect(await sumados()).toEqual({});
  });
});

describe('quién vuelve', () => {
  it('la primera vez es una, y veinte visitas el mismo día no son veinte vueltas', async () => {
    for (let i = 0; i < 3; i += 1) {
      await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, HOY);
    }
    expect(await sumados()).toEqual({ 'visita/': 3, 'primera-vez': 1 });
  });

  it('otro día es una vuelta, y el primer día no se mueve', async () => {
    const ayer = shiftDay(HOY, -1);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, ayer);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, HOY);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, HOY);

    const leido = await m.leerMetricas(HOY);
    expect(await sumados()).toMatchObject({ 'primera-vez': 1, 'vuelve-otro-dia': 1 });
    expect(leido?.retencion).toMatchObject({ activeLast7: 1, newLast7: 1 });
  });

  it('la retención sale de los días guardados', async () => {
    const primero = shiftDay(HOY, -20);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, primero);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, shiftDay(primero, 8));
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'b' }, primero);

    expect((await m.leerMetricas(HOY))?.retencion.day7).toEqual({ cohort: 2, returned: 1 });
  });

  it('lo de más de trece meses se borra, y quien no ha vuelto desde entonces también', async () => {
    const viejo = shiftDay(HOY, -(m.DIAS_QUE_SE_GUARDAN + 1));
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'viejo' }, viejo);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'sigue' }, viejo);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'sigue' }, HOY);

    await m.podar(HOY);

    // Quien sigue conserva su primer día aunque ese día ya no esté: sin él
    // parecería nuevo.
    const leido = await m.leerMetricas(HOY);
    expect(leido?.retencion.activeLast7).toBe(1);
    expect(leido?.retencion.newLast7).toBe(0);
    expect(leido?.retencion.day30.cohort).toBe(1);
  });

  it('quien solo tiene días de hace más de trece meses, sin podar todavía, no cuenta como activo', async () => {
    const viejo = shiftDay(HOY, -(m.DIAS_QUE_SE_GUARDAN + 1));
    await base.ejecutar(`insert into metricas_visitantes values ('viejo', '${viejo}', '${viejo}')`);
    await base.ejecutar(`insert into metricas_dias values ('viejo', '${viejo}')`);

    const leido = await m.leerMetricas(HOY);
    expect(leido?.retencion.activeLast7).toBe(0);
    expect(leido?.retencion.day30).toEqual({ cohort: 1, returned: 0 });
  });

  it('se poda solo, de vez en cuando, sin que nadie lo pida', async () => {
    const viejo = shiftDay(HOY, -(m.DIAS_QUE_SE_GUARDAN + 1));
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'viejo' }, viejo);
    for (let i = 0; i < 200; i += 1) {
      await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: null }, HOY);
    }
    expect((await m.leerMetricas(HOY))?.retencion.day30.cohort).toBe(0);
  });

  it('borrar la cuenta se lleva sus días', async () => {
    const visitante = m.seudonimo('cuenta', 'u1');
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante }, HOY);

    await m.olvidarCuenta('u1');

    expect((await m.leerMetricas(HOY))?.retencion.activeLast7).toBe(0);
  });
});

/**
 * **Leer va en SQL, y da lo mismo que la definición** (adr/0113).
 *
 * Antes se traían a memoria todos los visitantes y se contaban en
 * `computeRetention`: la memoria de leer crecía con cada visitante. La definición
 * sigue siendo esa, y esto la compara con el SQL con los mismos datos: dos
 * escrituras de lo mismo solo valen si algo vigila que no se separen.
 */
describe('la retención contada en Postgres', () => {
  /** Un generador con semilla: el mismo reparto cada vez, para que un fallo se repita. */
  function azar(semilla: number): () => number {
    let x = semilla;
    return () => {
      x = (x * 1_103_515_245 + 12_345) % 2 ** 31;
      return x / 2 ** 31;
    };
  }

  it('da lo mismo que computeRetention, visitante a visitante', async () => {
    const r = azar(7);
    const visitantes: VisitorDays[] = [];
    const filas: string[] = [];
    const dias: string[] = [];
    for (let i = 0; i < 300; i += 1) {
      // Primeros días repartidos por más de trece meses, para que haya de todo:
      // quien llegó hoy, quien llegó hace un mes y quien solo tiene días podables.
      const primero = shiftDay(HOY, -Math.floor(r() * 420));
      const suyos = new Set([primero]);
      const cuantos = Math.floor(r() * 12);
      for (let j = 0; j < cuantos; j += 1) {
        const dia = shiftDay(primero, Math.floor(r() * 60));
        if (dia <= HOY) {
          suyos.add(dia);
        }
      }
      // Uno de cada quince viene cada semana: sin ellos, «vuelven cada semana»
      // compararía ceros.
      if (i % 15 === 0) {
        for (const atras of [0, 7, 14, 21]) {
          suyos.add(shiftDay(HOY, -atras));
        }
      }
      const lista = [...suyos];
      const ultimo = lista.reduce((a, b) => (a > b ? a : b));
      filas.push(`('v${i}', '${primero}', '${ultimo}')`);
      for (const dia of lista) {
        dias.push(`('v${i}', '${dia}')`);
      }
      // Lo que lee la definición: los días dentro de lo que se guarda.
      const desde = shiftDay(HOY, -m.DIAS_QUE_SE_GUARDAN);
      visitantes.push({ firstDay: primero, days: lista.filter((dia) => dia >= desde) });
    }
    // Y uno sin ningún día guardado, que el SQL ve por el `left join`.
    filas.push(`('sin-dias', '${shiftDay(HOY, -40)}', '${shiftDay(HOY, -40)}')`);
    visitantes.push({ firstDay: shiftDay(HOY, -40), days: [] });

    await base.ejecutar(`insert into metricas_visitantes values ${filas.join(', ')}`);
    await base.ejecutar(`insert into metricas_dias values ${dias.join(', ')}`);

    const leido = await m.leerMetricas(HOY);
    const esperado = computeRetention(visitantes, HOY);
    expect(leido?.retencion).toEqual(esperado);
    // Que el reparto de verdad toca todas las ramas, y no compara ceros con ceros.
    expect(esperado.day7.returned).toBeGreaterThan(0);
    expect(esperado.day30.returned).toBeGreaterThan(0);
    expect(esperado.weekly.returned).toBeGreaterThan(0);
    expect(esperado.newLast7).toBeGreaterThan(0);
  });

  it('con la tabla vacía, todo a cero', async () => {
    expect((await m.leerMetricas(HOY))?.retencion).toEqual(computeRetention([], HOY));
  });
});

/**
 * **Lo que cuenta el navegador se lee como declarado** (adr/0113): una unidad
 * terminada la puede mandar cualquiera a mano. La canción guardada la cuenta el
 * servidor al guardarla.
 */
describe('lo declarado y lo comprobado', () => {
  it('lo que manda el navegador sale marcado; lo que cuenta el servidor, no', async () => {
    await m.registrarEvento({ evento: 'unidad-terminada', ruta: '', visitante: null }, HOY);
    await m.registrarEvento({ evento: 'cancion-guardada', ruta: '', visitante: null }, HOY);

    const leido = await m.leerMetricas(HOY);
    expect(leido?.ultimos30).toEqual([
      { evento: 'cancion-guardada', ruta: '', cuenta: 1, declarado: false },
      { evento: 'unidad-terminada', ruta: '', cuenta: 1, declarado: true },
    ]);
  });
});

/**
 * **Un visitante nuevo puede necesitar permiso** (adr/0113). La ruta lo pide para
 * los seudónimos de navegador, que se inventan gratis: sin él, sesenta UUID por
 * minuto eran sesenta «primera vez».
 */
describe('el permiso para los nuevos', () => {
  it('si no lo da, el evento se suma pero no nace nadie', async () => {
    const admitirNuevo = vi.fn(async () => false);

    await m.registrarEvento(
      { evento: 'unidad-terminada', ruta: '', visitante: 'inventado', admitirNuevo },
      HOY,
    );

    expect(await sumados()).toEqual({ 'unidad-terminada': 1 });
    expect((await m.leerMetricas(HOY))?.retencion.activeLast7).toBe(0);
  });

  it('si lo da, nace; y a quien ya existe no se le vuelve a preguntar', async () => {
    const admitirNuevo = vi.fn(async () => true);
    const ayer = shiftDay(HOY, -1);

    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a', admitirNuevo }, ayer);
    await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a', admitirNuevo }, HOY);

    expect(admitirNuevo).toHaveBeenCalledTimes(1);
    expect(await sumados()).toMatchObject({ 'primera-vez': 1, 'vuelve-otro-dia': 1 });
  });
});

describe('cuando la base falla o no está', () => {
  it('apuntar no lanza, y en desarrollo deja rastro', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await base.ejecutar('alter table metricas_conteo rename to roto');
    try {
      await expect(
        m.registrarEvento({ evento: 'visita', ruta: '/', visitante: null }, HOY),
      ).resolves.toBeUndefined();
      expect(aviso).toHaveBeenCalled();

      // En producción, callado: contar no es una avería.
      aviso.mockClear();
      vi.stubEnv('NODE_ENV', 'production');
      await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: null }, HOY);
      expect(aviso).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      aviso.mockRestore();
      await base.ejecutar('alter table roto rename to metricas_conteo');
    }
  });

  it('olvidar no lanza aunque la tabla no conteste', async () => {
    await base.ejecutar('alter table metricas_dias rename to roto');
    try {
      await expect(m.olvidarCuenta('u1')).resolves.toBeUndefined();
    } finally {
      await base.ejecutar('alter table roto rename to metricas_dias');
    }
  });

  it('sin base de datos no hace nada', async () => {
    const url = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      await m.registrarEvento({ evento: 'visita', ruta: '/', visitante: 'a' }, HOY);
      await m.olvidarCuenta('u1');
      expect(await m.leerMetricas(HOY)).toBeNull();
    } finally {
      process.env['DATABASE_URL'] = url;
    }
  });
});

describe('lo que pide el navegador', () => {
  it('DNT o GPC es no contar nada', () => {
    expect(m.noQuiereQueLeSigan(new Headers({ DNT: '1' }))).toBe(true);
    expect(m.noQuiereQueLeSigan(new Headers({ 'Sec-GPC': '1' }))).toBe(true);
    expect(m.noQuiereQueLeSigan(new Headers({ DNT: '0' }))).toBe(false);
    expect(m.noQuiereQueLeSigan(new Headers())).toBe(false);
  });

  it('lo que cuenta el servidor lo respeta igual', async () => {
    const pide = (headers: Record<string, string>) =>
      new Request('http://x/api/canciones', { method: 'POST', headers });
    const ahora = Date.parse(`${HOY}T12:00:00Z`);

    await m.contarEnElServidor(pide({ 'Sec-GPC': '1' }), 'cancion-guardada', 'u1', ahora);
    expect(await sumados()).toEqual({});

    await m.contarEnElServidor(pide({}), 'cancion-guardada', 'u1', ahora);
    expect(await sumados()).toEqual({ 'cancion-guardada': 1, 'primera-vez': 1 });
  });

  it('sin decir cuándo, cuenta ahora', async () => {
    await m.contarEnElServidor(
      new Request('http://x', { method: 'POST' }),
      'cancion-guardada',
      'u1',
    );
    // Hoy de verdad puede no ser `HOY`: se mira que hay algo, no la fecha.
    expect((await m.leerMetricas(new Date().toISOString().slice(0, 10)))?.ultimos30.length).toBe(2);
  });
});
