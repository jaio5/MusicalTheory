import { describe, expect, it } from 'vitest';

import { describePitch, midiToFrequency, pitchClassFromName } from '@core/music';

import {
  advanceExercise,
  createExercise,
  exerciseCompletion,
  HOLD_MS,
  INITIAL_PROGRESS,
  stepMatches,
  stumbledSteps,
  type ExerciseProgress,
} from './exercise';

const A = pitchClassFromName('A');
const C = pitchClassFromName('C');

/** Lo que devolvería el motor al tocar esa nota afinada. */
function playing(midi: number, cents = 0) {
  return describePitch(midiToFrequency(midi) * Math.pow(2, cents / 1200));
}

describe('cómo se arma el ejercicio', () => {
  it('sube la escala hasta la octava y baja otra vez', () => {
    const exercise = createExercise(A, 'minorPentatonic');
    // Cinco notas más la octava subiendo, y cinco bajando sin repetir el pico.
    expect(exercise.steps).toHaveLength(11);
    expect(exercise.steps[0]!.pitchClass).toBe(A);
    expect(exercise.steps.at(-1)!.pitchClass).toBe(A);
  });

  it('empieza en la nota más grave que cae dentro del mástil', () => {
    // La sexta cuerda al aire es Mi2 (MIDI 40). La más grave está en el 45.
    expect(createExercise(A, 'major').steps[0]!.midi).toBe(45);
    // Do está por encima: MIDI 48.
    expect(createExercise(C, 'major').steps[0]!.midi).toBe(48);
  });

  it('marca la vuelta para poder pintarla distinta', () => {
    const exercise = createExercise(A, 'major');
    expect(exercise.steps[0]!.descending).toBe(false);
    expect(exercise.steps.at(-1)!.descending).toBe(true);
  });

  it('sube y baja por las mismas notas', () => {
    const exercise = createExercise(A, 'major');
    const up = exercise.steps.filter((step) => !step.descending).map((step) => step.midi);
    const down = exercise.steps.filter((step) => step.descending).map((step) => step.midi);
    expect(down).toEqual([...up].reverse().slice(1));
  });
});

describe('cuándo se da una nota por buena', () => {
  const exercise = createExercise(A, 'minorPentatonic');
  const first = exercise.steps[0]!;

  it('acepta la nota en cualquier octava', () => {
    expect(stepMatches(first, playing(45))).toBe(true);
    expect(stepMatches(first, playing(57))).toBe(true);
  });

  it('rechaza otra nota', () => {
    expect(stepMatches(first, playing(47))).toBe(false);
  });

  it('rechaza la nota correcta mal afinada', () => {
    expect(stepMatches(first, playing(45, 10))).toBe(true);
    expect(stepMatches(first, playing(45, 40))).toBe(false);
  });

  it('el silencio no vale', () => {
    expect(stepMatches(first, null)).toBe(false);
  });
});

describe('avance del ejercicio', () => {
  const exercise = createExercise(A, 'minorPentatonic');

  it('no avanza con la nota rozada', () => {
    const held = advanceExercise(INITIAL_PROGRESS, exercise, playing(45), 0);
    const tooSoon = advanceExercise(held, exercise, playing(45), HOLD_MS - 50);

    expect(tooSoon.index).toBe(0);
    expect(tooSoon.heldSince).toBe(0);
  });

  it('avanza al sostenerla lo suficiente', () => {
    const held = advanceExercise(INITIAL_PROGRESS, exercise, playing(45), 0);
    const advanced = advanceExercise(held, exercise, playing(45), HOLD_MS);

    expect(advanced.index).toBe(1);
    expect(advanced.heldSince).toBeNull();
  });

  it('soltar la nota reinicia el contador', () => {
    const held = advanceExercise(INITIAL_PROGRESS, exercise, playing(45), 0);
    const released = advanceExercise(held, exercise, null, 100);
    const again = advanceExercise(released, exercise, playing(45), 200);

    expect(released.heldSince).toBeNull();
    expect(again.heldSince).toBe(200);
  });

  it('devuelve el mismo objeto cuando no cambia nada, para no renderizar de más', () => {
    const held = advanceExercise(INITIAL_PROGRESS, exercise, playing(45), 0);
    expect(advanceExercise(held, exercise, playing(45), 100)).toBe(held);
    expect(advanceExercise(INITIAL_PROGRESS, exercise, null, 100)).toBe(INITIAL_PROGRESS);
  });

  it('llega hasta el final tocando la escala entera', () => {
    let progress = INITIAL_PROGRESS;
    let clock = 0;

    for (const step of exercise.steps) {
      progress = advanceExercise(progress, exercise, playing(step.midi), clock);
      clock += HOLD_MS;
      progress = advanceExercise(progress, exercise, playing(step.midi), clock);
      clock += 50;
    }

    expect(progress.done).toBe(true);
    expect(progress.index).toBe(exercise.steps.length);
  });

  it('una vez terminado se queda quieto', () => {
    const done = { index: exercise.steps.length, heldSince: null, done: true, stumbles: {} };
    expect(advanceExercise(done, exercise, playing(45), 1000)).toBe(done);
  });

  it('mide el avance de cero a uno', () => {
    expect(exerciseCompletion(INITIAL_PROGRESS, exercise)).toBe(0);
    expect(
      exerciseCompletion(
        { index: exercise.steps.length, heldSince: null, done: true, stumbles: {} },
        exercise,
      ),
    ).toBe(1);
  });
});

describe('las notas que se atragantan', () => {
  const exercise = createExercise(A, 'minorPentatonic');
  const primera = exercise.steps[0]!;

  /** Encuentra la nota, la suelta y vuelve, sin llegar a sostenerla. */
  function tantear(veces: number): ExerciseProgress {
    let progress = INITIAL_PROGRESS;
    let at = 0;
    for (let i = 0; i < veces; i += 1) {
      progress = advanceExercise(progress, exercise, playing(primera.midi), at);
      at += 100;
      progress = advanceExercise(progress, exercise, null, at);
      at += 100;
    }
    return progress;
  }

  it('soltar la nota antes de que cuente se apunta', () => {
    expect(tantear(3).stumbles).toEqual({ 0: 3 });
  });

  it('no apunta nada si la nota nunca llegó a sonar', () => {
    // Silencio no es tropiezo: es que todavía no has empezado.
    let progress = INITIAL_PROGRESS;
    progress = advanceExercise(progress, exercise, null, 0);
    progress = advanceExercise(progress, exercise, null, 500);

    expect(progress.stumbles).toEqual({});
  });

  it('los tropiezos sobreviven al pasar de nota', () => {
    let progress = tantear(2);
    // Ahora sí la sostiene y avanza.
    progress = advanceExercise(progress, exercise, playing(primera.midi), 1000);
    progress = advanceExercise(progress, exercise, playing(primera.midi), 1000 + HOLD_MS);

    expect(progress.index).toBe(1);
    expect(progress.stumbles).toEqual({ 0: 2 });
  });

  it('una sola vez no cuenta: buscar el traste es normal', () => {
    expect(stumbledSteps(tantear(1))).toEqual([]);
    expect(stumbledSteps(tantear(2))).toEqual([0]);
  });

  it('devuelve los pasos en orden', () => {
    const progress: ExerciseProgress = {
      ...INITIAL_PROGRESS,
      stumbles: { 5: 3, 1: 2, 9: 1 },
    };

    expect(stumbledSteps(progress)).toEqual([1, 5]);
  });
});
