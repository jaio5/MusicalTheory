import { describe, expect, it } from 'vitest';

import { centsBetween, midiToFrequency } from '@core/music';

import { detectPitch, type PitchDetectionOptions } from './autocorrelation';

const SAMPLE_RATE = 48_000;
const FRAME = 2048;

const OPTIONS: PitchDetectionOptions = {
  sampleRate: SAMPLE_RATE,
  minFrequency: 70,
  maxFrequency: 1400,
  rmsThreshold: 0.01,
  clarityThreshold: 0.9,
};

/** Genera un bloque con una fundamental y, si se piden, sus armónicos. */
function tone(
  frequency: number,
  { amplitude = 0.5, harmonics = [] as readonly number[], phase = 0, length = FRAME } = {},
): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    let value = Math.sin(2 * Math.PI * frequency * t + phase);
    harmonics.forEach((level, index) => {
      value += level * Math.sin(2 * Math.PI * frequency * (index + 2) * t + phase);
    });
    samples[i] = amplitude * value;
  }
  return samples;
}

/** Ruido reproducible: sin Math.random, para que el test no sea una lotería. */
function noise(length = FRAME): Float32Array {
  const samples = new Float32Array(length);
  let seed = 12_345;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    samples[i] = (seed / 2_147_483_648) * 2 - 1;
  }
  return samples;
}

describe('detección sobre tonos puros', () => {
  const cases = [
    ['Mi2, sexta al aire', 40],
    ['La2, quinta al aire', 45],
    ['Re3, cuarta al aire', 50],
    ['Sol3, tercera al aire', 55],
    ['Si3, segunda al aire', 59],
    ['Mi4, primera al aire', 64],
    ['La4, el diapasón', 69],
    ['Si5, traste 19 de la primera', 83],
  ] as const;

  for (const [name, midi] of cases) {
    it(`acierta ${name} con menos de un cent de error`, () => {
      const expected = midiToFrequency(midi);
      const detection = detectPitch(tone(expected), OPTIONS);

      expect(detection).not.toBeNull();
      expect(Math.abs(centsBetween(detection!.frequency, expected))).toBeLessThan(1);
    });
  }

  it('no depende de la fase de la señal', () => {
    const expected = midiToFrequency(55);
    for (const phase of [0, 0.7, 1.9, 3.1]) {
      const detection = detectPitch(tone(expected, { phase }), OPTIONS);
      expect(Math.abs(centsBetween(detection!.frequency, expected))).toBeLessThan(1);
    }
  });

  it('detecta también una nota floja, mientras pase el umbral de nivel', () => {
    const expected = midiToFrequency(45);
    const detection = detectPitch(tone(expected, { amplitude: 0.02 }), OPTIONS);

    expect(detection).not.toBeNull();
    expect(Math.abs(centsBetween(detection!.frequency, expected))).toBeLessThan(1);
  });
});

describe('detección sobre señal con armónicos', () => {
  it('devuelve la fundamental, no un armónico', () => {
    // Perfil parecido al de una cuerda pulsada limpia: la fundamental manda y
    // los armónicos van cayendo.
    const expected = midiToFrequency(45);
    const detection = detectPitch(tone(expected, { harmonics: [0.5, 0.3, 0.2, 0.1] }), OPTIONS);

    expect(detection).not.toBeNull();
    expect(Math.abs(centsBetween(detection!.frequency, expected))).toBeLessThan(2);
  });

  it('aguanta un segundo armónico tan fuerte como la fundamental', () => {
    const expected = midiToFrequency(50);
    const detection = detectPitch(tone(expected, { harmonics: [1, 0.4] }), OPTIONS);

    expect(detection).not.toBeNull();
    expect(Math.abs(centsBetween(detection!.frequency, expected))).toBeLessThan(2);
  });
});

describe('cuándo no dice nada', () => {
  it('calla con silencio', () => {
    expect(detectPitch(new Float32Array(FRAME), OPTIONS)).toBeNull();
  });

  it('calla por debajo del umbral de nivel', () => {
    expect(detectPitch(tone(220, { amplitude: 0.001 }), OPTIONS)).toBeNull();
  });

  it('calla con ruido, que no tiene periodo', () => {
    expect(detectPitch(noise(), OPTIONS)).toBeNull();
  });

  it('calla por debajo del rango: un bajo de cinco cuerdas no es asunto suyo', () => {
    expect(detectPitch(tone(45), OPTIONS)).toBeNull();
  });

  it('con algo por encima del rango devuelve un subarmónico, no null', () => {
    // Limitación asumida y documentada: una señal a 2000 Hz también es
    // periódica a 1000 Hz, así que el pico de 1000 cae dentro del rango y se
    // detecta. No afecta a la guitarra —el traste 24 de la primera cuerda está
    // en 1319 Hz— pero conviene que esté escrito y probado.
    const detection = detectPitch(tone(2000), OPTIONS);

    expect(detection).not.toBeNull();
    expect(detection!.frequency).toBeCloseTo(1000, 0);
  });

  it('calla si la ventana es demasiado corta para el rango pedido', () => {
    expect(detectPitch(tone(110, { length: 64 }), OPTIONS)).toBeNull();
  });
});

describe('confianza', () => {
  it('da confianza alta con un tono limpio y baja con señal sucia', () => {
    const clean = detectPitch(tone(220), OPTIONS);
    expect(clean!.clarity).toBeGreaterThan(0.98);

    const dirty = detectPitch(tone(220), { ...OPTIONS, clarityThreshold: 0 });
    const noisy = detectPitch(noise(), { ...OPTIONS, clarityThreshold: 0 });
    expect(noisy?.clarity ?? 0).toBeLessThan(dirty!.clarity);
  });

  it('informa del nivel de la señal', () => {
    const detection = detectPitch(tone(220, { amplitude: 0.5 }), OPTIONS);
    // Una senoide de amplitud A tiene un valor eficaz de A/raíz(2).
    expect(detection!.rms).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });
});
