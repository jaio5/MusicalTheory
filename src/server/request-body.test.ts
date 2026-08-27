import { describe, expect, it } from 'vitest';

import { readJsonBody } from './request-body';

/**
 * El cuerpo de una petición, leído sin creerse nada.
 *
 * La decisión que fija este test es que **un cuerpo roto se lee como uno vacío y
 * no como un error**. Quien decide si falta algo es la validación de cada campo,
 * que sabe qué falta y puede decirlo en español: un «cuerpo inválido» genérico
 * diría menos y obligaría a adivinar cuál de los seis campos era.
 */

function pedir(body?: BodyInit): Request {
  return new Request('http://x/api/loquesea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body }),
  });
}

describe('leer el cuerpo', () => {
  it('un objeto se lee tal cual', async () => {
    expect(await readJsonBody(pedir(JSON.stringify({ plan: 'pro' })))).toEqual({ plan: 'pro' });
  });

  it('un cuerpo que no es JSON se lee como vacio', async () => {
    expect(await readJsonBody(pedir('{esto no es json'))).toEqual({});
  });

  it('sin cuerpo, tambien', async () => {
    expect(await readJsonBody(pedir())).toEqual({});
  });

  it('y lo que es JSON pero no un objeto, igual', async () => {
    // Una lista o un número no tienen campos que leer, así que son lo mismo que
    // no haber mandado nada.
    for (const cuerpo of ['[1,2,3]', '"una cadena"', '42', 'null']) {
      expect(await readJsonBody(pedir(cuerpo)), cuerpo).toEqual({});
    }
  });
});
