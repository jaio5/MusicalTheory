import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FREE_MONTHLY_ALLOWANCE } from '@core/billing';
import { levantarBaseDePrueba, type BaseDePrueba } from '@server/db/para-tests';
import type * as Entitlements from '@server/entitlements';
import type * as Users from '@server/users';

import type * as Ruta from './route';

/**
 * Borrar la cuenta, contra Postgres de verdad y un Stripe de mentira.
 *
 * Los dos agujeros de la auditoría (adr/0114), que solo se ven con la ruta, la
 * base y la pasarela delante:
 *
 * - **Borrar no cancelaba la suscripción**: Stripe seguía cobrando cada mes a una
 *   cuenta que ya no existía, y sus avisos contestaban «esa cuenta ya no está».
 * - **Borrar y volver con el mismo correo devolvía el cupo** del mes entero.
 *
 * La cookie se sustituye —firmarla pediría Auth.js entero— y lo demás es de
 * verdad.
 */

let cookie: { id: string; sessionVersion: number } | null = null;
vi.mock('@server/auth', () => ({
  authAvailable: () => true,
  currentCookie: async () => cookie,
}));

const VARIABLES_STRIPE: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_loquesea',
  STRIPE_PRICE_BASICO: 'price_basico',
  STRIPE_PRICE_MEDIO: 'price_medio',
  STRIPE_PRICE_BASICO_ANUAL: 'price_basico_anual',
  STRIPE_PRICE_MEDIO_ANUAL: 'price_medio_anual',
};

let base: BaseDePrueba;
let users: typeof Users;
let ruta: typeof Ruta;
let entitlements: typeof Entitlements;

/** Lo que Stripe tiene, y si contesta. */
let enStripe: Map<string, string>;
let stripeCaido = false;
const llamadas: string[] = [];

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  users = await import('@server/users');
  ruta = await import('./route');
  entitlements = await import('@server/entitlements');
});
afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  Object.assign(process.env, VARIABLES_STRIPE);
  process.env['AUTH_SECRET'] = 'un-secreto-de-pruebas-con-largo-de-sobra';
  enStripe = new Map();
  stripeCaido = false;
  llamadas.length = 0;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push(`${init?.method ?? 'GET'} ${url.split('/').at(-1) ?? ''}`);
    if (stripeCaido) {
      return Response.json({ error: 'caído' }, { status: 500 });
    }
    const id = url.split('/').at(-1) ?? '';
    const status = enStripe.get(id);
    if (status === undefined) {
      return Response.json({ error: { code: 'resource_missing' } }, { status: 404 });
    }
    if (init?.method === 'DELETE') {
      enStripe.set(id, 'canceled');
    }
    return Response.json({ id, object: 'subscription', status: enStripe.get(id) });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of Object.keys(VARIABLES_STRIPE)) {
    delete process.env[k];
  }
  delete process.env['AUTH_SECRET'];
});

async function cuenta(email = 'v@x.es'): Promise<string> {
  const creada = await users.createUser({ mayorDe14: true, email, password: 'unaContrasenaLarga' });
  if (creada.kind !== 'ok') {
    throw new Error(creada.kind);
  }
  cookie = { id: creada.user.id, sessionVersion: 0 };
  return creada.user.id;
}

async function pagando(userId: string): Promise<void> {
  enStripe.set('sub_1', 'active');
  expect(
    await users.vincularSuscripcion(userId, {
      plan: 'medio',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    }),
  ).toEqual({ kind: 'ok' });
}

function borrar(password = 'unaContrasenaLarga'): Promise<Response> {
  return ruta.DELETE(
    new Request('http://x/api/cuenta', {
      method: 'DELETE',
      headers: { 'x-forwarded-for': `10.7.0.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({ password }),
    }),
  );
}

describe('borrar la cuenta con una suscripción viva', () => {
  it('la cancela en Stripe antes de borrar', async () => {
    const userId = await cuenta();
    await pagando(userId);

    const res = await borrar();

    expect(res.status).toBe(200);
    expect(llamadas).toContain('DELETE sub_1');
    expect(enStripe.get('sub_1')).toBe('canceled');
    expect(await users.findUserById(userId)).toBeNull();
  });

  /** El orden del adr/0077: primero se para el cobro; si no se puede, nada. */
  it('si Stripe no contesta, no se borra nada y se dice por qué', async () => {
    const userId = await cuenta();
    await pagando(userId);
    stripeCaido = true;

    const res = await borrar();
    const cuerpo = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(502);
    expect(cuerpo.error.code).toBe('sin-cancelar');
    expect(cuerpo.error.message).toContain('te seguiría cobrando');
    expect((await users.findUserById(userId))?.plan).toBe('medio');
    expect((await users.suscripcionDe(userId))?.subscriptionId).toBe('sub_1');
  });

  it('con la contraseña mal no se cancela nada', async () => {
    const userId = await cuenta();
    await pagando(userId);

    expect((await borrar('otraContrasenaCualquiera')).status).toBe(403);
    expect(llamadas).toEqual([]);
    expect(enStripe.get('sub_1')).toBe('active');
    expect(await users.findUserById(userId)).not.toBeNull();
  });

  it('sin suscripción se borra sin ir a Stripe', async () => {
    const userId = await cuenta();

    expect((await borrar()).status).toBe(200);
    expect(llamadas).toEqual([]);
    expect(await users.findUserById(userId)).toBeNull();
  });
});

describe('borrarse y volver con el mismo correo', () => {
  it('no devuelve el cupo del mes', async () => {
    const userId = await cuenta('b@x.es');
    // El cupo gratis del mes, gastado entero.
    const mes = new Date().toISOString().slice(0, 7);
    const hoy = new Date().toISOString().slice(0, 10);
    await base.ejecutar(
      `insert into ai_usage (user_id, month, count, day, day_count) values ('${userId}', '${mes}', ${FREE_MONTHLY_ALLOWANCE}, '${hoy}', 0)`,
    );
    expect(await entitlements.spendAi('profesor')).toMatchObject({ kind: 'cupo', scope: 'mes' });

    expect((await borrar()).status).toBe(200);
    await cuenta('B@x.es ');

    // Sin la huella del correo, aquí volvía a haber quince preguntas.
    expect(await entitlements.spendAi('profesor')).toMatchObject({ kind: 'cupo', scope: 'mes' });
  });

  it('lo heredado se suma a lo que gaste la cuenta nueva', async () => {
    const userId = await cuenta('c@x.es');
    const mes = new Date().toISOString().slice(0, 7);
    const hoy = new Date().toISOString().slice(0, 10);
    await base.ejecutar(
      `insert into ai_usage (user_id, month, count, day, day_count) values ('${userId}', '${mes}', ${FREE_MONTHLY_ALLOWANCE - 1}, '${hoy}', 0)`,
    );
    expect((await borrar()).status).toBe(200);
    await cuenta('c@x.es');

    // Queda una: la primera pasa y la segunda no.
    expect((await entitlements.spendAi('profesor')).kind).toBe('ok');
    expect(await entitlements.spendAi('profesor')).toMatchObject({ kind: 'cupo', scope: 'mes' });
  });

  it('se guarda la huella y no el correo, y otro correo no hereda nada', async () => {
    const userId = await cuenta('d@x.es');
    const mes = new Date().toISOString().slice(0, 7);
    const hoy = new Date().toISOString().slice(0, 10);
    await base.ejecutar(
      `insert into ai_usage (user_id, month, count, day, day_count) values ('${userId}', '${mes}', 5, '${hoy}', 0)`,
    );
    // Y un resto de un mes pasado, que ya no protege nada y se poda.
    await base.ejecutar(
      `insert into ai_uso_heredado (huella, month, count) values ('vieja', '2000-01', 3)`,
    );
    expect((await borrar()).status).toBe(200);

    const { aiUsoHeredado } = await import('@server/db/schema');
    const { db } = await import('@server/db/client');
    const filas = await db()!.select().from(aiUsoHeredado);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.count).toBe(5);
    expect(JSON.stringify(filas)).not.toContain('d@x.es');

    await cuenta('otro@x.es');
    expect(await entitlements.spendAi('profesor')).toMatchObject({ kind: 'ok', leftMonth: 14 });
  });

  it('si no se puede guardar lo gastado, no se borra', async () => {
    const userId = await cuenta('e@x.es');
    await base.ejecutar('alter table ai_uso_heredado rename to ai_uso_heredado_roto');
    try {
      expect((await borrar()).status).toBe(500);
      expect(await users.findUserById(userId)).not.toBeNull();
    } finally {
      await base.ejecutar('alter table ai_uso_heredado_roto rename to ai_uso_heredado');
    }
  });
});
