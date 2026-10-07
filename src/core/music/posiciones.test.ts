import { describe, expect, it } from 'vitest';

import { findUnit, UNIT_ORDER } from './curriculum';
import { earExercises } from './ear';
import { lessonNotes } from './lessons';
import { pitchClassFromName } from './notes';
import { posicionesDeLaUnidad } from './posiciones';

describe('cuántas posiciones tiene cada unidad para el repaso', () => {
  it('una de tocar tiene un paso por nota subiendo hasta la octava y bajando', () => {
    // La mayor tiene siete notas: ocho subiendo con la octava y siete bajando.
    expect(posicionesDeLaUnidad(findUnit('e1-escala')!.unit)).toBe(15);
  });

  it('una de teoría o de oído tiene las preguntas que genera, en cualquier tónica', () => {
    for (const id of UNIT_ORDER) {
      const { unit } = findUnit(id)!;
      if (unit.kind === 'play') {
        // Las de tocar las compara con el ejercicio de verdad `exercise.test.ts`.
        continue;
      }
      // Lo mismo en Do que en Fa#: el número de preguntas no depende de la
      // tónica, y por eso se puede repasar en otra tonalidad lo fallado en esta.
      for (const tonic of [pitchClassFromName('C'), pitchClassFromName('F#')]) {
        const porModo = (['major', 'minor'] as const).map((mode) =>
          unit.kind === 'theory'
            ? lessonNotes(unit.lesson, tonic, mode).exercises.length
            : earExercises(unit.ear, tonic, mode).length,
        );
        expect(posicionesDeLaUnidad(unit), id).toBe(Math.max(...porModo));
      }
    }
  });

  it('preguntar dos veces por la misma da lo mismo', () => {
    const unidad = findUnit(UNIT_ORDER[0]!)!.unit;

    expect(posicionesDeLaUnidad(unidad)).toBe(posicionesDeLaUnidad(unidad));
  });
});
