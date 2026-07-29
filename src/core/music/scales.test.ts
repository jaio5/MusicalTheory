import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from './notes';
import {
  HEPTATONIC_SCALE_IDS,
  isHeptatonic,
  isInScale,
  SCALE_IDS,
  scaleDegree,
  scaleNoteNames,
  type ScaleId,
} from './scales';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');

describe('cada escala da sus notas desde C, escritas como se escriben', () => {
  const expected: Readonly<Record<ScaleId, readonly string[]>> = {
    major: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    naturalMinor: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
    majorPentatonic: ['C', 'D', 'E', 'G', 'A'],
    minorPentatonic: ['C', 'Eb', 'F', 'G', 'Bb'],
    blues: ['C', 'Eb', 'F', 'Gb', 'G', 'Bb'],
    dorian: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
    mixolydian: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
    phrygian: ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb'],
    harmonicMinor: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B'],
  };

  for (const id of SCALE_IDS) {
    it(id, () => {
      expect(scaleNoteNames(C, id)).toEqual(expected[id]);
    });
  }

  it('cubre las nueve escalas que pide el producto', () => {
    expect(SCALE_IDS).toHaveLength(9);
  });
});

describe('transposición', () => {
  it('A menor natural son las notas blancas', () => {
    expect(scaleNoteNames(A, 'naturalMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('la pentatónica menor de La es la caja del rock', () => {
    expect(scaleNoteNames(A, 'minorPentatonic')).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('el blues de La añade la quinta bemol', () => {
    // Eb y no D#: es una quinta rebajada, y un grado rebajado se escribe bemol.
    expect(scaleNoteNames(A, 'blues')).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
  });
});

describe('pertenencia y grados', () => {
  it('dice si una nota está en la escala', () => {
    expect(isInScale(pitchClassFromName('E'), C, 'major')).toBe(true);
    expect(isInScale(pitchClassFromName('D#'), C, 'major')).toBe(false);
  });

  it('numera los grados desde uno', () => {
    expect(scaleDegree(C, C, 'major')).toBe(1);
    expect(scaleDegree(pitchClassFromName('G'), C, 'major')).toBe(5);
    expect(scaleDegree(pitchClassFromName('C#'), C, 'major')).toBeNull();
  });
});

describe('escalas de siete notas', () => {
  it('marca como heptatónicas solo las que lo son', () => {
    for (const id of HEPTATONIC_SCALE_IDS) {
      expect(isHeptatonic(id)).toBe(true);
    }
    expect(isHeptatonic('minorPentatonic')).toBe(false);
    expect(isHeptatonic('blues')).toBe(false);
  });
});

describe('Cómo se escribe cada escala', () => {
  it('la pentatónica menor de C lleva bemoles', () => {
    expect(scaleNoteNames(pitchClassFromName('C'), 'minorPentatonic')).toEqual([
      'C',
      'Eb',
      'F',
      'G',
      'Bb',
    ]);
  });

  it('la pentatónica menor de B lleva sostenidos', () => {
    // Sale de D mayor, que tiene dos sostenidos: la tercera es F#, no Gb.
    expect(scaleNoteNames(pitchClassFromName('B'), 'minorPentatonic')).toEqual([
      'B',
      'D',
      'E',
      'F#',
      'A',
    ]);
  });

  it('C mixolidio baja la séptima a Bb, no la sube a A#', () => {
    expect(scaleNoteNames(pitchClassFromName('C'), 'mixolydian')).toContain('Bb');
  });

  it('la mayor de C no lleva ninguna alteración', () => {
    expect(scaleNoteNames(pitchClassFromName('C'), 'major')).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
    ]);
  });

  it('el blues de A escribe la nota de paso como bemol', () => {
    expect(scaleNoteNames(pitchClassFromName('A'), 'blues')).toEqual([
      'A',
      'C',
      'D',
      'Eb',
      'E',
      'G',
    ]);
  });
});
