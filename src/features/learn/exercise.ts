/**
 * El ejercicio de escala: qué nota toca ahora y cuándo se da por buena.
 *
 * Es una máquina de estados pura. El instante entra por parámetro, igual que en
 * el dominio, así que se puede probar un ejercicio entero sin esperar ni un
 * milisegundo real.
 */

import { midiToPitchClass, normalizePitchClass, SCALES } from '@core/music';
import type { PitchClass, PitchReading, ScaleId } from '@core/music';

/**
 * Cuánto hay que sostener la nota para que cuente. El ataque de la púa tarda
 * unos 30 ms en estabilizarse, así que validar en la primera lectura daría por
 * buenas notas que ni siquiera han sonado.
 */
export const HOLD_MS = 350;

/**
 * Margen de afinación del ejercicio. Más ancho que el del afinador: aquí se
 * practica la escala, no se afina la guitarra, y un cuarto de semitono es lo
 * que separa una nota de su vecina.
 */
export const EXERCISE_TOLERANCE_CENTS = 25;

/** La cuerda al aire más grave, para no empezar el ejercicio bajo el mástil. */
const LOWEST_MIDI = 40;

export interface ExerciseStep {
  readonly index: number;
  readonly midi: number;
  readonly pitchClass: PitchClass;
  /** Si es la vuelta, para poder dibujar la ida y la vuelta distintas. */
  readonly descending: boolean;
}

export interface Exercise {
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  readonly steps: readonly ExerciseStep[];
}

export interface ExerciseProgress {
  /** Paso en el que está. Igual a `steps.length` cuando ha terminado. */
  readonly index: number;
  /** Desde cuándo se sostiene la nota correcta, o null si no suena. */
  readonly heldSince: number | null;
  readonly done: boolean;
}

export const INITIAL_PROGRESS: ExerciseProgress = { index: 0, heldSince: null, done: false };

/** La nota más grave con esa clase de altura que cae dentro del mástil. */
function lowestMidiFor(pitchClass: PitchClass): number {
  const offset = normalizePitchClass(pitchClass - midiToPitchClass(LOWEST_MIDI));
  return LOWEST_MIDI + offset;
}

/**
 * La escala subiendo hasta la octava y bajando otra vez, sin repetir la nota
 * del pico ni la del final.
 */
export function createExercise(tonic: PitchClass, scaleId: ScaleId): Exercise {
  const root = lowestMidiFor(tonic);
  const ascending = [...SCALES[scaleId].intervals.map((interval) => root + interval), root + 12];
  const descending = [...ascending].reverse().slice(1);

  const steps = [...ascending, ...descending].map((midi, index) => ({
    index,
    midi,
    pitchClass: midiToPitchClass(midi),
    descending: index >= ascending.length,
  }));

  return { tonic, scaleId, steps };
}

/**
 * Si lo que suena es la nota del paso. Se compara la clase de altura y no el
 * número MIDI: la misma nota vale en cualquier octava, que en la guitarra es lo
 * razonable porque cae en varias cuerdas.
 */
export function stepMatches(
  step: ExerciseStep,
  reading: PitchReading | null,
  tolerance: number = EXERCISE_TOLERANCE_CENTS,
): boolean {
  if (reading === null) {
    return false;
  }
  return reading.pitchClass === step.pitchClass && Math.abs(reading.cents) <= tolerance;
}

export interface AdvanceOptions {
  readonly holdMs?: number;
  readonly tolerance?: number;
}

/**
 * Da un paso de la máquina de estados.
 *
 * Devuelve **el mismo objeto** cuando no cambia nada, para que React no vuelva
 * a renderizar veinte veces por segundo mientras se sostiene una nota.
 */
export function advanceExercise(
  progress: ExerciseProgress,
  exercise: Exercise,
  reading: PitchReading | null,
  at: number,
  { holdMs = HOLD_MS, tolerance = EXERCISE_TOLERANCE_CENTS }: AdvanceOptions = {},
): ExerciseProgress {
  if (progress.done) {
    return progress;
  }

  const step = exercise.steps[progress.index];
  if (step === undefined) {
    return progress.done ? progress : { ...progress, done: true };
  }

  if (!stepMatches(step, reading, tolerance)) {
    // Soltar la nota reinicia el contador: hay que sostenerla, no rozarla.
    return progress.heldSince === null ? progress : { ...progress, heldSince: null };
  }

  if (progress.heldSince === null) {
    return { ...progress, heldSince: at };
  }

  if (at - progress.heldSince < holdMs) {
    return progress;
  }

  const index = progress.index + 1;
  return { index, heldSince: null, done: index >= exercise.steps.length };
}

/** De 0 a 1, para pintar una barra de avance. */
export function exerciseCompletion(progress: ExerciseProgress, exercise: Exercise): number {
  if (exercise.steps.length === 0) {
    return 0;
  }
  return Math.min(1, progress.index / exercise.steps.length);
}
