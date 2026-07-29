/**
 * El metrónomo.
 *
 * El pulso no se puede llevar con un temporizador de JavaScript: el hilo se
 * atasca con cualquier cosa y el clic llega tarde. Lo que se hace es programar
 * los golpes en el reloj del audio, que es independiente, y usar el temporizador
 * solo para ir mirando por delante y programar los siguientes.
 *
 * El sonido es un oscilador corto con envolvente, no una muestra: no hay nada
 * que descargar y suena igual en todos los navegadores.
 */

import { clampBpm, DEFAULT_BEATS_PER_BAR } from '@core/music';

export interface MetronomeOptions {
  readonly bpm: number;
  /** Cuántos pulsos por compás. El primero suena más agudo. */
  readonly beatsPerBar?: number;
  /** Se llama en cada pulso, con el número dentro del compás empezando en 0. */
  readonly onBeat?: (beat: number) => void;
}

export interface Metronome {
  readonly running: boolean;
  start(options: MetronomeOptions): Promise<void>;
  /** Cambia la velocidad sin cortar el pulso. */
  setBpm(bpm: number): void;
  stop(): void;
  dispose(): Promise<void>;
}

/** Cada cuánto se mira por delante, en milisegundos. */
const LOOKAHEAD_MS = 25;
/** Cuánto se programa por delante, en segundos. */
const SCHEDULE_AHEAD_S = 0.15;

const CLICK_S = 0.03;
const DOWNBEAT_HZ = 1600;
const BEAT_HZ = 1000;

export class WebAudioMetronome implements Metronome {
  #context: AudioContext | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #nextBeatAt = 0;
  #beat = 0;
  #bpm = 100;
  #beatsPerBar = DEFAULT_BEATS_PER_BAR;
  #onBeat: ((beat: number) => void) | undefined;

  get running(): boolean {
    return this.#timer !== null;
  }

  async start({
    bpm,
    beatsPerBar = DEFAULT_BEATS_PER_BAR,
    onBeat,
  }: MetronomeOptions): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      return;
    }
    this.stop();

    this.#bpm = clampBpm(bpm);
    this.#beatsPerBar = Math.max(1, Math.round(beatsPerBar));
    this.#onBeat = onBeat;

    // El contexto se crea en el primer uso, que siempre viene de una pulsación:
    // crearlo antes lo dejaría suspendido por la política de autoreproducción.
    this.#context ??= new AudioContext();
    const context = this.#context;
    if (context.state === 'suspended') {
      await context.resume();
    }

    this.#beat = 0;
    this.#nextBeatAt = context.currentTime + 0.1;
    this.#timer = setInterval(() => this.#schedule(), LOOKAHEAD_MS);
  }

  setBpm(bpm: number): void {
    this.#bpm = clampBpm(bpm);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#onBeat = undefined;
  }

  async dispose(): Promise<void> {
    this.stop();
    const context = this.#context;
    this.#context = null;
    if (context !== null && context.state !== 'closed') {
      await context.close();
    }
  }

  #schedule(): void {
    const context = this.#context;
    if (context === null) {
      return;
    }

    while (this.#nextBeatAt < context.currentTime + SCHEDULE_AHEAD_S) {
      this.#click(context, this.#nextBeatAt, this.#beat === 0);
      this.#announce(context, this.#nextBeatAt, this.#beat);

      this.#nextBeatAt += 60 / this.#bpm;
      this.#beat = (this.#beat + 1) % this.#beatsPerBar;
    }
  }

  #click(context: AudioContext, at: number, downbeat: boolean): void {
    const oscillator = context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(downbeat ? DOWNBEAT_HZ : BEAT_HZ, at);

    // Sin envolvente el clic suena a chasquido de altavoz roto.
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(downbeat ? 0.35 : 0.22, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + CLICK_S);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + CLICK_S);
  }

  /**
   * El aviso para la pantalla va por temporizador porque React no entiende de
   * relojes de audio. Que la luz llegue un fotograma tarde no importa; que el
   * clic llegue tarde, sí.
   */
  #announce(context: AudioContext, at: number, beat: number): void {
    const onBeat = this.#onBeat;
    if (onBeat === undefined) {
      return;
    }
    const delay = Math.max(0, (at - context.currentTime) * 1000);
    setTimeout(() => {
      if (this.#timer !== null) {
        onBeat(beat);
      }
    }, delay);
  }
}
