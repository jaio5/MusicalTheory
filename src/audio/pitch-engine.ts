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
  /**
   * Nivel mínimo para *enganchar* una nota nueva. Se mantiene alto para no
   * empezar a detectar con el ruido de fondo del ampli.
   */
  readonly rmsThreshold: number;
  /** Confianza mínima para enganchar una nota nueva. */
  readonly clarityThreshold: number;
  /**
   * Nivel mínimo para *seguir* una nota ya enganchada. Bastante más bajo que el
   * de enganche: una cuerda pulsada decae desde el primer instante, y con un
   * solo umbral la detección se corta cuando la nota todavía se oye de sobra.
   */
  readonly releaseRmsThreshold: number;
  /** Confianza mínima para seguir una nota ya enganchada. */
  readonly releaseClarityThreshold: number;
  /** Cada cuánto se analiza un bloque, en milisegundos. */
  readonly analysisIntervalMs: number;
  /**
   * Cuánto se espera sin señal antes de avisar de que ya no suena nada. Sin
   * esta espera, el hueco entre dos púas apagaría la nota en pantalla.
   */
  readonly silenceHoldMs: number;
}

export const DEFAULT_PITCH_ENGINE_OPTIONS: PitchEngineOptions = {
  minFrequency: 70,
  maxFrequency: 1400,
  rmsThreshold: 0.006,
  clarityThreshold: 0.9,
  releaseRmsThreshold: 0.0015,
  releaseClarityThreshold: 0.75,
  analysisIntervalMs: 50,
  silenceHoldMs: 600,
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

  /**
   * Nivel de entrada en cada análisis, haya nota o no. Es lo que hace falta
   * para ajustar los umbrales: el caso interesante es justo cuando entra señal
   * y aun así no se engancha ninguna nota.
   */
  subscribeLevel(listener: (rms: number) => void): () => void;
}
