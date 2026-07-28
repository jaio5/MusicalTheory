/**
 * Nota de referencia sintetizada, para comparar de oído en el modo aprender.
 *
 * Es un oscilador con envolvente, no una muestra: no hay que descargar nada y
 * suena igual en todos los navegadores. Onda triangular porque la senoide pura
 * se pierde contra el ampli y la de sierra es demasiado agresiva.
 */

export interface ReferenceTone {
  /** Suena una nota. Si ya sonaba otra, la corta. */
  play(frequency: number, durationMs?: number): Promise<void>;
  stop(): void;
  /** Suelta el contexto de audio. */
  dispose(): Promise<void>;
}

export const DEFAULT_TONE_MS = 900;

const ATTACK_S = 0.02;
const RELEASE_S = 0.12;

export class WebAudioReferenceTone implements ReferenceTone {
  #context: AudioContext | null = null;
  #oscillator: OscillatorNode | null = null;

  async play(frequency: number, durationMs: number = DEFAULT_TONE_MS): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      return;
    }

    this.stop();

    // El contexto se crea en el primer uso, que siempre viene de una pulsación:
    // crearlo antes lo dejaría suspendido por la política de autoreproducción.
    this.#context ??= new AudioContext();
    const context = this.#context;
    if (context.state === 'suspended') {
      await context.resume();
    }

    const now = context.currentTime;
    const seconds = durationMs / 1000;

    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);

    // Sin envolvente, empezar y parar de golpe suena a chasquido.
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + ATTACK_S);
    gain.gain.setValueAtTime(0.2, now + Math.max(ATTACK_S, seconds - RELEASE_S));
    gain.gain.linearRampToValueAtTime(0, now + seconds);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + seconds);

    this.#oscillator = oscillator;
    oscillator.onended = () => {
      if (this.#oscillator === oscillator) {
        this.#oscillator = null;
      }
    };
  }

  stop(): void {
    const oscillator = this.#oscillator;
    if (oscillator === null) {
      return;
    }
    this.#oscillator = null;
    oscillator.onended = null;
    try {
      oscillator.stop();
    } catch {
      // Ya había parado solo: no es un error, es una carrera normal entre el
      // temporizador del oscilador y la pulsación del usuario.
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    const context = this.#context;
    this.#context = null;
    if (context !== null && context.state !== 'closed') {
      await context.close();
    }
  }
}
