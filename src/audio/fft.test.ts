import { describe, expect, it } from 'vitest';

import { chromaFromSpectrum } from './chroma';
import { spectrumDb, fftInPlace, FLOOR_DB } from './fft';

const SAMPLE_RATE = 48_000;

/** Un tono puro, o la suma de varios. */
function tono(hz: readonly number[], muestras: number, amplitud = 0.5): Float32Array {
  const x = new Float32Array(muestras);
  for (let i = 0; i < muestras; i += 1) {
    let v = 0;
    for (const f of hz) {
      v += Math.sin((2 * Math.PI * f * i) / SAMPLE_RATE);
    }
    x[i] = (v / hz.length) * amplitud;
  }
  return x;
}

/** La casilla más alta del espectro, y a qué frecuencia cae. */
function picoDe(espectro: Float32Array, fftSize: number): { hz: number; db: number } {
  let mejor = 0;
  for (let i = 1; i < espectro.length; i += 1) {
    if (espectro[i]! > espectro[mejor]!) {
      mejor = i;
    }
  }
  return { hz: (mejor * SAMPLE_RATE) / fftSize, db: espectro[mejor]! };
}

describe('la FFT', () => {
  it('exige potencia de dos', () => {
    expect(() => fftInPlace(new Float32Array(3), new Float32Array(3))).toThrow(RangeError);
    expect(() => fftInPlace(new Float32Array(8), new Float32Array(4))).toThrow(RangeError);
  });

  it('pone el pico donde está la nota', () => {
    // A4 son 440 Hz. Con 4096 muestras a 48 kHz cada casilla mide 11,7 Hz, así
    // que el pico tiene que caer a menos de una casilla del sitio.
    const espectro = spectrumDb(tono([440], 4096), undefined);
    const pico = picoDe(espectro, 4096);

    expect(Math.abs(pico.hz - 440)).toBeLessThan(SAMPLE_RATE / 4096);
  });

  it('el silencio se queda en el suelo', () => {
    const espectro = spectrumDb(new Float32Array(1024));

    expect(Math.max(...espectro)).toBe(FLOOR_DB);
  });

  it('el nivel no depende del tamaño de la ventana', () => {
    // Si dependiera, doblar la ventana subiría todo y los umbrales de chroma.ts
    // —que están ajustados en decibelios— dejarían de valer.
    const corta = picoDe(spectrumDb(tono([440], 2048)), 2048);
    const larga = picoDe(spectrumDb(tono([440], 8192)), 8192);

    expect(Math.abs(corta.db - larga.db)).toBeLessThan(1.5);
  });

  it('la ventana larga separa lo que la corta no', () => {
    // La razón de todo esto. Dos semitonos en el grave —E2 y F2, 82,4 y 87,3 Hz—
    // están a 4,9 Hz. Con 2048 muestras una casilla mide 23,4 Hz y los dos caen
    // en la misma; con 16384 mide 2,9 Hz y se ven separados.
    const dos = [82.41, 87.31];

    const corta = spectrumDb(tono(dos, 2048));
    const larga = spectrumDb(tono(dos, 16_384));

    const casillasSobreUmbral = (espectro: Float32Array, desde: number, hasta: number) => {
      const binDe = (hz: number) => Math.round((hz * espectro.length * 2) / SAMPLE_RATE);
      let cuentas = 0;
      for (let i = binDe(desde); i <= binDe(hasta); i += 1) {
        if (espectro[i]! > -60) {
          cuentas += 1;
        }
      }
      return cuentas;
    };

    // Con la ventana larga hay más casillas encendidas en esa franja: los dos
    // picos existen por separado en vez de fundirse en uno.
    expect(casillasSobreUmbral(larga, 75, 95)).toBeGreaterThan(casillasSobreUmbral(corta, 75, 95));
  });
});

describe('la FFT y el croma se entienden', () => {
  /**
   * Lo que de verdad hay que comprobar: que un espectro salido de aquí lo lee
   * `chroma.ts` igual que el que le da el navegador en vivo. Si no, el análisis
   * de una grabación diría cosas distintas que el de la misma señal en directo,
   * y eso sería peor que no tenerlo.
   */
  it('un acorde de La menor sale con sus tres notas arriba', () => {
    // A3 220, C4 261,63, E4 329,63. Con sus terceros armónicos, como una
    // guitarra de verdad.
    const señal = tono([220, 261.63, 329.63, 440, 523.25, 659.26], 16_384);
    const chroma = chromaFromSpectrum(spectrumDb(señal), {
      sampleRate: SAMPLE_RATE,
      fftSize: 16_384,
    });

    const NOMBRES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const tresMasFuertes = chroma
      .map((peso, i) => ({ nota: NOMBRES[i]!, peso }))
      .sort((a, b) => b.peso - a.peso)
      .slice(0, 3)
      .map((x) => x.nota)
      .sort();

    expect(tresMasFuertes).toEqual(['A', 'C', 'E']);
  });
});
