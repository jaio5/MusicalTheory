/**
 * Detección de tono por autocorrelación normalizada.
 *
 * Es la única parte del análisis que es matemática pura: entra un bloque de
 * muestras y sale una frecuencia. No toca el navegador, así que se prueba en
 * Node con señales sintéticas. Vive en audio/ y no en core/ porque es
 * procesado de señal, no teoría musical.
 *
 * El método y los parámetros están razonados en docs/AUDIO-PITCH.md.
 */

export interface PitchDetectionOptions {
  /** Frecuencia de muestreo real del contexto de audio. */
  readonly sampleRate: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly rmsThreshold: number;
  readonly clarityThreshold: number;
}

export interface PitchDetection {
  readonly frequency: number;
  /** Altura del pico normalizado, de 0 a 1. */
  readonly clarity: number;
  readonly rms: number;
}

/**
 * Proporción respecto al mejor pico por debajo de la cual un candidato deja de
 * considerarse. Se coge el primer pico que la supere, no el más alto: entre dos
 * picos casi iguales, el de menor desplazamiento es el periodo fundamental y el
 * otro es su múltiplo. Sin esto, una nota limpia se detectaría una octava baja.
 */
const PEAK_TOLERANCE = 0.9;

/**
 * Devuelve la frecuencia fundamental del bloque, o null si no hay señal
 * suficiente, si el pico no es lo bastante claro o si la frecuencia se sale del
 * rango de la guitarra. Devolver null es una respuesta válida: es preferible no
 * decir nada a enseñar una nota inventada.
 */
/** Valor eficaz del bloque: cuánta señal está entrando. */
export function signalRms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let energy = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]!;
    energy += sample * sample;
  }
  return Math.sqrt(energy / samples.length);
}

export function detectPitch(
  samples: Float32Array,
  options: PitchDetectionOptions,
): PitchDetection | null {
  const { sampleRate, minFrequency, maxFrequency, rmsThreshold, clarityThreshold } = options;
  const length = samples.length;
  if (length < 2) {
    return null;
  }

  // Energía acumulada: permite sacar la energía de cualquier tramo en tiempo
  // constante, y con ella normalizar cada desplazamiento sin recorrer el bloque
  // otra vez.
  const cumulativeEnergy = new Float64Array(length + 1);
  for (let i = 0; i < length; i += 1) {
    const sample = samples[i]!;
    cumulativeEnergy[i + 1] = cumulativeEnergy[i]! + sample * sample;
  }

  const rms = Math.sqrt(cumulativeEnergy[length]! / length);
  if (rms < rmsThreshold) {
    return null;
  }

  const minLag = Math.max(1, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.min(length - 1, Math.ceil(sampleRate / minFrequency));
  if (minLag >= maxLag) {
    // La ventana es demasiado corta para el rango pedido: no cabe ni un
    // periodo completo de la nota más grave.
    return null;
  }

  const correlation = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag += 1) {
    const overlap = length - lag;
    let sum = 0;
    for (let i = 0; i < overlap; i += 1) {
      sum += samples[i]! * samples[i + lag]!;
    }
    const energyHead = cumulativeEnergy[overlap]!;
    const energyTail = cumulativeEnergy[length]! - cumulativeEnergy[lag]!;
    const norm = Math.sqrt(energyHead * energyTail);
    correlation[lag] = norm > 0 ? sum / norm : 0;
  }

  const peakLag = choosePeak(correlation, minLag, maxLag);
  if (peakLag === null) {
    return null;
  }

  const { position, value } = interpolatePeak(correlation, peakLag);
  const frequency = sampleRate / position;
  const clarity = Math.min(1, Math.max(0, value));

  if (frequency < minFrequency || frequency > maxFrequency || clarity < clarityThreshold) {
    return null;
  }

  return { frequency, clarity, rms };
}

/**
 * Busca los máximos clave —el punto más alto de cada tramo en que la
 * correlación es positiva— y devuelve el primero que llegue a la altura del
 * mejor de todos.
 */
function choosePeak(correlation: Float64Array, minLag: number, maxLag: number): number | null {
  // El lóbulo que rodea al desplazamiento cero siempre vale 1 y no significa
  // nada: hay que saltárselo antes de empezar a buscar picos.
  let lag = 1;
  while (lag <= maxLag && correlation[lag]! > 0) {
    lag += 1;
  }

  const peaks: number[] = [];
  let bestValue = 0;

  while (lag <= maxLag) {
    if (correlation[lag]! > 0) {
      let peak = lag;
      while (lag <= maxLag && correlation[lag]! > 0) {
        if (correlation[lag]! > correlation[peak]!) {
          peak = lag;
        }
        lag += 1;
      }
      if (peak >= minLag) {
        peaks.push(peak);
        bestValue = Math.max(bestValue, correlation[peak]!);
      }
    } else {
      lag += 1;
    }
  }

  if (peaks.length === 0 || bestValue <= 0) {
    return null;
  }

  const threshold = bestValue * PEAK_TOLERANCE;
  return peaks.find((candidate) => correlation[candidate]! >= threshold) ?? null;
}

/**
 * Ajusta una parábola por el pico y sus dos vecinos y devuelve el vértice, que
 * cae entre muestras. Sin esto el error en la zona aguda pasa de treinta cents.
 */
function interpolatePeak(
  correlation: Float64Array,
  lag: number,
): { position: number; value: number } {
  const previous = correlation[lag - 1];
  const current = correlation[lag]!;
  const next = correlation[lag + 1];

  if (previous === undefined || next === undefined) {
    return { position: lag, value: current };
  }

  const curvature = previous - 2 * current + next;
  if (curvature === 0) {
    return { position: lag, value: current };
  }

  const offset = (0.5 * (previous - next)) / curvature;
  return {
    position: lag + offset,
    value: current - 0.25 * (previous - next) * offset,
  };
}
