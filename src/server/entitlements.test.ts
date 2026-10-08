import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

async function entrar(plan: 'gratis' | 'basico' | 'medio' = 'gratis') {
  const creada = await users.createUser({
    mayorDe14: true,
    email: 'a@b.c',
    password: 'unaContrasenaLarga',
  });
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
    const medio = entitlements.limitsFor('medio');

    expect(medio.monthly).toBeGreaterThan(gratis.monthly);
    expect(gratis.daily).toBeLessThanOrEqual(gratis.monthly);
  });
});

describe('pedirle algo al modelo', () => {
  it('sin cuenta no se sirve, y no se cuenta nada', async () => {
    expect((await entitlements.spendAi('profesor')).kind).toBe('sin-cuenta');
  });

  it('con un plan que no lo incluye, se dice cuál hace falta', async () => {
    // Las salidas no entran en el gratis: son lo más caro que se le puede pedir
    // al modelo.
    await entrar('gratis');

    const verdict = await entitlements.spendAi('salidas');

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

  /**
   * El cupo se cuenta en preguntas al profesor y una salida gasta las que cuesta
   * (adr/0067): con el modelo que haya puesto, `unidadesDe('salidas')`.
   */
  it('una tanda de salidas descuenta las preguntas que cuesta', async () => {
    await entrar('medio');
    const { unidadesDe } = await import('@core/billing');
    const { configuredModel } = await import('./ai-model');
    const k = unidadesDe('salidas', configuredModel());

    const pregunta = await entitlements.spendAi('profesor');
    const salida = await entitlements.spendAi('salidas');

    expect(k).toBeGreaterThan(1);
    expect(pregunta.kind === 'ok' && salida.kind === 'ok').toBe(true);
    expect(
      pregunta.kind === 'ok' && salida.kind === 'ok' && pregunta.leftMonth - salida.leftMonth,
    ).toBe(k);
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

  /**
   * Y el del mes se distingue del de hoy: son dos frases distintas —«vuelve
   * mañana» y «vuelve el mes que viene»— y decir la que no es manda a alguien a
   * esperar veinticuatro horas para volver a encontrarse lo mismo.
   */
  it('el cupo del mes se dice como del mes, y no como de hoy', async () => {
    await entrar('gratis');
    const { monthly } = entitlements.limitsFor('gratis');
    const mes = new Date().toISOString().slice(0, 7);

    // Una primera petición crea el contador; después se le deja el del mes en
    // su tope sin tocar el de hoy, que es lo que pasa el último día de un mes
    // muy usado.
    await entitlements.spendAi('profesor');
    await base.ejecutar(
      `update ai_usage set count = ${monthly}, day_count = 0 where month = '${mes}'`,
    );
    const pasado = await entitlements.spendAi('profesor');

    expect(pasado.kind === 'cupo' && pasado.scope).toBe('mes');
  });
});

/**
 * **El ataque de la auditoría** (adr/0114): sin confirmar el correo, cada cuenta
 * gratis nueva trae su cupo, y nada acotaba la suma. Con cien direcciones
 * registrando al ritmo que deja el límite eran unos 650 $ por hora con Sonnet
 * 5.5. Aquí, en pequeño: veinte cuentas gratis gastando su cupo del día contra un
 * techo de lo gratis de diez céntimos.
 */
describe('el techo de gasto de todos', () => {
  const VARIABLES = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'IA_TOPE_GRATIS_DIARIO_USD'];
  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-de-mentira';
    process.env['ANTHROPIC_MODEL'] = 'claude-sonnet-5-5';
    process.env['IA_TOPE_GRATIS_DIARIO_USD'] = '0.1';
  });
  afterEach(() => {
    for (const v of VARIABLES) {
      delete process.env[v];
    }
  });

  async function otraCuenta(i: number, plan: 'gratis' | 'medio' = 'gratis') {
    const creada = await users.createUser({
      mayorDe14: true,
      email: `atacante-${i}@dominio-inventado.invalid`,
      password: 'unaContrasenaLarga',
    });
    if (creada.kind !== 'ok') {
      throw new Error(creada.kind);
    }
    await users.setPlan(creada.user.id, plan);
    currentCookie.mockResolvedValue({ id: creada.user.id, sessionVersion: 0 });
  }

  it('veinte cuentas gratis no pasan del techo de lo gratis', async () => {
    const { requestCostMicros } = await import('@core/billing');
    const { daily } = entitlements.limitsFor('gratis');
    const porPregunta = requestCostMicros('profesor', 'claude-sonnet-5-5');
    const caben = Math.floor(100_000 / porPregunta);

    let servidas = 0;
    let cerradas = 0;
    for (let i = 0; i < 20; i += 1) {
      await otraCuenta(i);
      for (let j = 0; j < daily; j += 1) {
        const v = await entitlements.spendAi('profesor');
        servidas += v.kind === 'ok' ? 1 : 0;
        cerradas += v.kind === 'tope-global' ? 1 : 0;
      }
    }

    // Sin el techo eran las veinte por su cupo diario: sesenta preguntas.
    expect(20 * daily).toBeGreaterThan(caben);
    expect(servidas).toBe(caben);
    expect(cerradas).toBe(20 * daily - caben);
  }, 60_000);

  it('cerrar lo gratis no cierra lo que se paga, ni gasta su cupo', async () => {
    process.env['IA_TOPE_GRATIS_DIARIO_USD'] = '0';
    await otraCuenta(0);
    const gratis = await entitlements.spendAi('profesor');
    expect(gratis).toMatchObject({ kind: 'tope-global', quien: 'gratis', cuando: 'dia' });
    expect((await entitlements.currentAccount()).aiLeftMonth).toBe(
      entitlements.limitsFor('gratis').monthly,
    );

    await otraCuenta(1, 'medio');
    const pagando = await entitlements.spendAi('profesor');
    expect(pagando.kind).toBe('ok');
    expect(pagando.kind === 'ok' && pagando.reserva?.gratis).toBe(false);
  });

  it('con la sesión que le pasa la ruta no la vuelve a leer', async () => {
    await otraCuenta(0);
    const sesion = (await entitlements.currentSession())!;
    currentCookie.mockReset();

    const v = await entitlements.spendAi('profesor', {
      ...sesion,
      account: { ...sesion.account, email: null },
    });

    expect(v.kind).toBe('ok');
    expect(currentCookie).not.toHaveBeenCalled();
  });

  it('si el cupo dice que no, la reserva se devuelve', async () => {
    const { gastoDelMes } = await import('./ai-gasto');
    await otraCuenta(0);
    const { daily } = entitlements.limitsFor('gratis');
    for (let i = 0; i < daily; i += 1) {
      await entitlements.spendAi('profesor');
    }
    const antes = (await gastoDelMes())?.micros;

    expect((await entitlements.spendAi('profesor')).kind).toBe('cupo');
    expect((await gastoDelMes())?.micros).toBe(antes);
  });

  it('sin poder contar el gasto, no se sirve', async () => {
    await otraCuenta(0);
    await base.ejecutar('alter table ai_gasto rename to ai_gasto_escondida');
    try {
      expect((await entitlements.spendAi('profesor')).kind).toBe('sin-contador');
    } finally {
      await base.ejecutar('alter table ai_gasto_escondida rename to ai_gasto');
    }
  });

  it('sin la API —modelo de casa o dominio— no se cuesta y no pasa por el techo', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    process.env['IA_TOPE_GRATIS_DIARIO_USD'] = '0';
    await otraCuenta(0);

    expect(await entitlements.spendAi('profesor')).toMatchObject({ kind: 'ok', reserva: null });
  });
});
