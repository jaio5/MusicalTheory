import { describe, expect, it } from 'vitest';

import { MAX_CUERPO, readJsonBody } from './request-body';

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

/**
 * **Un cuerpo enorme se rechaza sin llegar a leerlo entero.**
 *
 * El dominio acota lo que se guarda —doce secciones, treinta y dos grados—, pero
 * eso se comprueba después de tener el JSON en memoria. Era la única puerta de la
 * aplicación por la que entraba algo de tamaño libre.
 */
describe('el tope de tamaño', () => {
  /** Un JSON válido que pesa lo que se le pida. */
  function gordo(bytes: number): string {
    return JSON.stringify({ relleno: 'x'.repeat(bytes) });
  }

  it('lo que cabe se lee entero', async () => {
    const justo = gordo(MAX_CUERPO - 100);
    expect(justo.length).toBeLessThan(MAX_CUERPO);
    expect(await readJsonBody(pedir(justo))).toHaveProperty('relleno');
  });

  it('lo que se pasa se lee como vacio', async () => {
    expect(await readJsonBody(pedir(gordo(MAX_CUERPO + 1000)))).toEqual({});
  });

  /**
   * La cabecera no basta: en una petición troceada no viene, y quien quiera
   * hacer daño puede simplemente no ponerla. Por eso el flujo se lee a trozos y
   * se corta al pasarse, en vez de fiarse de lo que el cliente declara.
   */
  it('sin content-length tambien se corta', async () => {
    const enorme = new TextEncoder().encode(gordo(MAX_CUERPO + 1000));
    const flujo = new ReadableStream<Uint8Array>({
      start(controlador) {
        // A trozos, que es como llega de verdad y es donde se tiene que cortar.
        for (let i = 0; i < enorme.length; i += 8192) {
          controlador.enqueue(enorme.subarray(i, i + 8192));
        }
        controlador.close();
      },
    });
    const peticion = new Request('http://x/api/loquesea', {
      method: 'POST',
      body: flujo,
      // @ts-expect-error -- `duplex` hace falta para mandar un flujo y los tipos de Node no lo declaran
      duplex: 'half',
    });

    expect(peticion.headers.get('content-length')).toBeNull();
    expect(await readJsonBody(peticion)).toEqual({});
  });

  it('un content-length que miente por lo alto se rechaza sin leer', async () => {
    const peticion = new Request('http://x/api/loquesea', {
      method: 'POST',
      headers: { 'content-length': String(MAX_CUERPO * 100) },
      body: JSON.stringify({ plan: 'pro' }),
    });
    expect(await readJsonBody(peticion)).toEqual({});
  });
});
