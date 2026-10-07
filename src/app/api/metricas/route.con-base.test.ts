import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { utcDay } from '@core/analytics';
import { levantarBaseDePrueba, type BaseDePrueba } from '@server/db/para-tests';
import type * as Metricas from '@server/metricas';
import type * as Users from '@server/users';

/**
 * La analítica entera, contra Postgres de verdad: los dos ataques que reprodujo
 * la auditoría, repetidos tal cual ([adr/0113](../../../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 *
 * `route.test.ts` prueba cada decisión con la base fingida; esto prueba lo que
 * solo se ve con la base delante —cuántos visitantes nacen y de quién son—.
 */

/** La cookie que trae la petición: firmada y viva, sea de quien sea. */
let cookie: { id: string; sessionVersion: number } | null = null;
vi.mock('@server/auth', () => ({
  authAvailable: () => true,
  currentCookie: async () => cookie,
}));

let base: BaseDePrueba;
let POST: (request: Request) => Promise<Response>;
let metricas: typeof Metricas;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  POST = (await import('./route')).POST;
  metricas = await import('@server/metricas');
  users = await import('@server/users');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
  cookie = null;
});

function apuntar(body: unknown, direccion: string): Request {
  return new Request('http://x/api/metricas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': direccion },
    body: JSON.stringify(body),
  });
}

async function nuevosHoy(): Promise<number> {
  return (await metricas.leerMetricas(utcDay(Date.now())))!.retencion.newLast7;
}

describe('envenenar la retención', () => {
  /**
   * La auditoría mandó sesenta «unidad terminada», cada una con un UUID nuevo,
   * desde una dirección: sesenta 204 y sesenta «primera vez». Ahora nacen diez.
   */
  it('sesenta UUID inventados desde una dirección son diez visitantes, no sesenta', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const res = await POST(
        apuntar({ evento: 'unidad-terminada', visitante: randomUUID() }, '6.6.6.6'),
      );
      estados.push(res.status);
    }

    expect(estados.every((s) => s === 204)).toBe(true);
    expect(await nuevosHoy()).toBe(10);
    // Lo sumado sigue contando todo: es lo que dice quien lo manda, y va marcado.
    const leido = await metricas.leerMetricas(utcDay(Date.now()));
    expect(leido?.ultimos30).toContainEqual({
      evento: 'unidad-terminada',
      ruta: '',
      cuenta: 60,
      declarado: true,
    });
  });

  it('y cambiar de IPv6 dentro del mismo /64 no da más', async () => {
    for (let i = 0; i < 30; i += 1) {
      await POST(
        apuntar({ evento: 'visita', ruta: '/', visitante: randomUUID() }, `2001:db8:5:6::${i + 1}`),
      );
    }

    expect(await nuevosHoy()).toBe(10);
  });

  it('quien ya existía sigue contando aunque su dirección haya gastado el tope', async () => {
    const yo = randomUUID();
    await POST(apuntar({ evento: 'visita', ruta: '/', visitante: yo }, '7.7.7.7'));
    for (let i = 0; i < 12; i += 1) {
      await POST(apuntar({ evento: 'visita', ruta: '/', visitante: randomUUID() }, '7.7.7.7'));
    }

    await POST(apuntar({ evento: 'visita', ruta: '/afinar', visitante: yo }, '7.7.7.7'));

    const { db } = await import('@server/db/client');
    const { metricasVisitantes } = await import('@server/db/schema');
    const filas = await db()!.select().from(metricasVisitantes);
    expect(filas.map((f) => f.visitante)).toContain(metricas.seudonimo('navegador', yo));
    expect(filas).toHaveLength(10);
  });
});

async function crear(email: string): Promise<Users.User> {
  const creada = await users.createUser({ mayorDe14: true, email, password: 'unaContrasenaLarga' });
  expect(creada.kind).toBe('ok');
  return (creada as { user: Users.User }).user;
}

describe('la cookie de una cuenta borrada', () => {
  /**
   * Borrar la cuenta olvida su seudónimo, pero la cookie sigue firmada hasta que
   * caduca: la siguiente visita lo volvía a crear. Ahora la cuenta se comprueba.
   */
  it('no vuelve a crear el seudónimo que borrar la cuenta olvidó', async () => {
    const creada = await crear('borrada@ejemplo.test');
    const id = creada.id;
    cookie = { id, sessionVersion: 0 };
    await users.deleteAccount(id, 'unaContrasenaLarga');
    await metricas.olvidarCuenta(id);

    expect((await POST(apuntar({ evento: 'visita', ruta: '/cuenta' }, '9.9.9.9'))).status).toBe(
      204,
    );

    const { db } = await import('@server/db/client');
    const { metricasVisitantes } = await import('@server/db/schema');
    expect(await db()!.select().from(metricasVisitantes)).toEqual([]);
  });

  it('y una cuenta viva sí cuenta con el suyo', async () => {
    const creada = await crear('viva@ejemplo.test');
    cookie = { id: creada.id, sessionVersion: 0 };

    await POST(apuntar({ evento: 'visita', ruta: '/cuenta' }, '9.9.9.9'));

    const { db } = await import('@server/db/client');
    const { metricasVisitantes } = await import('@server/db/schema');
    expect((await db()!.select().from(metricasVisitantes)).map((f) => f.visitante)).toEqual([
      metricas.seudonimo('cuenta', creada.id),
    ]);
  });
});
