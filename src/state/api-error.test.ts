import { describe, expect, it } from 'vitest';

import { apiErrorFrom, apiErrorOf } from './api-error';

/**
 * El sobre de error que contestan todas las rutas.
 *
 * Estaba leído a mano en cuatro sitios con cuatro variantes de la misma
 * comprobación, y de ahí salió esto. Lo que hay que fijar es lo que esas cuatro
 * variantes hacían distinto: qué pasa cuando el servidor no contesta un sobre,
 * cuando contesta HTML, o cuando trae el código pero no la frase.
 */

describe('leer el error de un cuerpo', () => {
  it('saca el código y la frase cuando vienen los dos', () => {
    const error = apiErrorOf(
      { error: { code: 'plan_required', message: 'No entra en tu plan.' } },
      'da igual',
    );

    expect(error).toEqual({ code: 'plan_required', message: 'No entra en tu plan.' });
  });

  it('el código se devuelve además de la frase, porque no todo se arregla igual', () => {
    // Un «no entra en tu plan» lleva a la pantalla de planes; un modelo caído no
    // lleva a ningún sitio. Sin el código habría que adivinarlo de la frase.
    expect(apiErrorOf({ error: { code: 'model_unavailable' } }, 'respaldo').code).toBe(
      'model_unavailable',
    );
  });

  it('sin frase legible se usa la de respaldo, que la pone quien llama', () => {
    // «No hemos podido guardar la canción» y «no hemos podido contactar con el
    // modelo» no son la misma frase, y el servidor no siempre puede saber cuál
    // tocaba.
    for (const payload of [
      null,
      'una cadena',
      42,
      {},
      { error: null },
      { error: 'texto' },
      { error: {} },
      { error: { message: '' } },
      { error: { message: 42 } },
    ]) {
      expect(apiErrorOf(payload, 'respaldo').message, JSON.stringify(payload)).toBe('respaldo');
    }
  });

  it('un código que no es una cadena es como no tenerlo', () => {
    expect(apiErrorOf({ error: { code: 7, message: 'algo' } }, 'respaldo').code).toBeNull();
  });
});

describe('leer el error de una respuesta', () => {
  it('interpreta el cuerpo cuando es JSON', async () => {
    const respuesta = new Response(
      JSON.stringify({ error: { code: 'llena', message: 'No cabe.' } }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(await apiErrorFrom(respuesta, 'respaldo')).toEqual({
      code: 'llena',
      message: 'No cabe.',
    });
  });

  it('un cuerpo que no es JSON devuelve la frase de respaldo en vez de lanzar', async () => {
    // Una pasarela caída o un proxy que se mete por medio contestan HTML, y eso
    // no puede convertirse en una excepción sin mensaje delante de quien mira.
    const respuesta = new Response('<html>502 Bad Gateway</html>', { status: 502 });

    expect(await apiErrorFrom(respuesta, 'No hemos podido contactar.')).toEqual({
      code: null,
      message: 'No hemos podido contactar.',
    });
  });

  it('un cuerpo vacío tampoco lanza', async () => {
    expect(await apiErrorFrom(new Response('', { status: 500 }), 'respaldo')).toMatchObject({
      message: 'respaldo',
    });
  });
});
