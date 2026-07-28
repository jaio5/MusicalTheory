/**
 * Motor de detección de tono.
 *
 * Recibe bloques de audio de un AudioInput y emite una lectura por análisis.
 * El dominio musical no entra aquí: este módulo devuelve hercios y confianza,
 * y quien quiera saber qué nota es llama a core/music/notes.
 */

import type { AudioInput } from './audio-input';

export interface PitchSample {
  /** Frecuencia fundamental estimada, en hercios. */
  readonly frequency: number;
  /**
   * Confianza de 0 a 1 según el pico de autocorrelación. Por debajo del umbral
   * la lectura se descarta en vez de enseñar una nota inventada.
   */
  readonly clarity: number;
  /** Nivel de la señal en el bloque, para decidir si hay alguien tocando. */
  readonly rms: number;
  /** Momento del análisis en milisegundos de reloj monótono. */
  readonly at: number;
}

export interface PitchEngineOptions {
  /** Por debajo no hay guitarra: Mi2 está en 82,4 Hz. */
  readonly minFrequency: number;
  /** Por encima solo hay armónicos y ruido. */
  readonly maxFrequency: number;
  /** Nivel mínimo para considerar que hay señal. */
  readonly rmsThreshold: number;
  /** Confianza mínima para emitir una lectura. */
  readonly clarityThreshold: number;
  /** Cada cuánto se analiza un bloque, en milisegundos. */
  readonly analysisIntervalMs: number;
}

export const DEFAULT_PITCH_ENGINE_OPTIONS: PitchEngineOptions = {
  minFrequency: 70,
  maxFrequency: 1400,
  rmsThreshold: 0.01,
  clarityThreshold: 0.9,
  analysisIntervalMs: 50,
};

export interface PitchEngine {
  readonly options: PitchEngineOptions;
  readonly running: boolean;

  /** Empieza a analizar la entrada. Falla si la entrada no está arrancada. */
  start(input: AudioInput): Promise<void>;

  stop(): void;

  /**
   * Se suscribe a las lecturas. Recibe null cuando deja de haber señal, para
   * que la interfaz pueda apagar el afinador en vez de congelar la última nota.
   */
  subscribe(listener: (sample: PitchSample | null) => void): () => void;
}

// TODO (fase 1): implementar AutocorrelationPitchEngine — autocorrelación con
// interpolación parabólica del pico, ventana de 2048 muestras y los umbrales
// de arriba. Ver docs/AUDIO-PITCH.md.
