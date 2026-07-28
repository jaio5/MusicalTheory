import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from './notes';
import {
  degreeOfChord,
  degreesFor,
  nextDegrees,
  PROGRESSIONS,
  progressionsFor,
  resolveDegree,
  resolveProgression,
} from './progressions';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');

describe('caminos entre grados', () => {
  it('desde I lo más habitual es ir a IV', () => {
    expect(nextDegrees('major', 'I')[0]?.to).toBe('IV');
  });

  it('ofrece el bVII desde I, que en un coral no existiría', () => {
    expect(nextDegrees('major', 'I').map((move) => move.to)).toContain('bVII');
  });

  it('desde i en menor lo más habitual es bajar al VII', () => {
    expect(nextDegrees('minor', 'i')[0]?.to).toBe('VII');
  });

  it('devuelve los movimientos ordenados por frecuencia de uso', () => {
    const weights = nextDegrees('major', 'V').map((move) => move.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('protesta si el grado no existe en ese modo', () => {
    expect(() => nextDegrees('major', 'iv')).toThrow(RangeError);
  });
});

describe('resolución de grados a acordes', () => {
  it('convierte grados de C mayor en cifrado', () => {
    expect(resolveDegree(C, 'major', 'I').symbol).toBe('C');
    expect(resolveDegree(C, 'major', 'vi').symbol).toBe('Am');
    expect(resolveDegree(C, 'major', 'bVII').symbol).toBe('A#');
  });

  it('distingue las dos dominantes del menor', () => {
    expect(resolveDegree(A, 'minor', 'v').symbol).toBe('Em');
    expect(resolveDegree(A, 'minor', 'V').symbol).toBe('E');
  });

  it('resuelve el bucle de cuatro acordes en Do', () => {
    const loop = PROGRESSIONS.find((progression) => progression.id === 'four-chords');
    expect(loop).toBeDefined();
    expect(resolveProgression(C, 'major', loop!.degrees).map((chord) => chord.symbol)).toEqual([
      'C',
      'G',
      'Am',
      'F',
    ]);
  });

  it('resuelve el descenso menor en La', () => {
    const descent = PROGRESSIONS.find((progression) => progression.id === 'minor-descent');
    expect(resolveProgression(A, 'minor', descent!.degrees).map((chord) => chord.symbol)).toEqual([
      'Am',
      'G',
      'F',
      'G',
    ]);
  });
});

describe('identificación del grado que suena', () => {
  it('reconoce un acorde diatónico', () => {
    expect(degreeOfChord(C, 'major', pitchClassFromName('F'), 'major')).toBe('IV');
    expect(degreeOfChord(A, 'minor', pitchClassFromName('G'), 'major')).toBe('VII');
  });

  it('reconoce un prestado habitual', () => {
    expect(degreeOfChord(C, 'major', pitchClassFromName('A#'), 'major')).toBe('bVII');
  });

  it('devuelve null si el acorde no encaja', () => {
    expect(degreeOfChord(C, 'major', pitchClassFromName('C#'), 'minor')).toBeNull();
  });
});

describe('catálogo de progresiones', () => {
  it('filtra por modo', () => {
    expect(progressionsFor('major').every((item) => item.mode === 'major')).toBe(true);
    expect(progressionsFor('minor').every((item) => item.mode === 'minor')).toBe(true);
  });

  it('usa solo grados que existen en su modo', () => {
    for (const progression of PROGRESSIONS) {
      const valid = degreesFor(progression.mode);
      for (const degree of progression.degrees) {
        expect(valid).toContain(degree);
      }
    }
  });
});
