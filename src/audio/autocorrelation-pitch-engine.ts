/**
 * Motor de tono que lee bloques de una entrada y los pasa por la
 * autocorrelación a una cadencia fija.
 *
 * El bucle vive aquí, fuera del ciclo de render de React: no depende de
 * requestAnimationFrame, así que sigue analizando aunque la pestaña baje de
 * prioridad o el componente se vuelva a renderizar.
 */

import { detectPitch, signalRms } from './autocorrelation';
import type { AudioInput } from './audio-input';
import {
  DEFAULT_PITCH_ENGINE_OPTIONS,
  type PitchEngine,
  type PitchEngineOptions,
  type PitchSample,
} from './pitch-engine';

type PitchListener = (sample: PitchSample | null) => void;
type LevelListener = (rms: number) => void;

export interface AutocorrelationPitchEngineDeps {
  readonly options?: Partial<PitchEngineOptions>;
  /**
   * Reloj monótono. Se inyecta para poder probar el silencio y la cadencia sin
   * depender del reloj real.
   */
  readonly now?: () => number;
}

export class AutocorrelationPitchEngine implements PitchEngine {
  readonly options: PitchEngineOptions;

  readonly #now: () => number;
  readonly #listeners = new Set<PitchListener>();
  readonly #levelListeners = new Set<LevelListener>();

  #input: AudioInput | null = null;
  #buffer: Float32Array<ArrayBuffer> | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #lastSignalAt = 0;
  #silent = true;
  /**
   * Si hay una nota enganchada. Mientras la haya se sigue con los umbrales de
   * seguimiento, que son más permisivos; cuando se pierde, hay que volver a
   * superar los de enganche.
   */
  #tracking = false;

  constructor({ options, now }: AutocorrelationPitchEngineDeps = {}) {
    this.options = { ...DEFAULT_PITCH_ENGINE_OPTIONS, ...options };
    this.#now = now ?? (() => performance.now());
  }

  get running(): boolean {
    return this.#timer !== null;
  }

  async start(input: AudioInput): Promise<void> {
    if (input.state !== 'running') {
      throw new Error('La entrada de audio no está arrancada: llama antes a start().');
    }

    this.stop();

    this.#input = input;
    this.#buffer = new Float32Array(input.frameSize);
    this.#lastSignalAt = this.#now();
    this.#silent = true;
    this.#tracking = false;
    this.#timer = setInterval(() => this.#analyse(), this.options.analysisIntervalMs);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#input = null;
    this.#buffer = null;
    this.#emit(null);
  }

  subscribe(listener: PitchListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  subscribeLevel(listener: LevelListener): () => void {
    this.#levelListeners.add(listener);
    return () => {
      this.#levelListeners.delete(listener);
    };
  }

  #analyse(): void {
    const input = this.#input;
    const buffer = this.#buffer;
    if (input === null || buffer === null) {
      return;
    }

    const at = this.#now();

    if (!input.readTimeDomain(buffer)) {
      this.#maybeReportSilence(at);
      return;
    }

    // El nivel se informa siempre, aunque no haya nota: es el dato con el que
    // se ajustan los umbrales.
    const level = signalRms(buffer);
    for (const listener of this.#levelListeners) {
      listener(level);
    }

    const detection = detectPitch(buffer, {
      sampleRate: input.sampleRate,
      minFrequency: this.options.minFrequency,
      maxFrequency: this.options.maxFrequency,
      // Enganchar cuesta más que seguir: así el afinador no arranca con el
      // ruido de fondo, pero tampoco suelta la nota en cuanto empieza a caer.
      rmsThreshold: this.#tracking ? this.options.releaseRmsThreshold : this.options.rmsThreshold,
      clarityThreshold: this.#tracking
        ? this.options.releaseClarityThreshold
        : this.options.clarityThreshold,
    });

    if (detection === null) {
      this.#maybeReportSilence(at);
      return;
    }

    this.#lastSignalAt = at;
    this.#silent = false;
    this.#tracking = true;
    this.#emit({ ...detection, at });
  }

  /**
   * Solo apaga la nota cuando lleva callada más que el margen configurado: el
   * hueco entre dos púas no debe borrar lo que hay en pantalla.
   */
  #maybeReportSilence(at: number): void {
    if (this.#silent || at - this.#lastSignalAt < this.options.silenceHoldMs) {
      return;
    }
    this.#silent = true;
    // La nota se ha perdido de verdad: la siguiente tendrá que volver a superar
    // el umbral de enganche.
    this.#tracking = false;
    this.#emit(null);
  }

  #emit(sample: PitchSample | null): void {
    for (const listener of this.#listeners) {
      listener(sample);
    }
  }
}
