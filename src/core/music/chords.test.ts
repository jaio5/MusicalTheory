import { describe, expect, it } from 'vitest';

import { chordForDegree, chordNoteNames, diatonicTriads, romanNumeral } from './chords';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');

describe('tríadas de una tonalidad mayor', () => {
  const triads = diatonicTriads(C, 'major');

  it('da los siete acordes de Do mayor', () => {
    expect(triads.map((chord) => chord.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  });

  it('numera los grados en romanos con la caja correcta', () => {
    expect(triads.map((chord) => chord.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  });

  it('deletrea cada acorde con sus tres notas', () => {
    expect(chordNoteNames(triads[0]!)).toEqual(['C', 'E', 'G']);
    expect(chordNoteNames(triads[4]!)).toEqual(['G', 'B', 'D']);
    expect(chordNoteNames(triads[6]!)).toEqual(['B', 'D', 'F']);
  });
});

describe('tríadas de una tonalidad menor', () => {
  const triads = diatonicTriads(A, 'naturalMinor');

  it('da los siete acordes de La menor', () => {
    expect(triads.map((chord) => chord.symbol)).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
  });

  it('numera los grados del menor natural', () => {
    expect(triads.map((chord) => chord.roman)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  });

  it('comparte notas con su relativa mayor', () => {
    const relative = diatonicTriads(pitchClassFromName('C'), 'major');
    expect(triads.map((chord) => chord.symbol).sort()).toEqual(
      relative.map((chord) => chord.symbol).sort(),
    );
  });
});

describe('otros modos', () => {
  it('el menor armónico crea dominante mayor y un aumentado', () => {
    const triads = diatonicTriads(A, 'harmonicMinor');
    expect(triads.map((chord) => chord.symbol)).toEqual([
      'Am',
      'Bdim',
      'Caug',
      'Dm',
      'E',
      'F',
      'G#dim',
    ]);
    expect(triads[4]!.roman).toBe('V');
    expect(triads[2]!.roman).toBe('III+');
  });

  it('el mixolidio pone el séptimo grado mayor', () => {
    const triads = diatonicTriads(pitchClassFromName('G'), 'mixolydian');
    expect(triads.map((chord) => chord.symbol)).toEqual(['G', 'Am', 'Bdim', 'C', 'Dm', 'Em', 'F']);
  });
});

describe('acceso por grado', () => {
  it('devuelve el acorde de un grado concreto', () => {
    expect(chordForDegree(C, 5, 'major').symbol).toBe('G');
    expect(chordForDegree(A, 4, 'naturalMinor').symbol).toBe('Dm');
  });

  it('escribe los romanos según la especie', () => {
    expect(romanNumeral(1, 'major')).toBe('I');
    expect(romanNumeral(2, 'minor')).toBe('ii');
    expect(romanNumeral(7, 'diminished')).toBe('vii°');
    expect(romanNumeral(3, 'augmented')).toBe('III+');
  });
});
