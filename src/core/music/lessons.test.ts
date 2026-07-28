import { describe, expect, it } from 'vitest';

import { LESSONS, lessonNotes, type LessonId } from './lessons';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');
const IDS = LESSONS.map((lesson) => lesson.id);

function answerOf(id: LessonId, index: number, tonic = C, mode: 'major' | 'minor' = 'major') {
  const exercise = lessonNotes(id, tonic, mode).exercises[index]!;
  return exercise.choices.find((choice) => choice.correct)!.text;
}

describe('Lecciones', () => {
  it('todas se pueden generar en cualquier tonalidad', () => {
    for (const id of IDS) {
      for (const mode of ['major', 'minor'] as const) {
        const notes = lessonNotes(id, A, mode);

        expect(notes.points.length).toBeGreaterThan(0);
        expect(notes.exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it('cada ejercicio tiene una única respuesta buena y ninguna repetida', () => {
    for (const id of IDS) {
      for (const exercise of lessonNotes(id, C, 'major').exercises) {
        expect(exercise.choices.filter((choice) => choice.correct)).toHaveLength(1);
        expect(new Set(exercise.choices.map((choice) => choice.text)).size).toBe(
          exercise.choices.length,
        );
        expect(exercise.why).not.toBe('');
      }
    }
  });

  it('pregunta por los acordes de la tonalidad en la que estás', () => {
    expect(answerOf('degrees', 0)).toBe('G');
    expect(answerOf('degrees', 0, A, 'minor')).toBe('Em');
  });

  it('el cuarto grado se nombra con su número romano', () => {
    expect(answerOf('degrees', 1)).toBe('IV');
  });

  it('la séptima del quinto grado de C mayor es G7', () => {
    expect(answerOf('qualities', 2)).toBe('G7');
  });

  it('la relativa de C mayor es A menor', () => {
    expect(answerOf('circle', 0)).toBe('A menor');
    expect(answerOf('circle', 0, A, 'minor')).toBe('C mayor');
  });

  it('una quinta arriba de C es G', () => {
    expect(answerOf('circle', 1)).toBe('G');
  });

  it('el bVII de C mayor es Bb', () => {
    expect(answerOf('borrowed', 0)).toBe('Bb');
  });

  it('las lecciones no se repiten', () => {
    expect(new Set(IDS).size).toBe(IDS.length);
  });
});
