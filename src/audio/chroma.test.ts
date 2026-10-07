import { describe, expect, it } from 'vitest';

import { PARECIDO_MINIMO, readChord } from '@core/music';

import { ACORDES_HASTA_HZ, chromaFromSpectrum, dbToLinear, leerEspectro } from './chroma';
import { spectrumDb } from './fft';
import { aleatorio } from './guitarra-sintetica';

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

function chroma(peaks: ReadonlyArray<{ hz: number; db: number }>, maxHz?: number): number[] {
  return chromaFromSpectrum(spectrumWith(peaks), {
    sampleRate: SAMPLE_RATE,
    fftSize: FFT_SIZE,
    ...(maxHz === undefined ? {} : { maxHz }),
  });
}

function bajoDe(peaks: ReadonlyArray<{ hz: number; db: number }>): number | null {
  return leerEspectro(spectrumWith(peaks), { sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE }).bajo;
}

/**
 * Un La grave como lo da una sexta o una quinta cuerda: la fundamental floja
 * —la caja casi no la radia— y la serie fuerte, con su séptimo armónico, que cae
 * a treinta centésimas de un Sol, y su noveno, en un Si.
 */
const LA_GRAVE = [
  { hz: 110, db: -14 },
  { hz: 220, db: 0 },
  { hz: 330, db: -4 },
  { hz: 440, db: -6 },
  { hz: 550, db: -8 },
  { hz: 660, db: -8 },
  { hz: 770, db: -8 },
  { hz: 880, db: -10 },
  { hz: 990, db: -10 },
] as const;

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

  it('el séptimo armónico de una cuerda grave no inventa una séptima', () => {
    const result = chroma(LA_GRAVE);

    expect(strongest(result)).toEqual([9]);
    expect(result[7]).toBeLessThan(0.1); // Sol: el séptimo armónico
    expect(result[11]).toBeLessThan(0.1); // Si: el noveno
    expect(result[1]).toBeLessThan(0.1); // Do#: el quinto
  });

  /**
   * El exceso sobre la serie es otra nota. Si la cuerda de Mi suena encima del
   * tercer armónico del La, el Mi mide más de lo que la serie del La pone ahí, y
   * eso se queda: es lo que separa un La menor de un La pelado.
   */
  it('lo que suena por encima de la serie es una nota y se conserva', () => {
    const conMi = LA_GRAVE.map((pico) => (pico.hz === 330 ? { hz: 330, db: 4 } : pico));
    const result = chroma(conMi);

    expect(result[4]).toBeGreaterThan(0.4);
  });

  /**
   * Una quinta de verdad no es un armónico porque caiga donde caería uno: sin
   * serie alrededor no hay nada que diga cuánto pondría la cuerda de abajo.
   */
  it('sin serie alrededor, nada se explica', () => {
    const result = chroma([
      { hz: 110, db: -6 },
      { hz: 330, db: -6 },
    ]);

    expect(strongest(result).sort((a, b) => a - b)).toEqual([4, 9]);
  });

  /**
   * Por encima del techo no hay picos, y no estar no es medir cero: el armónico
   * de debajo del techo se mide solo con el vecino de abajo.
   */
  it('con el techo del análisis, el vecino de arriba no se mira', () => {
    const result = chroma(LA_GRAVE, ACORDES_HASTA_HZ);

    expect(result[11]).toBeLessThan(0.1);
  });

  it('los decibelios se convierten a amplitud como manda la definición', () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 6);
  });
});

describe('un espectro sin nada', () => {
  /**
   * Un espectro entero a menos infinito no es un acorde silencioso: es que no
   * hay nada que medir. Sin esto, el suelo se calcularía contra `-Infinity` y
   * todas las casillas pasarían el filtro.
   */
  it('no saca ninguna nota', () => {
    const vacio = new Float32Array(BINS).fill(Number.NEGATIVE_INFINITY);

    const chroma = chromaFromSpectrum(vacio, { sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE });

    expect(chroma.every((valor) => valor === 0)).toBe(true);
  });
});

describe('el bajo', () => {
  it('es la nota más grave que suena de verdad, no la más fuerte', () => {
    // C/E: Mi abajo, más flojo que el Do de encima.
    expect(
      bajoDe([
        { hz: 82.4, db: -12 },
        { hz: 130.8, db: -6 },
        { hz: 196, db: -8 },
        { hz: 261.6, db: -6 },
      ]),
    ).toBe(4);
  });

  it('un pico de la sala por debajo no es el bajo', () => {
    expect(
      bajoDe([
        { hz: 100, db: -30 }, // el zumbido de la red
        { hz: 110, db: -8 },
        { hz: 261.6, db: -6 },
        { hz: 329.6, db: -6 },
      ]),
    ).toBe(9);
  });

  it('sin nada que oír no hay bajo', () => {
    expect(bajoDe([])).toBeNull();
  });
});

describe('el ruido de una sala', () => {
  /**
   * **Por qué el margen del armónico es una décima de semitono.** En ruido, el
   * espectro está lleno de picos, y con un margen ancho casi todos tienen otro
   * debajo a una razón entera: el descuento se come el ruido a bocados y lo que
   * queda se parece a un acorde. Con 35 centésimas la media de estas veinte
   * ventanas pasaba de 0,67; con el margen estrecho se queda donde estaba antes
   * del descuento por la serie.
   */
  it('no se parece a ningún acorde', () => {
    const fft = 16_384;
    const espectro = new Float32Array(fft / 2);
    const parecidos: number[] = [];
    for (let semilla = 1; semilla <= 20; semilla += 1) {
      const azar = aleatorio(semilla);
      spectrumDb(
        Float32Array.from({ length: fft }, () => azar() * 0.002),
        espectro,
      );
      const { croma, bajo } = leerEspectro(espectro, {
        sampleRate: SAMPLE_RATE,
        fftSize: fft,
        maxHz: ACORDES_HASTA_HZ,
      });
      parecidos.push(readChord(croma, { minScore: 0, bajo })!.best.score);
    }

    expect(Math.max(...parecidos)).toBeLessThan(PARECIDO_MINIMO);
    expect(parecidos.reduce((suma, valor) => suma + valor, 0) / parecidos.length).toBeLessThan(
      0.66,
    );
  });
});
