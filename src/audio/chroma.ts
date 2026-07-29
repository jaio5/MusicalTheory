/**
 * Croma: cuánta energía hay de cada una de las doce notas, olvidando la octava.
 *
 * Es lo que permite reconocer un acorde, que la autocorrelación no puede: esa
 * busca un único periodo y un acorde tiene tres o cuatro a la vez.
 *
 * El problema de verdad no es doblar octavas, es que los armónicos mienten. Una
 * sexta al aire suena con su quinta y su tercera mayor encima por física pura, y
 * un croma ingenuo ve un acorde de E mayor donde solo hay una cuerda pulsada.
 * Por eso lo que se suma no es el espectro entero, sino los picos, y cada pico
 * se descuenta si hay otro más fuerte del que podría ser armónico.
 */

const SEMITONES = 12;
/** A4 = 440 Hz es la referencia de todo el dominio. */
const A4_HZ = 440;
const A4_MIDI = 69;

export interface ChromaOptions {
  readonly sampleRate: number;
  /** Muestras del bloque analizado. El espectro tiene la mitad de casillas. */
  readonly fftSize: number;
  /** Por debajo hay zumbido de red y ruido de sala. */
  readonly minHz?: number;
  /** Por encima solo quedan armónicos y siseo. */
  readonly maxHz?: number;
  /** Cuánto por debajo del pico más alto se sigue mirando, en decibelios. */
  readonly rangeDb?: number;
}

const DEFAULTS = {
  minHz: 70,
  maxHz: 2200,
  rangeDb: 40,
} as const;

/** Lo que queda de un pico cuando otro más grave lo explica como armónico. */
const HARMONIC_KEEP = 0.2;
/** Hasta qué armónico se busca el padre de un pico. */
const MAX_HARMONIC = 6;
/** Margen para dar por bueno un armónico, en semitonos. */
const HARMONIC_TOLERANCE = 0.35;

interface Peak {
  readonly frequency: number;
  /** Amplitud lineal, no decibelios. */
  readonly weight: number;
}

export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/** Distancia en semitonos entre dos frecuencias. Positiva si `to` es más aguda. */
function semitonesBetween(from: number, to: number): number {
  return SEMITONES * Math.log2(to / from);
}

function pitchClassOf(frequency: number): number {
  const midi = A4_MIDI + semitonesBetween(A4_HZ, frequency);
  return ((Math.round(midi) % SEMITONES) + SEMITONES) % SEMITONES;
}

/**
 * Los picos del espectro, de más fuerte a más flojo.
 *
 * Se queda con los máximos locales, no con todas las casillas: entre dos notas
 * el espectro no está vacío, está lleno de faldas, y sumarlas emborrona el
 * croma hasta dejarlo plano.
 */
function findPeaks(
  spectrumDb: readonly number[] | Float32Array,
  options: Required<ChromaOptions>,
): Peak[] {
  const { sampleRate, fftSize, minHz, maxHz, rangeDb } = options;
  const binHz = sampleRate / fftSize;
  const first = Math.max(1, Math.floor(minHz / binHz));
  const last = Math.min(spectrumDb.length - 2, Math.ceil(maxHz / binHz));

  let loudest = -Infinity;
  for (let bin = first; bin <= last; bin += 1) {
    loudest = Math.max(loudest, spectrumDb[bin]!);
  }
  if (!Number.isFinite(loudest)) {
    return [];
  }

  const floor = loudest - rangeDb;
  const peaks: Peak[] = [];

  for (let bin = first; bin <= last; bin += 1) {
    const value = spectrumDb[bin]!;
    if (value < floor || value <= spectrumDb[bin - 1]! || value < spectrumDb[bin + 1]!) {
      continue;
    }

    // Interpolación parabólica sobre los tres puntos: sin esto, la resolución
    // de la FFT deja la nota a medio semitono de donde está de verdad.
    const previous = spectrumDb[bin - 1]!;
    const next = spectrumDb[bin + 1]!;
    const shift = (0.5 * (previous - next)) / (previous - 2 * value + next || 1);
    const frequency = (bin + shift) * binHz;

    if (frequency >= minHz && frequency <= maxHz) {
      peaks.push({ frequency, weight: dbToLinear(value - loudest) });
    }
  }

  return peaks.sort((a, b) => b.weight - a.weight);
}

/**
 * Descuenta los picos que otro más grave y más fuerte ya explica.
 *
 * No se borran del todo: una nota puede coincidir con el armónico de otra y
 * estar sonando de verdad —pasa en cualquier acorde—, así que se le quita peso,
 * no la palabra.
 */
function discountHarmonics(peaks: readonly Peak[]): Peak[] {
  return peaks.map((peak, index) => {
    for (let other = 0; other < index; other += 1) {
      const parent = peaks[other]!;
      if (parent.frequency >= peak.frequency) {
        continue;
      }
      const ratio = peak.frequency / parent.frequency;
      for (let harmonic = 2; harmonic <= MAX_HARMONIC; harmonic += 1) {
        if (Math.abs(semitonesBetween(harmonic, ratio)) <= HARMONIC_TOLERANCE) {
          return { ...peak, weight: peak.weight * HARMONIC_KEEP };
        }
      }
    }
    return peak;
  });
}

/**
 * El croma de un espectro, normalizado para que el máximo valga 1.
 *
 * Devuelve doce números, uno por nota, empezando en C. Todo ceros si no hay
 * nada que mirar, que es información: significa que no suena nada reconocible.
 */
export function chromaFromSpectrum(
  spectrumDb: readonly number[] | Float32Array,
  options: ChromaOptions,
): number[] {
  const settings: Required<ChromaOptions> = { ...DEFAULTS, ...options };
  const chroma = new Array<number>(SEMITONES).fill(0);

  for (const peak of discountHarmonics(findPeaks(spectrumDb, settings))) {
    const pitchClass = pitchClassOf(peak.frequency);
    chroma[pitchClass] = (chroma[pitchClass] ?? 0) + peak.weight;
  }

  const top = Math.max(...chroma);
  if (top <= 0) {
    return chroma;
  }
  return chroma.map((value) => value / top);
}
