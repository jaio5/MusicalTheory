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

describe('cada escala da sus notas desde Do', () => {
  const expected: Readonly<Record<ScaleId, readonly string[]>> = {
    major: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    naturalMinor: ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#'],
    majorPentatonic: ['C', 'D', 'E', 'G', 'A'],
    minorPentatonic: ['C', 'D#', 'F', 'G', 'A#'],
    blues: ['C', 'D#', 'F', 'F#', 'G', 'A#'],
    dorian: ['C', 'D', 'D#', 'F', 'G', 'A', 'A#'],
    mixolydian: ['C', 'D', 'E', 'F', 'G', 'A', 'A#'],
    phrygian: ['C', 'C#', 'D#', 'F', 'G', 'G#', 'A#'],
    harmonicMinor: ['C', 'D', 'D#', 'F', 'G', 'G#', 'B'],
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
  it('La menor natural son las notas blancas', () => {
    expect(scaleNoteNames(A, 'naturalMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('la pentatónica menor de La es la caja del rock', () => {
    expect(scaleNoteNames(A, 'minorPentatonic')).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('el blues de La añade la quinta bemol', () => {
    expect(scaleNoteNames(A, 'blues')).toEqual(['A', 'C', 'D', 'D#', 'E', 'G']);
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
