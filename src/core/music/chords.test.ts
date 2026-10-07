import { describe, expect, it } from 'vitest';

import {
  chordForDegree,
  chordNoteNames,
  diatonicSevenths,
  diatonicTriads,
  esSeventhQuality,
  romanNumeral,
  seventhFromSuffix,
  seventhRoman,
  triadNotes,
  triadQualityOf,
  esQuinta,
  esEspecieDeBloque,
  esEspecieSimple,
  especieSimpleDe,
  notasDeEspecieSimple,
  simboloDeEspecieSimple,
  seventhInside,
  seventhNotes,
  type Degree,
  type SeventhQuality,
} from './chords';
import { CHORD_SHAPES } from './chord-symbols';
import { pitchClassFromName, type PitchClass } from './notes';
import { HEPTATONIC_SCALE_IDS } from './scales';

/** Los sufijos de cada especie, escritos a mano para no leerlos de la tabla que se prueba. */
const SEVENTH_SUFIJOS: Record<SeventhQuality, string> = {
  major7: 'maj7',
  dominant7: '7',
  minor7: 'm7',
  halfDiminished7: 'm7b5',
  diminished7: 'dim7',
  minorMajor7: 'mMaj7',
  augmentedMajor7: 'maj7#5',
};

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
 * Una forma que no es ninguna de las siete especies no se hace pasar por otra.
 *
 * `seventhNotes` sacaba las notas del catálogo del buscador, que no tiene `mMaj7`
 * ni `maj7#5`, y para esas dos caía a la tríada mayor. Como `seventhInside`
 * compara contra esas notas, cualquier cuatro notas con la tríada mayor dentro
 * —un `C6`, un `Cadd9`— salían `minorMajor7`.
 */
describe('las cuatriadas que no son ninguna septima', () => {
  it('un C6 y un Cadd9 no son ninguna septima', () => {
    // C6: C E G A
    expect(seventhInside(C, [0, 4, 7, 9])).toBeNull();
    // Cadd9: C D E G
    expect(seventhInside(C, [0, 2, 4, 7])).toBeNull();
  });

  it('las siete especies se reconocen por sus notas, y suenan lo que dicen', () => {
    const formas: Record<SeventhQuality, number[]> = {
      major7: [0, 4, 7, 11],
      dominant7: [0, 4, 7, 10],
      minor7: [0, 3, 7, 10],
      halfDiminished7: [0, 3, 6, 10],
      diminished7: [0, 3, 6, 9],
      minorMajor7: [0, 3, 7, 11],
      augmentedMajor7: [0, 4, 8, 11],
    };
    for (const [especie, notas] of Object.entries(formas) as Array<[SeventhQuality, number[]]>) {
      expect(seventhNotes(C, especie), especie).toEqual(notas);
      expect(seventhInside(C, notas as PitchClass[]), especie).toBe(especie);
    }
  });

  /**
   * Dos tablas dicen las notas de una cuatríada —la que apila terceras aquí y la
   * del buscador—, y en las especies que comparten tienen que decir lo mismo.
   */
  it('donde el catalogo del buscador tiene la especie, dice las mismas notas', () => {
    let comparadas = 0;
    for (const especie of Object.keys(SEVENTH_SUFIJOS) as SeventhQuality[]) {
      const forma = CHORD_SHAPES[SEVENTH_SUFIJOS[especie]];
      if (forma !== undefined) {
        expect(seventhNotes(C, especie), especie).toEqual(forma.intervals);
        comparadas += 1;
      }
    }
    // Las cinco que el buscador conoce; `mMaj7` y `maj7#5` no están en él.
    expect(comparadas).toBe(5);
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

/**
 * Las dos tablas de séptimas son una sola, leída en los dos sentidos.
 *
 * `seventhFromSuffix` sale de invertir `SEVENTH_SUFFIX` y no de una lista
 * nueva: es el puente entre lo que alguien escribe —`E7`, `Cmaj7`, `Am7`— y lo
 * que el montaje guarda, y dos listas se desincronizan el día que se añade una
 * especie a una sola.
 */
describe('la especie de septima de un sufijo', () => {
  it('cada especie va y vuelve por su sufijo', () => {
    // Los sufijos escritos a mano, que es el otro lado del puente: si la tabla
    // de dentro cambia sin que cambie esto, el cifrado que alguien teclea deja
    // de entenderse y esta prueba lo dice.
    for (const [especie, sufijo] of Object.entries(SEVENTH_SUFIJOS)) {
      expect(seventhFromSuffix(sufijo), `${especie} no vuelve de «${sufijo}»`).toBe(especie);
      expect(esSeventhQuality(especie)).toBe(true);
    }
  });

  it('y lo que no es un sufijo de septima no es nada', () => {
    expect(seventhFromSuffix('sus4')).toBeNull();
    expect(seventhFromSuffix('')).toBeNull();
  });
});

/**
 * Apilar terceras sobre cualquier escala de siete notas da siete tríadas, las
 * cuatro que existen y ninguna rara. Si alguna escala del catálogo diera un
 * apilamiento que no es tríada, `diatonicTriads` reventaría: esto lo fija.
 */
describe('las triadas de todas las escalas de siete notas', () => {
  it('cada escala da sus siete, y todas son triadas de verdad', () => {
    for (const escala of HEPTATONIC_SCALE_IDS) {
      const triadas = diatonicTriads(pitchClassFromName('C'), escala);
      expect(triadas, `${escala} no da siete`).toHaveLength(7);
      for (const triada of triadas) {
        expect(triada.notes, `${escala} grado ${triada.degree}`).toHaveLength(3);
      }
    }
  });

  /**
   * Y con la séptima encima, lo mismo. La menor armónica es la que saca la rara:
   * su III lleva la sensible, así que sale un maj7 con la quinta aumentada.
   */
  it('y sus siete cuatriadas, incluida la del III de la menor armonica', () => {
    for (const escala of HEPTATONIC_SCALE_IDS) {
      expect(diatonicSevenths(pitchClassFromName('C'), escala), escala).toHaveLength(7);
    }

    const armonica = diatonicSevenths(pitchClassFromName('C'), 'harmonicMinor');
    expect(armonica[2]?.quality).toBe('augmentedMajor7');
  });
});

/**
 * Las especies simples: las tríadas que no se localizan por su calidad, y la
 * quinta ([adr/0042](../../../docs/adr/0042-la-especie-dice-lo-que-el-grado-no-sabe.md)).
 */
describe('Las especies simples', () => {
  const C = 0;

  it('cada una tiene sus notas y su cifrado', () => {
    expect(notasDeEspecieSimple(C, 'quinta')).toEqual([0, 7]);
    expect(notasDeEspecieSimple(C, 'sus2')).toEqual([0, 2, 7]);
    expect(notasDeEspecieSimple(C, 'sus4')).toEqual([0, 5, 7]);
    expect(notasDeEspecieSimple(C, 'dim')).toEqual([0, 3, 6]);
    expect(notasDeEspecieSimple(C, 'aug')).toEqual([0, 4, 8]);
    expect(notasDeEspecieSimple(C, 'menor')).toEqual([0, 3, 7]);

    expect(simboloDeEspecieSimple(C, 'sus4', 'sharp')).toBe('Csus4');
    expect(simboloDeEspecieSimple(C, 'dim', 'flat')).toBe('Cdim');
    expect(simboloDeEspecieSimple(C, 'menor', 'sharp')).toBe('Cm');
  });

  it('se reconocen por sus notas', () => {
    expect(especieSimpleDe(C, [0, 7])).toBe('quinta');
    expect(especieSimpleDe(C, [0, 5, 7])).toBe('sus4');
    expect(especieSimpleDe(C, [0, 3, 6])).toBe('dim');
    expect(especieSimpleDe(C, [0, 4, 8])).toBe('aug');
    expect(especieSimpleDe(C, [0, 3, 7])).toBe('menor');
    // Una tríada mayor no es ninguna: esa sí se localiza por su calidad.
    expect(especieSimpleDe(C, [0, 4, 7])).toBeNull();
  });

  /**
   * **Y una suspendida lo es tenga las notas que tenga encima.** Un `A7sus4` son
   * cuatro y no encaja exacto con ninguna forma de tres; lo que la hace
   * suspendida es que no tiene tercera.
   */
  it('una suspendida con septima sigue siendo suspendida', () => {
    expect(especieSimpleDe(C, [0, 5, 7, 10])).toBe('sus4');
    expect(especieSimpleDe(C, [0, 2, 7, 10])).toBe('sus2');
    // Con tercera dentro ya no lo es, aunque lleve la cuarta.
    expect(especieSimpleDe(C, [0, 4, 5, 7])).toBeNull();
    // Sin quinta tampoco: un intervalo suelto no es un acorde suspendido.
    expect(especieSimpleDe(C, [0, 5])).toBeNull();
    // Sin tercera, con quinta y sin segunda ni cuarta: no hay suspensión.
    expect(especieSimpleDe(C, [0, 7, 10])).toBeNull();
  });

  it('esEspecieDeBloque acepta las simples y las septimas, y nada mas', () => {
    expect(esEspecieSimple('sus4')).toBe(true);
    expect(esEspecieSimple('novena')).toBe(false);
    expect(esEspecieDeBloque('menor')).toBe(true);
    expect(esEspecieDeBloque('diminished7')).toBe(true);
    expect(esEspecieDeBloque('novena')).toBe(false);
  });
});
