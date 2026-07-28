import { describe, expect, it } from 'vitest';

import {
  chordForDegree,
  chordNoteNames,
  diatonicSevenths,
  diatonicTriads,
  romanNumeral,
  triadQualityOf,
} from './chords';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');

describe('tríadas de una tonalidad mayor', () => {
  const triads = diatonicTriads(C, 'major');

  it('da los siete acordes de C mayor', () => {
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

  it('da los siete acordes de A menor', () => {
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

describe('escritura con bemoles', () => {
  it('escribe los acordes de F mayor con Sib', () => {
    const triads = diatonicTriads(pitchClassFromName('F'), 'major', 'flat');
    expect(triads.map((chord) => chord.symbol)).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
  });

  it('los mismos acordes con sostenidos serían otra cosa mal escrita', () => {
    const sharp = diatonicTriads(pitchClassFromName('F'), 'major', 'sharp');
    expect(sharp[3]!.symbol).toBe('A#');
  });

  it('deletrea las notas con la escritura pedida', () => {
    const triads = diatonicTriads(pitchClassFromName('F'), 'major', 'flat');
    expect(chordNoteNames(triads[3]!, 'flat')).toEqual(['Bb', 'D', 'F']);
  });
});

describe('cuatríadas', () => {
  it('arma las siete de C mayor', () => {
    const sevenths = diatonicSevenths(C, 'major');
    expect(sevenths.map((chord) => chord.symbol)).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bm7b5',
    ]);
  });

  it('numera los grados con su especie', () => {
    const sevenths = diatonicSevenths(C, 'major');
    expect(sevenths.map((chord) => chord.roman)).toEqual([
      'Imaj7',
      'ii7',
      'iii7',
      'IVmaj7',
      'V7',
      'vi7',
      'viiø7',
    ]);
  });

  it('solo hay una dominante en la tonalidad mayor, y es el quinto grado', () => {
    const sevenths = diatonicSevenths(C, 'major');
    const dominants = sevenths.filter((chord) => chord.quality === 'dominant7');
    expect(dominants).toHaveLength(1);
    expect(dominants[0]!.degree).toBe(5);
  });

  it('arma las de A menor', () => {
    expect(diatonicSevenths(A, 'naturalMinor').map((chord) => chord.symbol)).toEqual([
      'Am7',
      'Bm7b5',
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
    ]);
  });

  it('el menor armónico da el disminuido séptima y la dominante con sensible', () => {
    const sevenths = diatonicSevenths(A, 'harmonicMinor');
    expect(sevenths[4]!.symbol).toBe('E7');
    expect(sevenths[6]!.quality).toBe('diminished7');
    expect(sevenths[0]!.quality).toBe('minorMajor7');
  });

  it('cada cuatríada lleva sus cuatro notas', () => {
    const sevenths = diatonicSevenths(C, 'major');
    expect(sevenths[4]!.notes).toHaveLength(4);
    expect(chordNoteNames(sevenths[4]!)).toEqual(['G', 'B', 'D', 'F']);
  });

  it('respeta la escritura con bemoles', () => {
    const sevenths = diatonicSevenths(pitchClassFromName('F'), 'major', 'flat');
    expect(sevenths[3]!.symbol).toBe('Bbmaj7');
  });
});

describe('la tríada que hay debajo de una cuatríada', () => {
  it('mantiene el grado entre Cmaj7 y C7', () => {
    expect(triadQualityOf('major7')).toBe('major');
    expect(triadQualityOf('dominant7')).toBe('major');
  });

  it('cubre las siete especies', () => {
    const qualities = [
      'major7',
      'dominant7',
      'minor7',
      'halfDiminished7',
      'diminished7',
      'minorMajor7',
      'augmentedMajor7',
    ] as const;

    for (const quality of qualities) {
      expect(['major', 'minor', 'diminished', 'augmented']).toContain(triadQualityOf(quality));
    }
  });

  it('coincide con la tríada del mismo grado', () => {
    const triads = diatonicTriads(C, 'major');
    const sevenths = diatonicSevenths(C, 'major');

    for (let index = 0; index < 7; index += 1) {
      expect(triadQualityOf(sevenths[index]!.quality)).toBe(triads[index]!.quality);
    }
  });
});
