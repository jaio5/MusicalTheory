import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BADGES, EMPTY_PROGRESS, UNIT_ORDER, type Progress } from '@core/music';
import { db } from '@server/db/client';
import { levantarBaseDePrueba, type BaseDePrueba } from '@server/db/para-tests';
import { progress } from '@server/db/schema';
import type * as Users from '@server/users';

import type * as Ruta from './route';

/**
 * El avance entero, contra Postgres de verdad: los tres ataques de la auditoría.
 *
 * `route.test.ts` prueba cada decisión de la ruta con el repositorio fingido; esto
 * prueba lo que solo se ve con la base delante (adr/0116):
 *
 * - **dos subidas a la vez** desde dos aparatos, que antes leían lo mismo y la
 *   segunda borraba lo de la primera;
 * - **un avance inventado** —racha de `1e308`, un día `9999-99-99`, todas las
 *   medallas— que se guardaba y ya no se podía arreglar;
 * - **un bucle de subidas** sin tope por cuenta.
 */

let yo: { userId: string; account: { plan: string } } | null = null;
vi.mock('@server/entitlements', () => ({ currentSession: async () => yo }));

let base: BaseDePrueba;
let users: typeof Users;
let ruta: typeof Ruta;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  users = await import('@server/users');
  ruta = await import('./route');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});

async function entrar(email = 'a@b.c'): Promise<string> {
  const result = await users.createUser({ mayorDe14: true, email, password: 'unaContrasenaLarga' });
  if (result.kind !== 'ok') {
    throw new Error(result.kind);
  }
  yo = { userId: result.user.id, account: { plan: 'basico' } };
  return result.user.id;
}

function subir(progress: unknown): Request {
  return new Request('http://x/api/progreso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress }),
  });
}

async function loGuardado(): Promise<Progress> {
  const res = await ruta.GET();
  return ((await res.json()) as { progress: Progress }).progress;
}

const HOY = new Date().toISOString().slice(0, 10);

describe('dos aparatos que suben a la vez', () => {
  it('no se pierde lo de ninguno', async () => {
    // Sin la transacción, los dos leían el avance vacío y el segundo en escribir
    // dejaba solo su unidad: `[ 'e1-claves' ]` donde tenía que haber dos.
    await entrar();
    const [primera, segunda] = [UNIT_ORDER[0]!, UNIT_ORDER[1]!];

    const respuestas = await Promise.all([
      ruta.PUT(subir({ ...EMPTY_PROGRESS, done: [primera] })),
      ruta.PUT(subir({ ...EMPTY_PROGRESS, done: [segunda] })),
    ]);

    expect(respuestas.map((res) => res.status)).toEqual([200, 200]);
    expect([...(await loGuardado()).done].sort()).toEqual([primera, segunda].sort());
  });

  it('ni con muchas subidas a la vez, y la primera vez tampoco', async () => {
    await entrar();
    const unidades = UNIT_ORDER.slice(0, 8);

    await Promise.all(unidades.map((id) => ruta.PUT(subir({ ...EMPTY_PROGRESS, done: [id] }))));

    expect([...(await loGuardado()).done].sort()).toEqual([...unidades].sort());
  });
});

describe('un avance inventado', () => {
  const INVENTADO = {
    done: [],
    xp: 999_999,
    streak: 1e308,
    bestStreak: 1e308,
    lastDay: '9999-99-99',
    xpToday: 1e308,
    badges: BADGES.map((badge) => badge.id),
  };

  it('no se guarda nada imposible', async () => {
    await entrar();

    const res = await ruta.PUT(subir(INVENTADO));
    const { progress: devuelto } = (await res.json()) as { progress: Progress };

    expect(res.status).toBe(200);
    expect(devuelto).toMatchObject({ lastDay: null, streak: 0, bestStreak: 0, xpToday: 0 });
    expect(devuelto.badges).toEqual([]);
  });

  it('una fecha del futuro bien escrita tampoco, y no le gana después al día de verdad', async () => {
    await entrar();

    await ruta.PUT(subir({ ...INVENTADO, lastDay: '9999-12-31' }));
    await ruta.PUT(subir({ ...EMPTY_PROGRESS, done: [UNIT_ORDER[0]], lastDay: HOY, streak: 1 }));

    const guardado = await loGuardado();
    expect(guardado.lastDay).toBe(HOY);
    expect(guardado.streak).toBe(1);
  });

  it('lo que se guardó envenenado antes de esto se arregla en la siguiente subida', async () => {
    // Así quedó en la base la prueba de la auditoría: escrito antes de que se
    // comprobara nada.
    const userId = await entrar();
    await base.ejecutar(
      `insert into progress (user_id, data) values ('${userId}', '${JSON.stringify({
        ...INVENTADO,
        lastDay: '9999-12-31',
        streak: 1e300,
      })}')`,
    );

    await ruta.PUT(subir({ ...EMPTY_PROGRESS, done: [UNIT_ORDER[0]], lastDay: HOY, streak: 1 }));

    // Leído a pelo, sin `parseProgress`: lo que se mira es lo que quedó escrito.
    const [fila] = await db()!.select({ data: progress.data }).from(progress);
    const data = fila!.data as Progress;
    expect(data.lastDay).toBe(HOY);
    expect(data.streak).toBe(1);
    expect(data.xpToday).toBeLessThan(1e6);
    expect(data.badges).not.toContain('profesional-superado');
  });
});

describe('el tope por cuenta', () => {
  it('un bucle de subidas se frena, y no frena a otra cuenta', async () => {
    await entrar('bucle@b.c');
    const estados: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      estados.push((await ruta.PUT(subir(EMPTY_PROGRESS))).status);
    }

    expect(estados.slice(0, 60).every((estado) => estado === 200)).toBe(true);
    expect(estados[60]).toBe(429);

    await entrar('otra@b.c');
    expect((await ruta.PUT(subir(EMPTY_PROGRESS))).status).toBe(200);
  });
});
