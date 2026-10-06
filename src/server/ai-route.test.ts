import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiError, type AiErrorCode } from '@core/ai-errors';

/**
 * El cuerpo común de las rutas de IA, con una ruta de mentira: lo que se prueba
 * aquí es **lo que sale de cada final** y el rastro que deja, no lo que pregunta
 * cada ruta. Las puertas se abren solas —tienen su test en `ai-gate.test.ts`— y el
 * bucle de los intentos se sustituye por el desenlace que toque.
 */

const preguntarAlModelo = vi.fn();

vi.mock('./ai-gate', () => ({
  frenarPorFrecuencia: async () => null,
  abrirPuertaDeIa: async () => null,
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
beforeEach(() => {
  preguntarAlModelo.mockReset();
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
