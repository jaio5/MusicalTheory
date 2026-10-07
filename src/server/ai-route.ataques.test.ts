import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiError, type AiErrorCode } from '@core/ai-errors';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as AiRoute from './ai-route';
import type * as RateLimit from './rate-limit';
import type * as Users from './users';

/**
 * El cuerpo de las rutas de IA entero —puertas, cupo, techo y modelo— contra
 * Postgres de verdad, con los ataques de la auditoría (adr/0114).
 *
 * La cookie se sustituye, como en `entitlements.test.ts`: firmarla pediría
 * Auth.js entero. **`authAvailable` hace lo que hace el de verdad**: sin base de
 * datos no hay cuentas (`auth.test.ts` lo comprueba sobre el de verdad).
 */

let cookie: { id: string; sessionVersion: number } | null = null;
vi.mock('./auth', () => ({
  authAvailable: () => (process.env['DATABASE_URL'] ?? '') !== '',
  currentCookie: async () => cookie,
}));

let base: BaseDePrueba;
let users: typeof Users;
let responderConModelo: typeof AiRoute.responderConModelo;
let SlidingWindowRateLimiter: typeof RateLimit.SlidingWindowRateLimiter;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  users = await import('./users');
  ({ responderConModelo } = await import('./ai-route'));
  ({ SlidingWindowRateLimiter } = await import('./rate-limit'));
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
  cookie = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const parse = vi.fn((body: unknown) => ((body as { vale?: boolean }).vale === true ? 'p' : null));

function ruta() {
  return {
    limiter: new SlidingWindowRateLimiter(),
    error: (code: AiErrorCode, message?: string) =>
      aiError(code, { account_required: 'hace falta cuenta' } as never, message),
    puerta: { feature: 'profesor' as const, loQueEs: 'Preguntarle al profesor', plural: false },
    parse,
    prompt: () => 'p',
    system: 's',
    schema: () => ({}),
    maxTokens: 10,
    // Sin proveedor y fuera de producción contesta el dominio por esta puerta.
    sinClave: () => ({ bien: true }),
    validar: (payload: unknown) => payload as { bien: boolean },
  };
}

/** Sin `X-Forwarded-For` de confianza: como un despliegue sin `TRUSTED_PROXY_HOPS`. */
function pedir(): Request {
  return new Request('http://x/api/teacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ vale: true }),
  });
}

async function entrar(email: string): Promise<void> {
  const creada = await users.createUser({ mayorDe14: true, email, password: 'unaContrasenaLarga' });
  if (creada.kind !== 'ok') {
    throw new Error(creada.kind);
  }
  cookie = { id: creada.user.id, sessionVersion: 0 };
}

describe('sin proxy de confianza', () => {
  /**
   * **El ataque**: el límite por minuto era por dirección y antes de leer la
   * sesión. Sin `TRUSTED_PROXY_HOPS` todas las peticiones son la misma dirección,
   * y diez anónimas seguidas dejaban sin IA a todas las cuentas a la vez.
   */
  it('cincuenta anónimas no dejan sin IA a quien tiene cuenta', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');
    const compartida = ruta();

    for (let i = 0; i < 50; i += 1) {
      expect((await responderConModelo(pedir(), compartida)).status).toBe(401);
    }
    // Y no han hecho trabajo de dominio con lo que traían.
    expect(parse).not.toHaveBeenCalled();

    await entrar('alguien@x.es');
    const res = await responderConModelo(pedir(), compartida);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bien: true });
  });

  it('y una cuenta que aporrea se frena a sí misma, no a las demás', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');
    const compartida = ruta();
    await entrar('aporrea@x.es');
    await users.setPlan(cookie!.id, 'medio');

    const estados: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      estados.push((await responderConModelo(pedir(), compartida)).status);
    }
    expect(estados.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(estados[10]).toBe(429);

    await entrar('otra@x.es');
    expect((await responderConModelo(pedir(), compartida)).status).toBe(200);
  });
});

describe('sin base de datos', () => {
  /**
   * Sin base no hay cuentas, y sin cuenta no hay IA: ni cupo ni techo que contar.
   * **En producción y con la clave puesta**, que es donde costaría dinero.
   */
  it('la IA está cerrada aunque haya clave, y no se llama a nadie', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-de-mentira');
    const llamadas = vi.fn();
    vi.stubGlobal('fetch', llamadas);
    const url = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    cookie = { id: '00000000-0000-0000-0000-000000000000', sessionVersion: 0 };

    try {
      const res = await responderConModelo(pedir(), ruta());

      expect(res.status).toBe(401);
      expect(llamadas).not.toHaveBeenCalled();
    } finally {
      process.env['DATABASE_URL'] = url;
      vi.unstubAllGlobals();
    }
  });
});
