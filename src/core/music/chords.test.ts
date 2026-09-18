import { describe, expect, it } from 'vitest';

import {
  chordForDegree,
  chordNoteNames,
  diatonicSevenths,
  diatonicTriads,
  romanNumeral,
  seventhRoman,
  triadNotes,
  triadQualityOf,
  esQuinta,
  seventhInside,
  type Degree,
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

describe('las cuatro tríadas, sueltas', () => {
  it('cada calidad apila sus terceras', () => {
    // `diatonicTriads` no llega a la aumentada más que en el menor armónico, y
    // la disminuida solo en un grado: sueltas se ven las cuatro de golpe.
    const C = pitchClassFromName('C');

    expect(triadNotes(C, 'major')).toEqual([0, 4, 7]);
    expect(triadNotes(C, 'minor')).toEqual([0, 3, 7]);
    expect(triadNotes(C, 'diminished')).toEqual([0, 3, 6]);
    expect(triadNotes(C, 'augmented')).toEqual([0, 4, 8]);
  });

  it('la aumentada se escribe con su cruz', () => {
    expect(romanNumeral(3, 'augmented')).toBe('III+');
  });
});

describe('un grado que no es un grado', () => {
  /**
   * `Degree` es un tipo de compilación: dice que solo hay del uno al siete y el
   * compilador lo hace cumplir **dentro** del proyecto. Fuera no hay compilador
   * —lo que llega de la base de datos, de la IA o de `localStorage` es JSON— así
   * que estas guardas existen y avisan en vez de devolver `undefined` y
   * reventar tres funciones más allá con un mensaje que no dice nada.
   */
  const fuera = 9 as Degree;
  const C = pitchClassFromName('C');

  it('el número romano avisa en vez de devolver nada', () => {
    expect(() => romanNumeral(fuera, 'major')).toThrow(RangeError);
  });

  it('el de la cuatríada también', () => {
    expect(() => seventhRoman(fuera, 'major7')).toThrow(RangeError);
  });

  it('y pedir el acorde de ese grado, igual', () => {
    expect(() => chordForDegree(C, fuera)).toThrow(RangeError);
  });
});

/**
 * Qué séptima hay dentro de unas notas.
 *
 * Es el gemelo de `triadInside`, y las dos juntas son lo que permite convertir
 * **un acorde cualquiera en un bloque**: un bloque guarda un grado y su séptima,
 * y un `Fmaj7` sin la séptima entraría como un `F` sin que nadie avisara.
 */
describe('la septima que hay dentro', () => {
  const F = pitchClassFromName('F');

  it('reconoce las especies que el montaje sabe guardar', () => {
    // Fmaj7: F A C E
    expect(seventhInside(F, [5, 9, 0, 4])).toBe('major7');
    // F7: F A C Eb
    expect(seventhInside(F, [5, 9, 0, 3])).toBe('dominant7');
    // Fm7: F Ab C Eb
    expect(seventhInside(F, [5, 8, 0, 3])).toBe('minor7');
    // Fm7b5: F Ab B Eb
    expect(seventhInside(F, [5, 8, 11, 3])).toBe('halfDiminished7');
  });

  it('el orden de las notas da igual, que el croma no lo conserva', () => {
    expect(seventhInside(F, [4, 0, 9, 5])).toBe('major7');
  });

  /**
   * Lo que no sabe guardar dice que no, y eso es correcto y no una limitación
   * escondida: una tríada no es una cuatríada, y un `F5` no tiene tercera.
   */
  it('lo que no es una septima suya, no', () => {
    expect(seventhInside(F, [5, 9, 0])).toBeNull();
    expect(seventhInside(F, [5, 0])).toBeNull();
    // Fmaj7 con la fundamental repetida sigue siendo cuatro clases distintas.
    expect(seventhInside(F, [5, 9, 0, 4, 5])).toBe('major7');
    // Cuatro notas que no forman ninguna especie del catálogo.
    expect(seventhInside(F, [5, 6, 7, 8])).toBeNull();
  });
});

/**
 * Un acorde de quinta: la fundamental y su quinta justa, y nada más.
 *
 * Hace falta para poder escribirlo: sin tercera no hay tríada, así que
 * `triadInside` no dice nada y el grado hay que sacarlo de la fundamental
 * ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
 */
describe('si unas notas son una quinta', () => {
  const C = pitchClassFromName('C');

  it('la fundamental y su quinta, en cualquier orden', () => {
    expect(esQuinta(C, [0, 7])).toBe(true);
    expect(esQuinta(C, [7, 0])).toBe(true);
  });

  it('con tercera ya no lo es: es una triada', () => {
    expect(esQuinta(C, [0, 4, 7])).toBe(false);
  });

  it('ni una sola nota, ni una quinta de otro', () => {
    expect(esQuinta(C, [0])).toBe(false);
    expect(esQuinta(C, [5, 0])).toBe(false);
  });
});
