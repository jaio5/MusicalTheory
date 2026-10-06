/**
 * La ortografía de las notas: qué letra lleva cada una y cuántas alteraciones.
 *
 * `notes.ts` trabaja con clases de altura y doce nombres, y para tocar basta: F#
 * y Gb son la misma tecla. Para enseñar no. En una escala cada letra sale una
 * sola vez, así que la séptima de F# mayor es E# —que con doce nombres se
 * llamaría F y repetiría letra— y la sensible de G# menor es F##, que no está
 * entre esos doce. Y un intervalo no se puede nombrar sin letras: C–E y C–Fb
 * suenan igual y son una tercera mayor y una cuarta disminuida.
 */

import { accidentalForKey } from './circle-of-fifths';
import type { KeyMode } from './keys';
import { normalizePitchClass, noteName, type PitchClass } from './notes';
import { accidentalForScale, SCALES, type ScaleId } from './scales';

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const NATURAL_PITCH: Readonly<Record<Letter, PitchClass>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Una nota escrita: su letra, cuánto la mueven las alteraciones y lo que suena. */
export interface SpelledNote {
  readonly letter: Letter;
  /** Semitonos que la mueven sus alteraciones: +2 es doble sostenido, -1 bemol. */
  readonly alter: number;
  readonly pitch: PitchClass;
}

export function spelledNote(letter: Letter, alter = 0): SpelledNote {
  return { letter, alter, pitch: normalizePitchClass(NATURAL_PITCH[letter] + alter) };
}

/** La letra que está `steps` letras más arriba, o más abajo si es negativo. */
export function letterAt(letter: Letter, steps: number): Letter {
  return LETTERS[(((LETTERS.indexOf(letter) + steps) % 7) + 7) % 7]!;
}

/** En cifrado anglosajón, con las alteraciones repetidas: `F#`, `Bb`, `F##`, `Bbb`. */
export function spelledName(note: SpelledNote): string {
  return `${note.letter}${(note.alter > 0 ? '#' : 'b').repeat(Math.abs(note.alter))}`;
}

/**
 * Lee un nombre ya escrito —`E#`, `Cb`, `F##`, `Bbb`— y lo devuelve como nota.
 *
 * Existe para los que escriben con cadenas: las lecciones y el glosario del
 * profesor tenían cada uno su propio lector y su propio deletreador, y los tres
 * tenían que decir lo mismo. Ahora leen aquí y escriben con `spellAt`.
 */
export function parseSpelledName(name: string): SpelledNote {
  const match = /^([A-G])(#*|b*)$/.exec(name);
  if (match === null) {
    throw new RangeError(`«${name}» no es una nota escrita.`);
  }
  const [, letter, signs] = match as unknown as [string, Letter, string];
  // Contar partes en vez de preguntar qué signo es: vale para «#», «b» y nada.
  return spelledNote(letter, signs.split('#').length - signs.split('b').length);
}

/** La tónica tal como la escribe la tonalidad: Bb mayor y no A# mayor. */
export function keyTonic(tonic: PitchClass, mode: KeyMode): SpelledNote {
  const name = noteName(tonic, accidentalForKey(tonic, mode));
  const sign = name.charAt(1);
  return spelledNote(name.charAt(0) as Letter, sign === '#' ? 1 : sign === 'b' ? -1 : 0);
}

/**
 * La nota que está `steps` letras y `semitones` semitonos por encima —o por
 * debajo, si son negativos—.
 *
 * La letra la decide el número de letras y la alteración la distancia, que es
 * como se escribe a mano: con cero semitonos y una letra de diferencia sale la
 * enarmónica —de F#, Gb—.
 */
export function spellAt(from: SpelledNote, steps: number, semitones: number): SpelledNote {
  const letter = letterAt(from.letter, steps);
  // Entre -6 y 5: la alteración más corta que lleva la letra hasta esa altura.
  const alter = ((((from.pitch + semitones - NATURAL_PITCH[letter]) % 12) + 18) % 12) - 6;
  return spelledNote(letter, alter);
}

/** Lo mismo que `spellAt` con los argumentos al revés: primero los semitonos. */
export function spellAbove(from: SpelledNote, semitones: number, steps: number): SpelledNote {
  return spellAt(from, steps, semitones);
}

/** Una escala de siete notas, escrita con una letra por grado. */
export function spellScale(tonic: SpelledNote, intervals: readonly number[]): SpelledNote[] {
  return intervals.map((semitones, degree) => spellAt(tonic, degree, semitones));
}

/**
 * La escala de la tonalidad tal como sale de su armadura, una letra por grado: la
 * mayor, o en menor la natural.
 */
export function keyScale(tonic: PitchClass, mode: KeyMode): SpelledNote[] {
  return spellScale(
    keyTonic(tonic, mode),
    SCALES[mode === 'major' ? 'major' : 'naturalMinor'].intervals,
  );
}

/**
 * El grado de la tonalidad, del 1 al 7, con la letra que le toca.
 *
 * En menor se cuenta sobre la natural, que es la de la armadura. `alter` lo
 * sube o lo baja **sin cambiarle la letra**: la sensible del armónico de G#
 * menor es F##, no G.
 */
export function keyDegree(
  tonic: PitchClass,
  mode: KeyMode,
  degree: number,
  alter = 0,
): SpelledNote {
  const natural = keyScale(tonic, mode)[degree - 1]!;
  return spelledNote(natural.letter, natural.alter + alter);
}

/**
 * La nota de blues sobre una tónica: la quinta disminuida, **salvo cuando eso
 * pide un doble bemol**, que pasa sobre Db, Eb y Ab —Abb, Bbb y Ebb—: entonces
 * se escribe como cuarta aumentada, G, A y D.
 *
 * No es un capricho para evitar el signo raro. Es una nota de paso cromática
 * entre la cuarta y la quinta, y la escala se dice subiendo; la ortografía de una
 * nota de paso que sube es la de la nota de abajo alterada hacia arriba, y así la
 * escriben los métodos de blues y jazz (C Eb F F# G Bb). Lo que no escribe nadie,
 * ni en el conservatorio ni fuera, es una nota de paso con doble alteración
 * cuando la otra letra la deja con una o ninguna: Db Fb Gb Abb Ab Cb es correcto
 * en el papel e ilegible con la guitarra en las manos. Se queda la quinta
 * disminuida en las otras veintiuna porque es el nombre de la nota y lo que
 * promete la unidad, y la cuarta aumentada suena igual.
 *
 * Vive aquí y no en la lección porque la escriben dos: la lección de pentatónicas
 * y la unidad de tocar la escala de blues, que tienen que decir la misma nota.
 */
export function bluesNote(tonic: SpelledNote): SpelledNote {
  const fifth = spellAt(tonic, 4, 6);
  return Math.abs(fifth.alter) >= 2 ? spellAt(tonic, 3, 6) : fifth;
}

/**
 * Cuántas letras sube cada nota de cada escala desde la tónica.
 *
 * Las de siete llevan una letra por grado. Las pentatónicas son la mayor y la
 * menor natural sin dos grados, y conservan las letras de los que quedan: la
 * mayor salta la cuarta y la séptima, la menor la segunda y la sexta. La de blues
 * no está: es la pentatónica menor con `bluesNote` metida en medio.
 */
const LETTER_STEPS: Readonly<Record<Exclude<ScaleId, 'blues'>, readonly number[]>> = {
  major: [0, 1, 2, 3, 4, 5, 6],
  naturalMinor: [0, 1, 2, 3, 4, 5, 6],
  dorian: [0, 1, 2, 3, 4, 5, 6],
  mixolydian: [0, 1, 2, 3, 4, 5, 6],
  phrygian: [0, 1, 2, 3, 4, 5, 6],
  harmonicMinor: [0, 1, 2, 3, 4, 5, 6],
  majorPentatonic: [0, 1, 2, 4, 5],
  minorPentatonic: [0, 2, 3, 4, 6],
};

/**
 * La tónica de una escala tal como la escribe la mayor de la que sale: el blues
 * de C# y no el de Db, el dórico de Eb y no el de D#. Es el mismo criterio que
 * `accidentalForScale`, que es el que ya decía el nombre de la escala.
 */
export function scaleTonic(tonic: PitchClass, id: ScaleId): SpelledNote {
  return parseSpelledName(noteName(tonic, accidentalForScale(tonic, id)));
}

/**
 * Cualquier escala del catálogo escrita sobre su tónica, cada nota con la letra
 * de su grado: E# en Fa# mayor, F## en la armónica de Sol# menor.
 *
 * `scaleNoteNames` dice lo mismo con doce nombres, y para tocar vale: suenan
 * igual. Para leerlo al lado de una lección que dice E#, no.
 */
export function spellScaleOf(tonic: SpelledNote, id: ScaleId): SpelledNote[] {
  if (id === 'blues') {
    const pentatonic = spellScaleOf(tonic, 'minorPentatonic');
    return [...pentatonic.slice(0, 3), bluesNote(tonic), ...pentatonic.slice(3)];
  }
  const steps = LETTER_STEPS[id];
  return SCALES[id].intervals.map((semitones, index) => spellAt(tonic, steps[index]!, semitones));
}

export type IntervalQuality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished';

/** Un intervalo simple y ascendente: del unísono (1) a la octava (8). */
export interface Interval {
  readonly number: number;
  readonly quality: IntervalQuality;
}

/** Los semitonos de la especie justa o mayor de cada número, del unísono a la octava. */
const BASE_SEMITONES: readonly number[] = [0, 0, 2, 4, 5, 7, 9, 11, 12];

/** Unísono, cuarta, quinta y octava: los que son justos y no mayores ni menores. */
export function isPerfectNumber(number: number): boolean {
  return number === 1 || number === 4 || number === 5 || number === 8;
}

/** Cuántos semitonos se aparta cada especie de la justa o de la mayor. */
const SHIFTS: Readonly<Record<'perfect' | 'major', Readonly<Record<number, IntervalQuality>>>> = {
  perfect: { [-1]: 'diminished', 0: 'perfect', 1: 'augmented' },
  major: { [-2]: 'diminished', [-1]: 'minor', 0: 'major', 1: 'augmented' },
};

function shiftsFor(number: number) {
  return SHIFTS[isPerfectNumber(number) ? 'perfect' : 'major'];
}

/** Una cuarta mayor o una tercera justa no existen, y aquí se dice. */
export function isValidInterval(interval: Interval): boolean {
  return (
    Number.isInteger(interval.number) &&
    interval.number >= 1 &&
    interval.number <= 8 &&
    Object.values(shiftsFor(interval.number)).includes(interval.quality) &&
    // Por debajo del unísono no se llega subiendo.
    !(interval.number === 1 && interval.quality === 'diminished')
  );
}

export function intervalSemitones(interval: Interval): number {
  if (!isValidInterval(interval)) {
    throw new RangeError(`No hay ${interval.number}ª ${interval.quality}.`);
  }
  const [shift] = Object.entries(shiftsFor(interval.number)).find(
    ([, quality]) => quality === interval.quality,
  )!;
  return BASE_SEMITONES[interval.number]! + Number(shift);
}

export function noteAbove(from: SpelledNote, interval: Interval): SpelledNote {
  return spellAt(from, interval.number - 1, intervalSemitones(interval));
}

/**
 * El intervalo de `lower` a `upper`, subiendo y dentro de la octava.
 *
 * Primero las letras y luego los semitonos, en ese orden y no al revés: contar
 * solo semitonos no distingue C–E de C–Fb.
 */
export function intervalBetween(lower: SpelledNote, upper: SpelledNote): Interval {
  const steps = (LETTERS.indexOf(upper.letter) - LETTERS.indexOf(lower.letter) + 7) % 7;
  const number = steps + 1;
  const semitones = upper.pitch - lower.pitch;
  const shift = ((((semitones - BASE_SEMITONES[number]!) % 12) + 18) % 12) - 6;
  const quality = shiftsFor(number)[shift];
  if (quality === undefined) {
    throw new RangeError(
      `De ${spelledName(lower)} a ${spelledName(upper)} no hay un intervalo simple con nombre.`,
    );
  }
  return { number, quality };
}

const INVERSE_QUALITY: Readonly<Record<IntervalQuality, IntervalQuality>> = {
  perfect: 'perfect',
  major: 'minor',
  minor: 'major',
  augmented: 'diminished',
  diminished: 'augmented',
};

/** Suman nueve, y la especie se da la vuelta: la justa sigue justa. */
export function invertInterval(interval: Interval): Interval {
  return { number: 9 - interval.number, quality: INVERSE_QUALITY[interval.quality] };
}

const NUMBER_NAMES: readonly string[] = [
  'unísono',
  'segunda',
  'tercera',
  'cuarta',
  'quinta',
  'sexta',
  'séptima',
  'octava',
];

/** «tercera», «quinta»: el número del intervalo en palabras. */
export function intervalNumberName(number: number): string {
  const name = NUMBER_NAMES[number - 1];
  if (name === undefined) {
    throw new RangeError(`Un intervalo simple va del 1 al 8, y se pidió ${number}.`);
  }
  return name;
}

/*
  En femenino porque se nombran con el ordinal —«una tercera mayor», «una cuarta
  justa»—, que es como se dice en el conservatorio. El unísono es el único
  masculino.
*/
const QUALITY_NAMES: Readonly<Record<IntervalQuality, readonly [string, string]>> = {
  perfect: ['justa', 'justo'],
  major: ['mayor', 'mayor'],
  minor: ['menor', 'menor'],
  augmented: ['aumentada', 'aumentado'],
  diminished: ['disminuida', 'disminuido'],
};

/** «tercera mayor», «cuarta justa», «unísono aumentado». */
export function intervalName(interval: Interval): string {
  const [feminine, masculine] = QUALITY_NAMES[interval.quality];
  return `${intervalNumberName(interval.number)} ${interval.number === 1 ? masculine : feminine}`;
}
