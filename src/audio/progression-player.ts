/**
 * Oír una progresión de acordes.
 *
 * Es el hermano mayor de `reference-tone.ts`: osciladores con envolvente en vez
 * de muestras, para no descargar nada y sonar igual en todos los navegadores.
 * Lo que cambia es que aquí suenan varias notas a la vez y encadenadas en el
 * tiempo.
 *
 * **Todo se programa de una vez contra el reloj del audio**, no con
 * temporizadores encadenados. Es la misma razón que hay detrás del metrónomo: el
 * hilo de JavaScript se atasca con cualquier cosa —y aquí hay dos motores de
 * análisis corriendo— así que un acorde programado con `setTimeout` llega tarde
 * y la progresión se arrastra. El reloj del `AudioContext` es independiente y no
 * se entera.
 *
 * Qué notas suenan y cuándo lo decide `core/music/playback.ts`. Aquí solo se
 * convierten en sonido, que es lo que no se puede probar sin oírlo.
 */

import { midiToFrequency, type ScheduledStep } from '@core/music';

export interface ProgressionPlayer {
  /**
   * Suena la progresión. Si ya sonaba otra, la corta.
   *
   * `onStep` avisa de qué acorde va sonando, para poder encenderlo en pantalla,
   * y recibe nulo al terminar.
   */
  play(steps: readonly ScheduledStep[], onStep?: (index: number | null) => void): Promise<void>;
  stop(): void;
  dispose(): Promise<void>;
}

/** Cuánto tarda cada nota en llegar a su volumen y en apagarse. */
const ATTACK_S = 0.01;
const RELEASE_S = 0.08;

/**
 * Volumen de cada nota.
 *
 * Repartido entre las notas que suenan a la vez y no fijo: tres notas al mismo
 * volumen que una suenan tres veces más fuerte, y un acorde de cinco satura.
 */
const CHORD_GAIN = 0.22;

export class WebAudioProgressionPlayer implements ProgressionPlayer {
  #context: AudioContext | null = null;
  #oscillators: OscillatorNode[] = [];
  #timers: ReturnType<typeof setTimeout>[] = [];

  async play(
    steps: readonly ScheduledStep[],
    onStep?: (index: number | null) => void,
  ): Promise<void> {
    if (typeof AudioContext === 'undefined' || steps.length === 0) {
      return;
    }

    this.stop();

    // El contexto se crea en el primer uso, que siempre viene de una pulsación:
    // creado antes, la política de autoreproducción lo deja suspendido.
    this.#context ??= new AudioContext();
    const context = this.#context;
    if (context.state === 'suspended') {
      await context.resume();
    }

    const empieza = context.currentTime;

    for (const step of steps) {
      const desde = empieza + step.startMs / 1000;
      const dura = step.durationMs / 1000;
      // Un poco menos de lo que dura el compás: sin ese hueco, el final de un
      // acorde y el principio del siguiente se solapan y suena a barrido.
      const suena = Math.max(ATTACK_S + RELEASE_S, dura * 0.92);
      const porNota = step.midis.length === 0 ? 0 : CHORD_GAIN / step.midis.length;

      for (const midi of step.midis) {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(midiToFrequency(midi), desde);

        const gain = context.createGain();
        gain.gain.setValueAtTime(0, desde);
        gain.gain.linearRampToValueAtTime(porNota, desde + ATTACK_S);
        gain.gain.setValueAtTime(porNota, desde + suena - RELEASE_S);
        gain.gain.linearRampToValueAtTime(0, desde + suena);

        oscillator.connect(gain).connect(context.destination);
        oscillator.start(desde);
        oscillator.stop(desde + suena);
        this.#oscillators.push(oscillator);
      }

      // El aviso a la pantalla sí va con temporizador: si llega un fotograma
      // tarde no se nota, y usar el reloj del audio para esto obligaría a un
      // bucle de sondeo corriendo todo el rato.
      if (onStep !== undefined) {
        this.#timers.push(setTimeout(() => onStep(step.index), step.startMs));
      }
    }

    const ultimo = steps.at(-1)!;
    this.#timers.push(
      setTimeout(() => {
        this.#oscillators = [];
        onStep?.(null);
      }, ultimo.startMs + ultimo.durationMs),
    );
  }

  stop(): void {
    for (const timer of this.#timers) {
      clearTimeout(timer);
    }
    this.#timers = [];

    const sonando = this.#oscillators;
    this.#oscillators = [];
    for (const oscillator of sonando) {
      try {
        oscillator.stop();
      } catch {
        // Ya había parado solo: es una carrera normal entre su temporizador y
        // la pulsación de quien está escuchando, no un error.
      }
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
