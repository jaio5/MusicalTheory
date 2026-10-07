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

import {
  PARECIDO_MINIMO,
  readChord,
  triadInside,
  type Accidental,
  type ChordReading,
} from '@core/music';

import type { AudioInput } from './audio-input';
import { ACORDES_HASTA_HZ, leerEspectro } from './chroma';
import { Emisor } from '@core/estado-observable';

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
  /**
   * Hasta dónde se mira el espectro, en hercios.
   *
   * **Mil (`ACORDES_HASTA_HZ`, el mismo que el análisis en diferido), y no los
   * 2200 del croma**, porque en un acorde de guitarra por encima de mil no suena
   * ninguna fundamental —la nota más aguda de una postura abierta es un Sol 4, a
   * 392 Hz, y en el traste doce de la primera, un Mi 5 a 659—: solo hay
   * armónicos, y los armónicos mienten.
   *
   * Con el descuento de antes, mirando hasta 2200 ningún acorde de C, Am, F y G
   * pasaba del parecido mínimo. Con el de ahora, que mide cada armónico en su
   * serie, esa toma ya sale entera también hasta 2200 (`toma-sintetica.test.ts`);
   * el techo se queda porque en diferido, con los dos conjuntos de guitarra
   * sintética, mirar hasta 2200 acertaba bastante menos (`docs/AUDIO-PITCH.md`).
   */
  readonly maxHz: number;
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
const DEFAULT_CHORD_ENGINE_OPTIONS: ChordEngineOptions = {
  rate: 10,
  smoothing: 0.5,
  confirmations: 4,
  minScore: PARECIDO_MINIMO,
  accidental: 'sharp',
  maxHz: ACORDES_HASTA_HZ,
};

/**
 * Qué acorde es, a efectos de confirmarlo: la fundamental y la tríada de dentro.
 *
 * Se confirmaba por el cifrado, y con una guitarra el cifrado **parpadea entre
 * C7, Cmaj7 y C6 de un análisis al siguiente**: la cuarta nota la ponen los
 * armónicos y cambia con cada rasgueo. Cuatro iguales seguidos no llegaban casi
 * nunca y el acorde no se decía. Con la tríada como identidad, los tres son el
 * mismo Do mayor —que es lo que se tocó— y se confirma en cuatro décimas.
 */
function identidadDe(reading: ChordReading | null): string | null {
  if (reading === null) {
    return null;
  }
  const { root, notes, symbol } = reading.best;
  return `${root}:${triadInside(root, notes) ?? symbol}`;
}

export interface ChordEngine {
  readonly running: boolean;
  start(input: AudioInput): Promise<void>;
  stop(): void;
  /** Cambia cómo se escriben los cifrados sin cortar el análisis. */
  setAccidental(accidental: Accidental): void;
  /**
   * Lo que se oye, **con su duda**: el acorde, lo que también pudo ser y cuánto
   * se despega del segundo. Antes se emitía solo el elegido, y todo lo que venía
   * después —apuntar, corregir, saber de qué fiarse— se quedaba sin esa mitad.
   */
  subscribe(listener: (chord: ChordReading | null) => void): () => void;
}

export class ChromaChordEngine implements ChordEngine {
  readonly options: ChordEngineOptions;

  readonly #oidos = new Emisor<ChordReading | null>();
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

  subscribe(listener: (chord: ChordReading | null) => void): () => void {
    return this.#oidos.suscribir(listener);
  }

  #analyse(): void {
    const input = this.#input;
    const spectrum = this.#spectrum;
    if (input === null || spectrum === null || !input.readSpectrum(spectrum)) {
      return;
    }

    const { croma: chroma, bajo } = leerEspectro(spectrum, {
      sampleRate: input.sampleRate,
      fftSize: input.spectrumSize,
      maxHz: this.options.maxHz,
    });

    // Media móvil: un acorde dura segundos y un análisis dura una décima, así
    // que lo que se compara es lo que lleva sonando, no el último fotograma.
    const { smoothing } = this.options;
    this.#smoothed = this.#smoothed.map(
      (value, note) => value * (1 - smoothing) + chroma[note]! * smoothing,
    );

    // El bajo es el del análisis de ahora, no uno suavizado: solo desempata
    // acordes con las mismas notas, y la nota más grave no se promedia.
    const reading = readChord(this.#smoothed, {
      accidental: this.#accidental,
      minScore: this.options.minScore,
      bajo,
    });
    const identidad = identidadDe(reading);

    if (identidad !== this.#candidate) {
      this.#candidate = identidad;
      this.#seen = 1;
      return;
    }

    this.#seen += 1;
    if (this.#seen < this.options.confirmations || identidad === this.#announced) {
      return;
    }

    this.#announced = identidad;
    this.#oidos.emitir(reading);
  }
}
