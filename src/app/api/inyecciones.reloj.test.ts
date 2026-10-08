import { describe, expect, it } from 'vitest';

import { parseTeacherRequest } from '@features/learn/teacher-contract';
import { parseSalidasRequest } from '@features/salidas/contract';
import { KB_128, tarda, TOPE_128_KB_MS } from '@core/cronometro-para-tests';

import { PROFESOR } from './teacher/prompt';
import { SALIDAS } from './salidas/salidas';

/**
 * El ReDoS de la auditoría del 7 de octubre de 2026, contra el camino de verdad de
 * cada ruta (adr/0115). Aparte de `inyecciones.test.ts` porque mide tiempo de reloj
 * y esas pruebas corren solas (adr/0121).
 */

const DO_MAYOR = { tonic: 'C', mode: 'major' } as const;

/**
 * Lo que tarda **de más** con ese texto que con uno corto: leer una petición de
 * salidas construye el menú, que cuesta lo mismo escribas lo que escribas.
 */
function tardaDeMas(hacer: (texto: string) => unknown, texto: string): number {
  return tarda(() => hacer(texto)) - tarda(() => hacer('hola'));
}

describe('el ReDoS de la marca', () => {
  /**
   * Cuarenta mil almohadillas eran tres segundos en `sinMarca`, y un cuerpo de
   * 128 KB contra `/api/teacher`, cuarenta y siete con el hilo parado y sin cuenta:
   * la pregunta se limpia antes de mirar la sesión.
   */
  it.each([
    ['almohadillas', '#'.repeat(KB_128)],
    ['almohadillas y espacios', '## '.repeat(KB_128 / 3)],
    ['sostenidos', '♯'.repeat(KB_128 / 3)],
    ['marcas a medias', '##PREGUNT'.repeat(KB_128 / 9)],
    ['selectores', '#\uFE0F'.repeat(KB_128 / 2)],
  ])('128 KB de %s se leen en menos de 50 ms', (_, texto) => {
    expect(
      tardaDeMas((question) => parseTeacherRequest({ key: DO_MAYOR, question }), texto),
    ).toBeLessThan(TOPE_128_KB_MS);
    expect(
      tardaDeMas(
        (directrices) =>
          parseSalidasRequest({
            key: DO_MAYOR,
            kind: 'continuar',
            progression: [{ degree: 'I', beats: 4 }],
            directrices,
          }),
        texto,
      ),
    ).toBeLessThan(TOPE_128_KB_MS);
  });

  it('y lo que vuelve del modelo, por largo que venga, también', () => {
    const peticion = parseTeacherRequest({ key: DO_MAYOR, question: '¿Qué es una cadencia?' })!;
    const larga = `El acorde de G ${'nota '.repeat(KB_128 / 5)}`;
    expect(
      tardaDeMas((answer) => PROFESOR.validar({ tema: 'musica', answer }, peticion), larga),
    ).toBeLessThan(TOPE_128_KB_MS);
    const salidas = parseSalidasRequest({
      key: DO_MAYOR,
      kind: 'continuar',
      progression: [{ degree: 'I', beats: 4 }],
    })!;
    expect(
      tardaDeMas(
        (texto) =>
          SALIDAS.validar({ versions: [{ opcion: 1, title: texto, why: texto }] }, salidas),
        larga,
      ),
    ).toBeLessThan(TOPE_128_KB_MS);
  });
});
