import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NextResponse } from 'next/server';

import { aiError, type AiErrorCode } from '@core/ai-errors';

/**
 * El cuerpo común de las rutas de IA, con una ruta de mentira: lo que se prueba
 * aquí es **lo que sale de cada final** y el rastro que deja, no lo que pregunta
 * cada ruta. Las puertas se abren solas —tienen su test en `ai-gate.test.ts`— y el
 * bucle de los intentos se sustituye por el desenlace que toque.
 */

const preguntarAlModelo = vi.fn();
const currentSession = vi.fn();
const frenarPorCuenta = vi.fn();
const asentarGasto = vi.fn();
const abrirPuertaDeIa = vi.fn();
const frenarPorDireccion = vi.fn();
const comprobarProveedor = vi.fn();

vi.mock('./ai-gate', () => ({
  frenarPorDireccion: (...args: unknown[]) => frenarPorDireccion(...args),
  comprobarProveedor: (...args: unknown[]) => comprobarProveedor(...args),
  frenarPorCuenta: (...args: unknown[]) => frenarPorCuenta(...args),
  abrirPuertaDeIa: (...args: unknown[]) => abrirPuertaDeIa(...args),
}));
vi.mock('./entitlements', () => ({ currentSession: () => currentSession() }));
vi.mock('./ai-gasto', () => ({
  asentarGasto: (...args: unknown[]) => asentarGasto(...args),
}));
vi.mock('./ai-intentos', () => ({
  preguntarAlModelo: (...args: unknown[]) => preguntarAlModelo(...args),
}));

const { responderConModelo } = await import('./ai-route');
const { SlidingWindowRateLimiter } = await import('./rate-limit');

const MENSAJES = {
  invalid_request: 'falta algo',
} as Record<AiErrorCode, string>;

function ruta(porQueNoVale?: (body: unknown) => string | null) {
  return {
    limiter: new SlidingWindowRateLimiter(),
    error: (code: AiErrorCode, message?: string) => aiError(code, MENSAJES, message),
    puerta: { feature: 'profesor' as const, loQueEs: 'Preguntar', plural: false },
    parse: (body: unknown) =>
      (body as { vale?: boolean }).vale === true ? 'peticion' : (null as string | null),
    prompt: () => 'p',
    system: 's',
    schema: () => ({}),
    maxTokens: 10,
    sinClave: () => ({}),
    validar: () => null,
    ...(porQueNoVale === undefined ? {} : { porQueNoVale }),
  };
}

function pedir(body: unknown): Request {
  return new Request('http://x/api/teacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let aviso: ReturnType<typeof vi.spyOn>;
const SESION = { userId: 'u-1', account: { plan: 'gratis' } };

beforeEach(() => {
  preguntarAlModelo.mockReset();
  currentSession.mockReset();
  currentSession.mockResolvedValue(SESION);
  frenarPorCuenta.mockReset();
  frenarPorCuenta.mockResolvedValue(null);
  asentarGasto.mockReset();
  abrirPuertaDeIa.mockReset();
  abrirPuertaDeIa.mockResolvedValue({ reserva: null });
  frenarPorDireccion.mockReset();
  frenarPorDireccion.mockResolvedValue(null);
  comprobarProveedor.mockReset();
  comprobarProveedor.mockReturnValue(null);
  aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  aviso.mockRestore();
});

describe('una petición que no vale', () => {
  it('sin nada más que decir, la frase de siempre', async () => {
    const res = await responderConModelo(pedir({}), ruta());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'invalid_request', message: 'falta algo' } });
  });

  it('con un motivo concreto, ése', async () => {
    const res = await responderConModelo(
      pedir({}),
      ruta(() => 'ya no cabe'),
    );

    expect((await res.json()) as unknown).toEqual({
      error: { code: 'invalid_request', message: 'ya no cabe' },
    });
  });

  it('y si el motivo no tiene nada concreto, también la de siempre', async () => {
    const res = await responderConModelo(
      pedir({}),
      ruta(() => null),
    );

    expect(((await res.json()) as { error: { message: string } }).error.message).toBe('falta algo');
    expect(preguntarAlModelo).not.toHaveBeenCalled();
  });
});

/**
 * **Un modelo caído no dejaba rastro**: el respaldo contesta un 200 y desde fuera
 * todo parece ir bien. Se avisa con el código, la ruta y el motivo, y nada de lo
 * que escribió quien pregunta.
 */
describe('el rastro de un modelo que no ha dado nada que valga', () => {
  it('lo del modelo sale tal cual, sin aviso', async () => {
    preguntarAlModelo.mockResolvedValue({ kind: 'modelo', respuesta: { answer: 'bien' } });

    const res = await responderConModelo(pedir({ vale: true }), ruta());

    expect(res.status).toBe(200);
    expect(aviso).not.toHaveBeenCalled();
  });

  it('con el respaldo, un 200 y su aviso', async () => {
    preguntarAlModelo.mockResolvedValue({
      kind: 'respaldo',
      respuesta: { answer: 'del glosario' },
      fallo: 'model_unavailable',
    });

    const res = await responderConModelo(
      pedir({ vale: true, question: 'mi pregunta secreta' }),
      ruta(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: 'del glosario' });
    expect(aviso).toHaveBeenCalledOnce();
    const linea = String(aviso.mock.calls[0]![0]);
    expect(linea).toContain('ruta=profesor');
    expect(linea).toContain('codigo=200');
    expect(linea).toContain('motivo=model_unavailable');
    expect(linea).not.toContain('secreta');
  });

  it('sin respaldo, el 502 y su aviso', async () => {
    preguntarAlModelo.mockResolvedValue({ kind: 'error', fallo: 'unparseable_response' });

    const res = await responderConModelo(pedir({ vale: true }), ruta());

    expect(res.status).toBe(502);
    expect(String(aviso.mock.calls[0]![0])).toContain('codigo=502 motivo=unparseable_response');
  });
});

/**
 * **Quién pide, antes que qué pide** (adr/0114). Una petición anónima no hace
 * trabajo de dominio con su cuerpo, y el límite por minuto es de la cuenta: con
 * el de dirección delante y sin proxy de confianza, diez anónimas seguidas
 * dejaban sin IA a todas las cuentas.
 */
describe('la cuenta va antes que el cuerpo', () => {
  it('sin sesión, 401 sin leer ni validar el cuerpo', async () => {
    currentSession.mockResolvedValue(null);
    const porQueNoVale = vi.fn(() => 'no');
    const parse = vi.fn(() => null);

    const res = await responderConModelo(pedir({ vale: true }), { ...ruta(porQueNoVale), parse });

    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('account_required');
    expect(parse).not.toHaveBeenCalled();
    expect(frenarPorCuenta).not.toHaveBeenCalled();
    expect(abrirPuertaDeIa).not.toHaveBeenCalled();
  });

  it('frena por la cuenta que pide, no por la dirección', async () => {
    frenarPorCuenta.mockResolvedValue(new Response(null, { status: 429 }));
    const parse = vi.fn(() => null);

    const res = await responderConModelo(pedir({ vale: true }), { ...ruta(), parse });

    expect(res.status).toBe(429);
    expect(frenarPorCuenta.mock.calls[0]![0]).toBe('u-1');
    expect(parse).not.toHaveBeenCalled();
  });

  it('y a la puerta del cupo le pasa la sesión que ya ha leído', async () => {
    preguntarAlModelo.mockResolvedValue({ kind: 'modelo', respuesta: {} });

    await responderConModelo(pedir({ vale: true }), ruta());

    expect(abrirPuertaDeIa.mock.calls[0]![1]).toBe(SESION);
  });
});

/**
 * **Lo gastado de verdad se asienta en el techo** (adr/0114): lo que dice `usage`
 * de cada llamada, al precio del modelo, y el peor caso de una llamada si no lo
 * dice.
 */
describe('lo que se asienta en el techo de gasto', () => {
  const reserva = { mes: '2026-10', dia: '2026-10-07', micros: 99_999, gratis: true };

  it('suma el usage de cada llamada, y el peor caso de la que no lo trae', async () => {
    const antes = process.env['ANTHROPIC_MODEL'];
    process.env['ANTHROPIC_MODEL'] = 'claude-sonnet-5-5';
    process.env['ANTHROPIC_API_KEY'] = 'sk-de-mentira';
    abrirPuertaDeIa.mockResolvedValue({ reserva });
    preguntarAlModelo.mockImplementation(
      async (_ruta: unknown, _peticion: unknown, { alUsar }: { alUsar: (u: unknown) => void }) => {
        alUsar({ entrada: 1000, salida: 100 });
        alUsar(null);
        return { kind: 'modelo', respuesta: {} };
      },
    );

    try {
      await responderConModelo(pedir({ vale: true }), ruta());
    } finally {
      process.env['ANTHROPIC_MODEL'] = antes;
      delete process.env['ANTHROPIC_API_KEY'];
    }

    const { costeDeUso, peorLlamadaMicros } = await import('@core/billing');
    expect(asentarGasto).toHaveBeenCalledWith(
      reserva,
      costeDeUso({ entrada: 1000, salida: 100 }, 'claude-sonnet-5-5') +
        peorLlamadaMicros('profesor', 'claude-sonnet-5-5'),
    );
  });

  it('también cuando el modelo no da nada que valga, que se ha pagado igual', async () => {
    abrirPuertaDeIa.mockResolvedValue({ reserva });
    preguntarAlModelo.mockResolvedValue({ kind: 'error', fallo: 'model_unavailable' });

    const res = await responderConModelo(pedir({ vale: true }), ruta());

    expect(res.status).toBe(502);
    expect(asentarGasto).toHaveBeenCalledWith(reserva, 0);
  });

  it('sin reserva —modelo de casa o dominio— no hay nada que asentar', async () => {
    preguntarAlModelo.mockResolvedValue({ kind: 'modelo', respuesta: {} });

    await responderConModelo(pedir({ vale: true }), ruta());

    expect(asentarGasto).not.toHaveBeenCalled();
  });

  it('una puerta cerrada se contesta tal cual, sin preguntar al modelo', async () => {
    abrirPuertaDeIa.mockResolvedValue(new NextResponse(null, { status: 503 }));

    const res = await responderConModelo(pedir({ vale: true }), ruta());

    expect(res.status).toBe(503);
    expect(preguntarAlModelo).not.toHaveBeenCalled();
  });
});

describe('lo barato va antes que la sesión', () => {
  it('frenada por dirección, no se lee la sesión', async () => {
    frenarPorDireccion.mockResolvedValue(new NextResponse(null, { status: 429 }));

    expect((await responderConModelo(pedir({ vale: true }), ruta())).status).toBe(429);
    expect(currentSession).not.toHaveBeenCalled();
  });

  it('sin modelo, tampoco', async () => {
    comprobarProveedor.mockReturnValue(new NextResponse(null, { status: 503 }));

    expect((await responderConModelo(pedir({ vale: true }), ruta())).status).toBe(503);
    expect(currentSession).not.toHaveBeenCalled();
  });
});
