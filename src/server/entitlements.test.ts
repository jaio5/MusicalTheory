import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Entitlements from './entitlements';
import type * as Users from './users';

/**
 * Quién está pidiendo y qué le dejamos hacer.
 *
 * Es la pieza que junta las tres cosas que deciden si una llamada al modelo se
 * sirve: **quién eres** (la sesión), **qué incluye tu plan** y **cuánto te
 * queda**. Cada una está probada por su lado; lo que solo se ve aquí es el
 * orden en que se preguntan y qué sale cuando una falla.
 *
 * La cookie se sustituye —firmarla de verdad pediría Auth.js entero, que en Node
 * no carga— y todo lo demás es de verdad, base de datos incluida.
 */

const authAvailable = vi.fn(() => true);
const currentCookie = vi.fn();

vi.mock('./auth', () => ({
  authAvailable: () => authAvailable(),
  currentCookie: () => currentCookie(),
}));

let base: BaseDePrueba;
let entitlements: typeof Entitlements;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  entitlements = await import('./entitlements');
  users = await import('./users');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
  authAvailable.mockReset();
  authAvailable.mockReturnValue(true);
  currentCookie.mockReset();
  currentCookie.mockResolvedValue(null);
});

async function entrar(plan: 'gratis' | 'basico' | 'medio' | 'pro' = 'gratis') {
  const creada = await users.createUser({ email: 'a@b.c', password: 'unaContrasenaLarga' });
  if (creada.kind !== 'ok') {
    throw new Error(creada.kind);
  }
  await users.setPlan(creada.user.id, plan);
  const guardado = (await users.findUserById(creada.user.id))!;
  currentCookie.mockResolvedValue({ id: guardado.id, sessionVersion: guardado.sessionVersion });
  return guardado;
}

describe('quién está pidiendo', () => {
  it('sin cuentas configuradas, nadie', async () => {
    authAvailable.mockReturnValue(false);

    expect(await entitlements.currentSession()).toBeNull();
  });

  it('sin cookie, nadie', async () => {
    expect(await entitlements.currentSession()).toBeNull();
  });

  it('con cookie buena, la cuenta con su plan y su cupo', async () => {
    await entrar('medio');

    const session = await entitlements.currentSession();

    expect(session?.account.plan).toBe('medio');
    expect(session?.account.email).toBe('a@b.c');
    expect(session?.account.aiLeftMonth).toBeGreaterThan(0);
  });

  it('una cookie de una cuenta borrada no vale', async () => {
    const user = await entrar();
    await users.deleteAccount(user.id, 'unaContrasenaLarga');

    expect(await entitlements.currentSession()).toBeNull();
  });

  it('una cookie de una sesión echada no vale', async () => {
    // Cambiar la contraseña sube `sessionVersion`, y por eso las cookies de
    // antes dejan de servir. Sin esta comprobación, recuperar la cuenta la
    // recuperaría a medias.
    const user = await entrar();
    currentCookie.mockResolvedValue({ id: user.id, sessionVersion: user.sessionVersion - 1 });

    expect(await entitlements.currentSession()).toBeNull();
  });

  it('sin sesión, la cuenta es la anónima y no revienta', async () => {
    const account = await entitlements.currentAccount();

    expect(account.email).toBeNull();
    expect(account.plan).toBe('gratis');
  });
});

describe('los cupos que da cada plan', () => {
  it('salen del modelo que hay puesto, no de un número escrito', async () => {
    const gratis = entitlements.limitsFor('gratis');
    const pro = entitlements.limitsFor('pro');

    expect(pro.monthly).toBeGreaterThan(gratis.monthly);
    expect(gratis.daily).toBeLessThanOrEqual(gratis.monthly);
  });
});

describe('pedirle algo al modelo', () => {
  it('sin cuenta no se sirve, y no se cuenta nada', async () => {
    expect((await entitlements.spendAi('profesor')).kind).toBe('sin-cuenta');
  });

  it('con un plan que no lo incluye, se dice cuál hace falta', async () => {
    // Las ideas no entran en el gratis: es la parte más cara y la única que se
    // puede pedir en cadena sin leer lo anterior.
    await entrar('gratis');

    const verdict = await entitlements.spendAi('ideas');

    expect(verdict.kind).toBe('plan');
    expect(verdict.kind === 'plan' && verdict.needed).not.toBeNull();
  });

  it('el profesor sí entra en el gratis', async () => {
    // Un plan gratis que no deja probar lo que se paga no vende nada.
    await entrar('gratis');

    expect((await entitlements.spendAi('profesor')).kind).toBe('ok');
  });

  it('cada petición descuenta del cupo', async () => {
    await entrar('gratis');

    const primera = await entitlements.spendAi('profesor');
    const segunda = await entitlements.spendAi('profesor');

    expect(primera.kind === 'ok' && primera.leftMonth).toBeGreaterThan(
      segunda.kind === 'ok' ? segunda.leftMonth : 999,
    );
  });

  it('con la cuenta leída pero el contador roto, no se sirve', async () => {
    // Servir cuando no se puede contar es la forma de que una caída de Postgres
    // se convierta en una factura. Se esconde solo la tabla del contador: la
    // sesión se lee bien, así que esto no es «no tienes cuenta».
    await entrar('gratis');
    await base.ejecutar('alter table ai_usage rename to ai_usage_escondida');

    try {
      expect((await entitlements.spendAi('profesor')).kind).toBe('sin-contador');
    } finally {
      await base.ejecutar('alter table ai_usage_escondida rename to ai_usage');
    }
  });

  it('al agotarse el cupo se dice cuál de los dos fue', async () => {
    await entrar('gratis');
    const { daily } = entitlements.limitsFor('gratis');

    for (let i = 0; i < daily; i += 1) {
      await entitlements.spendAi('profesor');
    }
    const pasado = await entitlements.spendAi('profesor');

    expect(pasado.kind).toBe('cupo');
    expect(pasado.kind === 'cupo' && pasado.scope).toBe('dia');
  });
});
