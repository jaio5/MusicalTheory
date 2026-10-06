import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AskModel from './ask-model';

/**
 * El bucle de los intentos, solo: el reintento, qué hace con un modelo que no
 * contesta y **el respaldo**, que es lo que hace que una ruta pueda no quedarse
 * nunca sin respuesta. Con una ruta de mentira, porque lo que se prueba es el
 * bucle y no lo que pregunta cada una.
 */

const askModel = vi.fn();

vi.mock('./ask-model', async (original) => ({
  // La clase de verdad: el bucle la compara con `instanceof`.
  ...(await original<typeof AskModel>()),
  askModel: (...args: unknown[]) => askModel(...args),
}));

const { preguntarAlModelo } = await import('./ai-intentos');
const { RespuestaTruncada } = await import('./ask-model');

/** Vale lo que trae `bien: true`, y el respaldo dice por qué ha hecho falta. */
function ruta(respaldo?: (peticion: string, fallo: string) => string | null) {
  return {
    prompt: (peticion: string) => `pregunta: ${peticion}`,
    system: 'sistema',
    schema: () => ({ type: 'object' }),
    maxTokens: 100,
    sinClave: () => ({ bien: true }),
    validar: (payload: unknown) =>
      (payload as { bien?: boolean } | null)?.bien === true ? 'del modelo' : null,
    ...(respaldo === undefined ? {} : { respaldo }),
  };
}

beforeEach(() => {
  askModel.mockReset();
});

describe('lo que vale a la primera o a la segunda', () => {
  it('a la primera, sin reintento', async () => {
    askModel.mockResolvedValue({ bien: true });

    const desenlace = await preguntarAlModelo(ruta(), 'x');

    expect(desenlace).toEqual({ kind: 'modelo', respuesta: 'del modelo' });
    expect(askModel).toHaveBeenCalledTimes(1);
  });

  it('el reintento lleva su número, que es lo que sube la temperatura', async () => {
    askModel.mockResolvedValueOnce({ bien: false }).mockResolvedValueOnce({ bien: true });

    const desenlace = await preguntarAlModelo(ruta(), 'x');

    expect(desenlace.kind).toBe('modelo');
    expect(
      askModel.mock.calls.map(([peticion]) => (peticion as { intento: number }).intento),
    ).toEqual([0, 1]);
  });

  it('enseña cada intento a quien lo pida, antes de validarlo', async () => {
    askModel.mockResolvedValueOnce({ bien: false }).mockResolvedValueOnce({ bien: true });
    const vistos: unknown[] = [];

    await preguntarAlModelo(ruta(), 'x', { alIntentar: (dicho) => vistos.push(dicho) });

    expect(vistos).toEqual([{ bien: false }, { bien: true }]);
  });

  it('sin clave pregunta al dominio por la misma puerta', async () => {
    askModel.mockImplementation(async ({ sinClave }: { sinClave: () => unknown }) => sinClave());

    const desenlace = await preguntarAlModelo(ruta(), 'x');

    expect(desenlace).toEqual({ kind: 'modelo', respuesta: 'del modelo' });
  });
});

describe('sin respaldo, el error de siempre', () => {
  it('lo que no vale dos veces es unparseable_response', async () => {
    askModel.mockResolvedValue({ bien: false });

    expect(await preguntarAlModelo(ruta(), 'x')).toEqual({
      kind: 'error',
      fallo: 'unparseable_response',
    });
    expect(askModel).toHaveBeenCalledTimes(2);
  });

  it('un modelo que no contesta es model_unavailable, y no se reintenta', async () => {
    askModel.mockRejectedValue(new Error('sin red'));

    expect(await preguntarAlModelo(ruta(), 'x')).toEqual({
      kind: 'error',
      fallo: 'model_unavailable',
    });
    expect(askModel).toHaveBeenCalledTimes(1);
  });

  it('una respuesta cortada no se reintenta: se cortaría igual', async () => {
    askModel.mockRejectedValue(new RespuestaTruncada());

    expect(await preguntarAlModelo(ruta(), 'x')).toEqual({
      kind: 'error',
      fallo: 'unparseable_response',
    });
    expect(askModel).toHaveBeenCalledTimes(1);
  });
});

describe('con respaldo, nunca sin respuesta', () => {
  const respaldo = (peticion: string, fallo: string) => `respaldo de ${peticion} por ${fallo}`;

  it('contesta el respaldo cuando lo dicho no vale dos veces, y dice por qué', async () => {
    askModel.mockResolvedValue({ bien: false });

    expect(await preguntarAlModelo(ruta(respaldo), 'x')).toEqual({
      kind: 'respaldo',
      respuesta: 'respaldo de x por unparseable_response',
      fallo: 'unparseable_response',
    });
  });

  it('y cuando el modelo no contesta', async () => {
    askModel.mockRejectedValue(new Error('sin red'));

    expect(await preguntarAlModelo(ruta(respaldo), 'x')).toMatchObject({
      kind: 'respaldo',
      fallo: 'model_unavailable',
    });
  });

  it('y cuando se corta', async () => {
    askModel.mockRejectedValue(new RespuestaTruncada());

    expect(await preguntarAlModelo(ruta(respaldo), 'x')).toMatchObject({
      kind: 'respaldo',
      fallo: 'unparseable_response',
    });
  });

  it('lo del modelo, si vale, gana al respaldo', async () => {
    askModel.mockResolvedValue({ bien: true });

    expect((await preguntarAlModelo(ruta(respaldo), 'x')).kind).toBe('modelo');
  });

  it('un respaldo que no tiene nada que decir deja el error', async () => {
    askModel.mockResolvedValue({ bien: false });

    expect(
      await preguntarAlModelo(
        ruta(() => null),
        'x',
      ),
    ).toEqual({
      kind: 'error',
      fallo: 'unparseable_response',
    });
  });
});
