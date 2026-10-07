import { describe, expect, it } from 'vitest';

import { filtrar } from './biquad';

/**
 * El filtro del libro de cocina, el mismo que `BiquadFilterNode`. Lo que se fija
 * es lo que se le pide: que deje pasar lo de su lado y apague lo del otro.
 */
const SR = 48_000;

function seno(hz: number): Float32Array {
  return Float32Array.from({ length: SR / 10 }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SR));
}

/** El nivel de la segunda mitad, cuando el filtro ya se ha asentado. */
function nivel(muestras: Float32Array): number {
  const cola = muestras.subarray(muestras.length / 2);
  return Math.sqrt(cola.reduce((suma, valor) => suma + valor * valor, 0) / cola.length);
}

describe('el filtro', () => {
  it('el paso bajo deja pasar el grave y apaga el agudo', () => {
    expect(nivel(filtrar(seno(200), 'paso-bajo', 3000, SR))).toBeCloseTo(Math.SQRT1_2, 1);
    expect(nivel(filtrar(seno(12_000), 'paso-bajo', 3000, SR))).toBeLessThan(0.07);
  });

  it('el paso alto, al reves', () => {
    expect(nivel(filtrar(seno(12_000), 'paso-alto', 4500, SR))).toBeCloseTo(Math.SQRT1_2, 1);
    expect(nivel(filtrar(seno(500), 'paso-alto', 4500, SR))).toBeLessThan(0.02);
  });

  it('en el corte, la mitad de la potencia', () => {
    expect(nivel(filtrar(seno(3000), 'paso-bajo', 3000, SR))).toBeCloseTo(0.5, 1);
  });
});
