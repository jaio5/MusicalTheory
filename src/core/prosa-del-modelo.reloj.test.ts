import { describe, expect, it } from 'vitest';

import { copiaLasInstrucciones, esUnCebo } from './prosa-del-modelo';
import { KB_128, tarda, TOPE_128_KB_MS } from './cronometro-para-tests';

/** Unas instrucciones de sistema cualquiera: lo que se mide es copiarlas. */
const INSTRUCCIONES = `Eres un guitarrista con años de tablas que explica teoría a otro que toca de
oído: no le expliques qué es una cuerda, pero no des por sabido el vocabulario.`;

describe('128 KB no paran el hilo', () => {
  it.each([
    ['letras', 'a'.repeat(KB_128)],
    ['letras y puntos', 'aa.'.repeat(KB_128 / 3)],
    ['guiones y puntos', '-.'.repeat(KB_128 / 2)],
    ['arrobas', 'a@'.repeat(KB_128 / 2)],
    ['palabras de las instrucciones', `${INSTRUCCIONES} `.repeat(KB_128 / INSTRUCCIONES.length)],
  ])('%s', (_, texto) => {
    for (const hacer of [
      () => esUnCebo(texto),
      () => copiaLasInstrucciones(texto, INSTRUCCIONES),
    ]) {
      expect(tarda(hacer)).toBeLessThan(TOPE_128_KB_MS);
    }
  });
});
