/**
 * Cómo se coloca un acorde para oírlo, y cuándo suena cada uno.
 *
 * Dominio puro: aquí no hay `AudioContext` ni temporizadores. Lo que sale son
 * números MIDI e instantes en milisegundos, y quien los convierte en sonido es
 * `audio/progression-player.ts`. Así la parte que se puede equivocar —la
 * disposición de las notas y el reparto en el tiempo— se prueba sin oír nada.
 *
 * Existe porque comparar tres versiones de una canción leyéndolas cuesta: con
 * los cifrados delante hay que tocarlas una a una para saber cuál te gusta, y
 * para entonces ya se te ha olvidado cómo sonaba la primera.
 */

import { normalizePitchClass, type PitchClass } from './notes';
import { clampBpm, msPerBeat } from './tempo';

/**
 * La octava en la que se colocan los acordes, como número MIDI.
 *
 * 48 es el Do de la tercera octava: la zona donde una guitarra toca acordes
 * abiertos. Más abajo, las notas apiladas se emborronan; más arriba, suena a
 * campanilla y no a acompañamiento.
 */
export const PLAYBACK_BASE_MIDI = 48;

/**
 * Coloca las notas de un acorde en alturas concretas.
 *
 * Sube cada nota hasta que queda por encima de la anterior, empezando por la
 * fundamental. Eso es lo que hace que suene a acorde y no a un montón de notas:
 * con todas las clases de altura en la misma octava, un Am con la fundamental
 * arriba se oye como un Do con una nota rara.
 *
 * No busca la mejor disposición ni el enlace más suave entre acordes. Es la
 * disposición cerrada y en estado fundamental, que es la que todo el mundo
 * reconoce, y basta para comparar dos versiones de una canción.
 */
export function voiceForPlayback(
  root: PitchClass,
  notes: readonly PitchClass[],
  baseMidi: number = PLAYBACK_BASE_MIDI,
): number[] {
  if (notes.length === 0) {
    return [];
  }

  // La fundamental primero y el resto en el orden en que suben desde ella: el
  // croma devuelve las notas en el orden del vector, no en el de la partitura.
  const desdeLaRaiz = [...new Set(notes)].sort(
    (a, b) => normalizePitchClass(a - root) - normalizePitchClass(b - root),
  );

  const octava = Math.floor(baseMidi / 12) * 12;
  let anterior = -1;

  return desdeLaRaiz.map((note) => {
    let midi = octava + note;
    while (midi <= anterior) {
      midi += 12;
    }
    anterior = midi;
    return midi;
  });
}

/** Un acorde y lo que dura, tal y como se guarda una canción. */
export interface PlaybackStep {
  readonly notes: readonly PitchClass[];
  readonly root: PitchClass;
  /** Pulsos. */
  readonly beats: number;
}

export interface ScheduledStep {
  readonly index: number;
  /** Milisegundos desde que empieza la progresión. */
  readonly startMs: number;
  readonly durationMs: number;
  /** Las alturas que hay que hacer sonar. */
  readonly midis: readonly number[];
}

/**
 * Cuándo suena cada acorde y con qué notas.
 *
 * Devuelve instantes acumulados y no duraciones sueltas porque quien reproduce
 * necesita programarlo todo de una vez contra el reloj del audio. Encadenar
 * temporizadores de JavaScript acumularía el retraso de cada uno, que es el
 * mismo motivo por el que el metrónomo no usa `setInterval`.
 */
export function scheduleProgression(
  steps: readonly PlaybackStep[],
  bpm: number,
  baseMidi: number = PLAYBACK_BASE_MIDI,
): ScheduledStep[] {
  const porPulso = msPerBeat(clampBpm(bpm));
  let startMs = 0;

  return steps.map((step, index) => {
    // Al menos un pulso: un acorde de duración cero no se oye, y una progresión
    // con uno dentro se saltaría un compás sin decir nada.
    const beats = Math.max(1, Math.round(step.beats));
    const durationMs = beats * porPulso;
    const scheduled: ScheduledStep = {
      index,
      startMs,
      durationMs,
      midis: voiceForPlayback(step.root, step.notes, baseMidi),
    };
    startMs += durationMs;
    return scheduled;
  });
}

/**
 * Un sonido con su sitio en el tiempo, en pulsos y desde el principio.
 *
 * Es lo que `PlaybackStep` no puede ser: los acordes se suceden sin huecos, así
 * que a cada uno le basta con venir detrás del anterior, pero una melodía tiene
 * silencios, se adelanta al compás y se queda callada media parte. Cada nota
 * necesita decir **cuándo** entra.
 */
export interface TimedEvent {
  /** Pulsos desde que empieza. */
  readonly startBeat: number;
  readonly beats: number;
  readonly midis: readonly number[];
}

/**
 * Reparte en el tiempo cosas que ya saben cuándo suenan.
 *
 * Existe para poder oír el acompañamiento y el punteo **con un solo reloj**. Dos
 * reproductores, uno para cada cosa, tendrían dos `AudioContext` con dos relojes
 * independientes, y unos milisegundos de diferencia entre el acorde y la nota se
 * oyen como un golpe doble.
 *
 * Salen ordenados por su instante porque quien reproduce los programa de una vez
 * y quien enseña por dónde va necesita que el índice suba con el tiempo.
 */
export function scheduleEvents(events: readonly TimedEvent[], bpm: number): ScheduledStep[] {
  const porPulso = msPerBeat(clampBpm(bpm));

  return [...events]
    .sort((a, b) => a.startBeat - b.startBeat)
    .map((event, index) => ({
      index,
      startMs: Math.max(0, event.startBeat) * porPulso,
      // Al menos un medio pulso: es la rejilla más fina que hay, y una duración
      // de cero no se oye.
      durationMs: Math.max(0.5, event.beats) * porPulso,
      midis: event.midis,
    }));
}

/** Lo que dura la progresión entera, en milisegundos. */
export function progressionDurationMs(scheduled: readonly ScheduledStep[]): number {
  const ultimo = scheduled.at(-1);
  return ultimo === undefined ? 0 : ultimo.startMs + ultimo.durationMs;
}
