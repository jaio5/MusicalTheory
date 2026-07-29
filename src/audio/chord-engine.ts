/**
 * Motor de acordes: lee el espectro de la entrada y dice qué acorde suena.
 *
 * Va aparte del motor de tono porque miden cosas distintas con ventanas
 * distintas. El tono quiere una ventana corta para responder rápido al ataque;
 * el acorde quiere una larga, porque separar dos notas a un semitono en el
 * grave pide resolución en frecuencia. Los dos leen de la misma entrada.
 *
 * Lo que sale no es lo que dice el último análisis, sino lo que se ha mantenido:
 * un rasgueo pasa por media docena de acordes falsos antes de asentarse, y
 * enseñarlos todos sería un cartel parpadeando.
 */

import { bestChord, type Accidental, type ChordMatch } from '@core/music';

import type { AudioInput } from './audio-input';
import { chromaFromSpectrum } from './chroma';

export interface ChordEngineOptions {
  /** Análisis por segundo. */
  readonly rate: number;
  /** Cuánto pesa lo nuevo frente a lo acumulado, de 0 a 1. */
  readonly smoothing: number;
  /** Cuántos análisis seguidos han de coincidir para darlo por bueno. */
  readonly confirmations: number;
  /** Por debajo de esto no se parece a ningún acorde. */
  readonly minScore: number;
  readonly accidental: Accidental;
}

/**
 * El suavizado y las confirmaciones se ajustan juntos, no por separado.
 *
 * Al cambiar de acorde, la media móvil pasa por un momento en que suenan los
 * dos: de C a Am se ve un C6, que es literalmente cierto —C, E, G y A están
 * ahí— y es exactamente lo que no se quiere enseñar. La media tiene que
 * desvanecer el acorde viejo antes de que un acorde de paso llegue a
 * confirmarse. Con estos números eso son cuatro décimas: lo que tarda en salir
 * un acorde nuevo, y lo que hay que sostenerlo para que cuente.
 */
export const DEFAULT_CHORD_ENGINE_OPTIONS: ChordEngineOptions = {
  rate: 10,
  smoothing: 0.5,
  confirmations: 4,
  minScore: 0.78,
  accidental: 'sharp',
};

export interface ChordEngine {
  readonly running: boolean;
  start(input: AudioInput): Promise<void>;
  stop(): void;
  /** Cambia cómo se escriben los cifrados sin cortar el análisis. */
  setAccidental(accidental: Accidental): void;
  subscribe(listener: (chord: ChordMatch | null) => void): () => void;
}

export class ChromaChordEngine implements ChordEngine {
  readonly options: ChordEngineOptions;

  readonly #listeners = new Set<(chord: ChordMatch | null) => void>();
  #input: AudioInput | null = null;
  #spectrum: Float32Array<ArrayBuffer> | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #smoothed: number[] = new Array<number>(12).fill(0);
  #candidate: string | null = null;
  #seen = 0;
  #announced: string | null = null;
  #accidental: Accidental;

  constructor(options: Partial<ChordEngineOptions> = {}) {
    this.options = { ...DEFAULT_CHORD_ENGINE_OPTIONS, ...options };
    this.#accidental = this.options.accidental;
  }

  get running(): boolean {
    return this.#timer !== null;
  }

  async start(input: AudioInput): Promise<void> {
    if (input.state !== 'running') {
      return;
    }
    this.stop();

    this.#input = input;
    this.#spectrum = new Float32Array(input.spectrumSize / 2);
    this.#smoothed = new Array<number>(12).fill(0);
    this.#candidate = null;
    this.#announced = null;
    this.#seen = 0;
    this.#timer = setInterval(() => this.#analyse(), 1000 / this.options.rate);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#input = null;
    this.#spectrum = null;
  }

  setAccidental(accidental: Accidental): void {
    this.#accidental = accidental;
  }

  subscribe(listener: (chord: ChordMatch | null) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #analyse(): void {
    const input = this.#input;
    const spectrum = this.#spectrum;
    if (input === null || spectrum === null || !input.readSpectrum(spectrum)) {
      return;
    }

    const chroma = chromaFromSpectrum(spectrum, {
      sampleRate: input.sampleRate,
      fftSize: input.spectrumSize,
    });

    // Media móvil: un acorde dura segundos y un análisis dura una décima, así
    // que lo que se compara es lo que lleva sonando, no el último fotograma.
    const { smoothing } = this.options;
    this.#smoothed = this.#smoothed.map(
      (value, note) => value * (1 - smoothing) + chroma[note]! * smoothing,
    );

    const match = bestChord(this.#smoothed, {
      accidental: this.#accidental,
      minScore: this.options.minScore,
    });
    const symbol = match?.symbol ?? null;

    if (symbol !== this.#candidate) {
      this.#candidate = symbol;
      this.#seen = 1;
      return;
    }

    this.#seen += 1;
    if (this.#seen < this.options.confirmations || symbol === this.#announced) {
      return;
    }

    this.#announced = symbol;
    for (const listener of this.#listeners) {
      listener(match);
    }
  }
}
