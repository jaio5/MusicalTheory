import { describe, expect, it } from 'vitest';

import { pitchClassFromName, type PitchClass } from './notes';
import { SCALE_IDS, SCALES, scaleNotes } from './scales';
import {
  bluesNote,
  intervalBetween,
  intervalName,
  intervalNumberName,
  intervalSemitones,
  invertInterval,
  isValidInterval,
  keyDegree,
  keyScale,
  keyTonic,
  letterAt,
  noteAbove,
  parseSpelledName,
  scaleTonic,
  spellAbove,
  spellAt,
  spelledName,
  spelledNote,
  spellScale,
  spellScaleOf,
  type Interval,
} from './spelling';

const pc = (name: Parameters<typeof pitchClassFromName>[0]) => pitchClassFromName(name);
const nombre = (letter: Parameters<typeof spelledNote>[0], alter = 0) => spelledNote(letter, alter);

describe('La letra de cada nota', () => {
  it('se escribe con tantas alteraciones como lleva', () => {
    expect(spelledName(nombre('F', 1))).toBe('F#');
    expect(spelledName(nombre('B', -1))).toBe('Bb');
    expect(spelledName(nombre('F', 2))).toBe('F##');
    expect(spelledName(nombre('B', -2))).toBe('Bbb');
    expect(spelledName(nombre('C'))).toBe('C');
  });

  it('suena donde dice: E# es la tecla de F y Cb la de B', () => {
    expect(nombre('E', 1).pitch).toBe(pc('F'));
    expect(nombre('C', -1).pitch).toBe(pc('B'));
    expect(nombre('F', 2).pitch).toBe(pc('G'));
  });

  it('las letras dan la vuelta por los dos lados', () => {
    expect(letterAt('B', 1)).toBe('C');
    expect(letterAt('C', -1)).toBe('B');
    expect(letterAt('A', 9)).toBe('C');
  });

  it('la tónica se escribe como la escribe la rueda', () => {
    expect(spelledName(keyTonic(pc('C'), 'major'))).toBe('C');
    expect(spelledName(keyTonic(pc('F#'), 'major'))).toBe('F#');
    expect(spelledName(keyTonic(pc('Db'), 'major'))).toBe('Db');
    expect(spelledName(keyTonic(pc('D#'), 'minor'))).toBe('D#');
    expect(spelledName(keyTonic(pc('Bb'), 'minor'))).toBe('Bb');
  });

  it('con cero semitonos y una letra de diferencia sale la enarmónica', () => {
    expect(spelledName(spellAt(nombre('F', 1), 1, 0))).toBe('Gb');
    expect(spelledName(spellAt(nombre('E', 1), 1, 0))).toBe('F');
    expect(spelledName(spellAt(nombre('B', -1), -1, 0))).toBe('A#');
  });
});

describe('Las escalas, con una letra por grado', () => {
  const escala = (tonic: PitchClass, mode: 'major' | 'minor', id: keyof typeof SCALES) =>
    spellScale(keyTonic(tonic, mode), SCALES[id].intervals).map(spelledName).join(' ');

  it('F mayor lleva Bb y D mayor F#, no A# ni Gb', () => {
    expect(escala(pc('F'), 'major', 'major')).toBe('F G A Bb C D E');
    expect(escala(pc('D'), 'major', 'major')).toBe('D E F# G A B C#');
  });

  it('la séptima de F# mayor es E#, y la sensible de G# menor, F##', () => {
    expect(escala(pc('F#'), 'major', 'major')).toBe('F# G# A# B C# D# E#');
    expect(escala(pc('G#'), 'minor', 'harmonicMinor')).toBe('G# A# B C# D# E F##');
  });

  it('ninguna de las veinticuatro repite letra', () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor'] as const) {
        const notas = spellScale(
          keyTonic(tonic as PitchClass, mode),
          SCALES[mode === 'major' ? 'major' : 'naturalMinor'].intervals,
        );
        expect(new Set(notas.map((nota) => nota.letter)).size).toBe(7);
      }
    }
  });
});

describe('Cualquier escala del catálogo, con la letra de su grado', () => {
  const escala = (tonic: PitchClass, id: keyof typeof SCALES) =>
    spellScaleOf(scaleTonic(tonic, id), id).map(spelledName).join(' ');

  it('la tónica la pone la mayor de la que sale la escala', () => {
    expect(spelledName(scaleTonic(pc('F#'), 'major'))).toBe('F#');
    expect(spelledName(scaleTonic(pc('Db'), 'major'))).toBe('Db');
    // La pentatónica menor y el blues de C# salen de E mayor, no de Fb.
    expect(spelledName(scaleTonic(pc('C#'), 'blues'))).toBe('C#');
    // Y el dórico de Eb sale de Db mayor, no de C# mayor.
    expect(spelledName(scaleTonic(pc('Eb'), 'dorian'))).toBe('Eb');
  });

  it('Fa# mayor lleva E#, y Reb mayor y Do mayor, cada uno sus siete letras', () => {
    expect(escala(pc('F#'), 'major')).toBe('F# G# A# B C# D# E#');
    expect(escala(pc('Db'), 'major')).toBe('Db Eb F Gb Ab Bb C');
    expect(escala(pc('C'), 'major')).toBe('C D E F G A B');
  });

  it('las menores de Sol#: la natural con F# y la armónica con F##', () => {
    expect(escala(pc('G#'), 'naturalMinor')).toBe('G# A# B C# D# E F#');
    expect(escala(pc('G#'), 'harmonicMinor')).toBe('G# A# B C# D# E F##');
  });

  it('los modos, con la armadura de la mayor de la que salen', () => {
    expect(escala(pc('Eb'), 'dorian')).toBe('Eb F Gb Ab Bb C Db');
    expect(escala(pc('C'), 'mixolydian')).toBe('C D E F G A Bb');
    expect(escala(pc('F#'), 'phrygian')).toBe('F# G A B C# D E');
  });

  it('las pentatónicas conservan la letra de los grados que quedan', () => {
    expect(escala(pc('F#'), 'majorPentatonic')).toBe('F# G# A# C# D#');
    expect(escala(pc('G#'), 'minorPentatonic')).toBe('G# B C# D# F#');
    expect(escala(pc('C'), 'minorPentatonic')).toBe('C Eb F G Bb');
  });

  it('el blues mete la nota de blues entre la cuarta y la quinta', () => {
    expect(escala(pc('C'), 'blues')).toBe('C Eb F Gb G Bb');
    expect(escala(pc('C#'), 'blues')).toBe('C# E F# G G# B');
    // Un bemol solo se queda: la quinta disminuida de Bb es Fb.
    expect(escala(pc('Bb'), 'blues')).toBe('Bb Db Eb Fb F Ab');
  });

  it('suena lo que dice la escala y no repite letra, en las doce tónicas y en todas', () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const id of SCALE_IDS) {
        const notas = spellScaleOf(scaleTonic(tonic as PitchClass, id), id);
        expect(
          notas.map((nota) => nota.pitch),
          `${id} de ${tonic}`,
        ).toEqual(scaleNotes(tonic as PitchClass, id));
        // La de blues es la única que repite: la nota de paso comparte letra
        // con la cuarta o con la quinta, y por eso es de paso.
        expect(new Set(notas.map((nota) => nota.letter)).size, `${id} de ${tonic}`).toBe(
          id === 'blues' ? 5 : notas.length,
        );
      }
    }
  });
});

describe('La nota de blues', () => {
  const blues = (tonic: string) => spelledName(bluesNote(parseSpelledName(tonic)));

  it('es la quinta disminuida: Gb sobre C, Eb sobre A, C sobre F#', () => {
    expect(blues('C')).toBe('Gb');
    expect(blues('A')).toBe('Eb');
    expect(blues('F#')).toBe('C');
  });

  it('salvo donde pediría doble bemol, que pasa a cuarta aumentada', () => {
    expect(blues('Db')).toBe('G');
    expect(blues('Eb')).toBe('A');
    expect(blues('Ab')).toBe('D');
  });
});

describe('Leer un nombre escrito', () => {
  it('lee la letra y cuenta las alteraciones, dobles incluidas', () => {
    expect(parseSpelledName('E#')).toEqual(nombre('E', 1));
    expect(parseSpelledName('Bbb')).toEqual(nombre('B', -2));
    expect(parseSpelledName('F##')).toEqual(nombre('F', 2));
    expect(parseSpelledName('C')).toEqual(nombre('C'));
    expect(spelledName(parseSpelledName('Cb'))).toBe('Cb');
  });

  it('no se inventa una nota de lo que no lo es', () => {
    for (const malo of ['', 'H', 'c', 'F#b', 'Cx', 'Do']) {
      expect(() => parseSpelledName(malo), malo).toThrow(RangeError);
    }
  });
});

describe('Los grados de la tonalidad', () => {
  it('cada grado lleva su letra aunque la tecla tenga otro nombre', () => {
    expect(spelledName(keyDegree(pc('F#'), 'major', 7))).toBe('E#');
    expect(spelledName(keyDegree(pc('Db'), 'major', 4))).toBe('Gb');
    // En menor se cuenta sobre la natural: el sexto de La menor es Fa.
    expect(spelledName(keyDegree(pc('A'), 'minor', 6))).toBe('F');
    expect(spelledName(keyDegree(pc('A'), 'minor', 3))).toBe('C');
  });

  it('la escala de la tonalidad es la de su armadura, una letra por grado', () => {
    expect(keyScale(pc('F#'), 'major').map(spelledName)).toEqual([
      'F#',
      'G#',
      'A#',
      'B',
      'C#',
      'D#',
      'E#',
    ]);
    expect(keyScale(pc('D#'), 'minor').map(spelledName)).toEqual([
      'D#',
      'E#',
      'F#',
      'G#',
      'A#',
      'B',
      'C#',
    ]);
    // Y sus grados son los de `keyDegree`, en las veinticuatro.
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor'] as const) {
        expect(keyScale(tonic as PitchClass, mode), `${tonic} ${mode}`).toEqual(
          [1, 2, 3, 4, 5, 6, 7].map((grado) => keyDegree(tonic as PitchClass, mode, grado)),
        );
      }
    }
  });

  it('alterar cambia la alteración y nunca la letra', () => {
    expect(spelledName(keyDegree(pc('A'), 'minor', 7, 1))).toBe('G#');
    expect(spelledName(keyDegree(pc('G#'), 'minor', 7, 1))).toBe('F##');
    expect(spelledName(keyDegree(pc('Db'), 'major', 2, -1))).toBe('Ebb');
    expect(spelledName(keyDegree(pc('Db'), 'major', 6, -1))).toBe('Bbb');
    expect(spelledName(keyDegree(pc('Db'), 'major', 7, -1))).toBe('Cb');
  });

  it('spellAbove cuenta primero los semitonos y luego las letras', () => {
    const si = keyDegree(pc('C'), 'major', 7);
    expect(spelledName(spellAbove(si, 4, 2))).toBe('D#');
    expect(spelledName(spellAbove(keyDegree(pc('F#'), 'major', 7), 7, 4))).toBe('B#');
    expect(spelledName(spellAbove(si, -1, -1))).toBe('A#');
  });

  it('la altura escrita es la que suena', () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor'] as const) {
        for (let grado = 1; grado <= 7; grado++) {
          expect(keyDegree(tonic as PitchClass, mode, grado, 1).pitch).toBe(
            (keyDegree(tonic as PitchClass, mode, grado).pitch + 1) % 12,
          );
        }
      }
    }
  });
});

describe('Los intervalos', () => {
  const mi = keyTonic(pc('E'), 'major');
  const tercerMayor: Interval = { number: 3, quality: 'major' };

  it('la tercera mayor de E es G#, y no Ab', () => {
    expect(spelledName(noteAbove(mi, tercerMayor))).toBe('G#');
  });

  it('se nombran por letras y semitonos: C–E y C–Fb suenan igual y no se llaman igual', () => {
    const doNatural = nombre('C');
    expect(intervalBetween(doNatural, nombre('E'))).toEqual(tercerMayor);
    expect(intervalBetween(doNatural, nombre('F', -1))).toEqual({
      number: 4,
      quality: 'diminished',
    });
    expect(intervalBetween(nombre('F'), nombre('G', 1))).toEqual({
      number: 2,
      quality: 'augmented',
    });
    expect(intervalBetween(nombre('B'), nombre('F'))).toEqual({
      number: 5,
      quality: 'diminished',
    });
    expect(intervalBetween(nombre('B'), nombre('B', 1))).toEqual({
      number: 1,
      quality: 'augmented',
    });
  });

  it('lo que no tiene nombre simple no se inventa', () => {
    expect(() => intervalBetween(nombre('C'), nombre('F', 2))).toThrow(RangeError);
  });

  it('la inversión de una tercera mayor es una sexta menor, y la justa sigue justa', () => {
    expect(invertInterval(tercerMayor)).toEqual({ number: 6, quality: 'minor' });
    expect(invertInterval({ number: 4, quality: 'perfect' })).toEqual({
      number: 5,
      quality: 'perfect',
    });
    expect(invertInterval({ number: 4, quality: 'augmented' })).toEqual({
      number: 5,
      quality: 'diminished',
    });
    expect(invertInterval({ number: 7, quality: 'diminished' })).toEqual({
      number: 2,
      quality: 'augmented',
    });
    expect(invertInterval({ number: 1, quality: 'perfect' })).toEqual({
      number: 8,
      quality: 'perfect',
    });
  });

  it('cada especie mide lo que dice', () => {
    expect(intervalSemitones({ number: 5, quality: 'perfect' })).toBe(7);
    expect(intervalSemitones({ number: 5, quality: 'diminished' })).toBe(6);
    expect(intervalSemitones({ number: 4, quality: 'augmented' })).toBe(6);
    expect(intervalSemitones({ number: 3, quality: 'minor' })).toBe(3);
    expect(intervalSemitones({ number: 7, quality: 'diminished' })).toBe(9);
    expect(intervalSemitones({ number: 8, quality: 'perfect' })).toBe(12);
  });

  it('una quinta menor o una tercera justa no existen', () => {
    expect(isValidInterval({ number: 5, quality: 'minor' })).toBe(false);
    expect(isValidInterval({ number: 3, quality: 'perfect' })).toBe(false);
    expect(isValidInterval({ number: 1, quality: 'diminished' })).toBe(false);
    expect(isValidInterval({ number: 9, quality: 'major' })).toBe(false);
    expect(isValidInterval({ number: 0, quality: 'perfect' })).toBe(false);
    expect(isValidInterval({ number: 2.5, quality: 'major' })).toBe(false);
    expect(isValidInterval({ number: 1, quality: 'augmented' })).toBe(true);
    expect(() => intervalSemitones({ number: 5, quality: 'minor' })).toThrow(RangeError);
  });

  it('se dicen como en el conservatorio', () => {
    expect(intervalName(tercerMayor)).toBe('tercera mayor');
    expect(intervalName({ number: 4, quality: 'perfect' })).toBe('cuarta justa');
    expect(intervalName({ number: 5, quality: 'diminished' })).toBe('quinta disminuida');
    expect(intervalName({ number: 1, quality: 'augmented' })).toBe('unísono aumentado');
    expect(intervalNumberName(8)).toBe('octava');
    expect(() => intervalNumberName(9)).toThrow(RangeError);
  });

  it('subir y medir son la misma cuenta', () => {
    const especies = ['perfect', 'major', 'minor', 'augmented', 'diminished'] as const;
    for (let number = 2; number <= 7; number++) {
      for (const quality of especies) {
        const intervalo = { number, quality };
        if (!isValidInterval(intervalo)) continue;
        expect(intervalBetween(mi, noteAbove(mi, intervalo))).toEqual(intervalo);
      }
    }
  });
});
