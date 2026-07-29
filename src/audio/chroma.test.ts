import { describe, expect, it } from 'vitest';

import { chromaFromSpectrum, dbToLinear } from './chroma';

const SAMPLE_RATE = 48_000;
const FFT_SIZE = 4096;
const BINS = FFT_SIZE / 2;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;

const SKIRT_DB = 12;

/**
 * Un espectro de mentira con picos donde se le diga, en decibelios.
 *
 * Las faldas se colocan torcidas a propósito, con la asimetría que hace que la
 * interpolación parabólica recupere la frecuencia exacta. Es lo que hace una
 * FFT de verdad: una casilla a 110 Hz mide casi dos semitonos de ancho, y sin
 * esa asimetría el espectro sintético estaría diciendo otra nota.
 */
function spectrumWith(peaks: ReadonlyArray<{ hz: number; db: number }>): Float32Array<ArrayBuffer> {
  const spectrum = new Float32Array(BINS).fill(-120);
  for (const { hz, db } of peaks) {
    const exact = hz / BIN_HZ;
    const bin = Math.round(exact);
    if (bin < 1 || bin >= BINS - 1) {
      continue;
    }
    const tilt = -2 * SKIRT_DB * (exact - bin);
    spectrum[bin - 1] = Math.max(spectrum[bin - 1]!, db - SKIRT_DB + tilt);
    spectrum[bin] = Math.max(spectrum[bin]!, db);
    spectrum[bin + 1] = Math.max(spectrum[bin + 1]!, db - SKIRT_DB - tilt);
  }
  return spectrum;
}

function chroma(peaks: ReadonlyArray<{ hz: number; db: number }>): number[] {
  return chromaFromSpectrum(spectrumWith(peaks), { sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE });
}

/** Las notas que destacan, de más a menos fuerte. */
function strongest(values: readonly number[], threshold = 0.4): number[] {
  return values
    .map((value, pitchClass) => ({ value, pitchClass }))
    .filter((entry) => entry.value >= threshold)
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.pitchClass);
}

describe('Croma', () => {
  it('una nota sola cae en su casilla y en ninguna otra', () => {
    const result = chroma([{ hz: 440, db: -10 }]);

    expect(result[9]).toBe(1);
    expect(strongest(result)).toEqual([9]);
  });

  it('sin nada que oír no se inventa nada', () => {
    expect(chroma([])).toEqual(new Array<number>(12).fill(0));
    expect(chroma([{ hz: 30, db: -10 }])).toEqual(new Array<number>(12).fill(0));
  });

  it('los armónicos de una cuerda al aire no inventan un acorde', () => {
    // Un A2 con su serie: la quinta y la tercera mayor salen solas por física.
    // Un croma ingenuo leería A mayor donde solo hay una cuerda pulsada.
    const result = chroma([
      { hz: 110, db: -6 },
      { hz: 220, db: -12 },
      { hz: 330, db: -16 },
      { hz: 440, db: -20 },
      { hz: 550, db: -26 },
    ]);

    expect(strongest(result)).toEqual([9]);
    // E y C# están, pero descontados: no mandan.
    expect(result[4]).toBeLessThan(0.5);
    expect(result[1]).toBeLessThan(0.5);
  });

  it('un acorde da sus tres notas', () => {
    // C mayor: C4, E4 y G4, cada una con su octava por encima.
    const result = chroma([
      { hz: 261.6, db: -8 },
      { hz: 329.6, db: -9 },
      { hz: 392.0, db: -9 },
      { hz: 523.3, db: -18 },
      { hz: 659.3, db: -19 },
      { hz: 784.0, db: -19 },
    ]);

    expect(strongest(result).sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('distingue mayor de menor por la tercera', () => {
    const menor = chroma([
      { hz: 261.6, db: -8 },
      { hz: 311.1, db: -9 },
      { hz: 392.0, db: -9 },
    ]);

    expect(strongest(menor).sort((a, b) => a - b)).toEqual([0, 3, 7]);
  });

  it('los decibelios se convierten a amplitud como manda la definición', () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 6);
  });
});
