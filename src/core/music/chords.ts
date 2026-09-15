/**
 * Tríadas diatónicas: los acordes que salen de armonizar una escala de siete
 * notas apilando terceras de la propia escala.
 *
 * Solo tríadas. Las cuatríadas no entran todavía porque el modo componer las
 * pide como color, no como estructura, y aún no hay interfaz que las muestre.
 */

import {
  noteName,
  normalizePitchClass,
  type Accidental,
  type NoteName,
  type PitchClass,
} from './notes';
import { scaleNotes, type HeptatonicScaleId } from './scales';

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented';

/** Grado dentro de la escala, contado desde 1 en la tónica. */
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];

export interface DiatonicChord {
  readonly degree: Degree;
  readonly root: PitchClass;
  readonly quality: ChordQuality;
  /** Cifrado anglosajón: Am, C, Bdim, Caug. */
  readonly symbol: string;
  /** Grado en números romanos: mayúscula si es mayor, minúscula si es menor. */
  readonly roman: string;
  /** Las tres notas, desde la fundamental. */
  readonly notes: readonly PitchClass[];
}

const QUALITY_SUFFIX: Readonly<Record<ChordQuality, string>> = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  augmented: 'aug',
};

const ROMAN_NUMERALS: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Las cuatro tríadas, por lo que miden su tercera y su quinta.
 *
 * **Escrito una sola vez**, y esto es lo que arregla: estaba aquí como cuatro
 * `if` y otra vez en `capture.ts` como una tabla, las dos diciendo lo mismo —que
 * un acorde mayor es 0-4-7— en dos ficheros que no se miran. Dos sitios donde
 * vive un hecho musical son dos sitios que se pueden contradecir.
 *
 * **El orden importa**, y no es alfabético ni casual: `major` va antes que
 * `minor` porque quien busca la tríada que hay *dentro* de un acorde con
 * tensiones se queda con la primera que encaja, y un `7#9` lleva dentro la
 * tercera mayor y la menor. Es un acorde mayor con una tensión, no uno menor.
 */
export const TRIADS: ReadonlyArray<{
  readonly third: number;
  readonly fifth: number;
  readonly quality: ChordQuality;
}> = [
  { third: 4, fifth: 7, quality: 'major' },
  { third: 3, fifth: 7, quality: 'minor' },
  { third: 3, fifth: 6, quality: 'diminished' },
  { third: 4, fifth: 8, quality: 'augmented' },
];

/**
 * Deduce la especie a partir de los dos intervalos que forman la tríada.
 * Cualquier otra combinación no es una tríada por terceras y es un error de
 * quien la construyó, no una entrada del usuario.
 */
function qualityFromIntervals(third: number, fifth: number): ChordQuality {
  const triada = TRIADS.find((candidate) => candidate.third === third && candidate.fifth === fifth);
  if (triada === undefined) {
    throw new RangeError(`Los intervalos ${third} y ${fifth} no forman una tríada por terceras.`);
  }
  return triada.quality;
}

export function chordSymbol(
  root: PitchClass,
  quality: ChordQuality,
  accidental: Accidental = 'sharp',
): string {
  return `${noteName(root, accidental)}${QUALITY_SUFFIX[quality]}`;
}

export function romanNumeral(degree: Degree, quality: ChordQuality): string {
  const numeral = ROMAN_NUMERALS[degree - 1];
  if (numeral === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  switch (quality) {
    case 'major':
      return numeral;
    case 'augmented':
      return `${numeral}+`;
    case 'minor':
      return numeral.toLowerCase();
    case 'diminished':
      return `${numeral.toLowerCase()}°`;
  }
}

export function triadNotes(root: PitchClass, quality: ChordQuality): PitchClass[] {
  switch (quality) {
    case 'major':
      return [root, normalizePitchClass(root + 4), normalizePitchClass(root + 7)];
    case 'minor':
      return [root, normalizePitchClass(root + 3), normalizePitchClass(root + 7)];
    case 'diminished':
      return [root, normalizePitchClass(root + 3), normalizePitchClass(root + 6)];
    case 'augmented':
      return [root, normalizePitchClass(root + 4), normalizePitchClass(root + 8)];
  }
}

export function chordNoteNames(
  chord: DiatonicChord | SeventhChord,
  accidental: Accidental = 'sharp',
): NoteName[] {
  return chord.notes.map((note) => noteName(note, accidental));
}

/**
 * La nota que queda `salto` terceras por encima de un grado de la escala.
 *
 * Es lo único que compartían las tríadas y las cuatríadas, y era la parte con
 * trampa de las dos: subir de dos en dos escalones **dando la vuelta** al llegar
 * al final —el V grado coge su séptima del IV, una octava más arriba— y
 * comprobar que la escala tenga los siete escalones que eso da por hecho.
 * Estaba escrito dos veces, con la única diferencia de si se paraba en la quinta
 * o en la séptima.
 *
 * Devuelve una nota y no `PitchClass | undefined`: la comprobación vive aquí, y
 * así quien apila terceras no tiene que repetirla por cada nota que apila.
 */
function escalon(
  notes: readonly PitchClass[],
  scaleId: HeptatonicScaleId,
  degree: Degree,
  salto: number,
): PitchClass {
  const nota = notes[(degree - 1 + salto * 2) % notes.length];
  if (nota === undefined) {
    throw new RangeError(`La escala ${scaleId} no tiene siete notas.`);
  }
  return nota;
}

/**
 * Las siete tríadas de una tonalidad, en orden de grado.
 *
 * Solo acepta escalas de siete notas: apilar terceras sobre una pentatónica
 * daría acordes que nadie toca.
 */
export function diatonicTriads(
  tonic: PitchClass,
  scaleId: HeptatonicScaleId = 'major',
  accidental: Accidental = 'sharp',
): DiatonicChord[] {
  const notes = scaleNotes(tonic, scaleId);

  return DEGREES.map((degree) => {
    const root = escalon(notes, scaleId, degree, 0);
    const third = escalon(notes, scaleId, degree, 1);
    const fifth = escalon(notes, scaleId, degree, 2);

    const quality = qualityFromIntervals(
      normalizePitchClass(third - root),
      normalizePitchClass(fifth - root),
    );

    return {
      degree,
      root,
      quality,
      symbol: chordSymbol(root, quality, accidental),
      roman: romanNumeral(degree, quality),
      notes: [root, third, fifth],
    };
  });
}

export function chordForDegree(
  tonic: PitchClass,
  degree: Degree,
  scaleId: HeptatonicScaleId = 'major',
  accidental: Accidental = 'sharp',
): DiatonicChord {
  const chord = diatonicTriads(tonic, scaleId, accidental)[degree - 1];
  if (chord === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  return chord;
}

/**
 * Cuatríadas: la tríada más la nota que está dos posiciones más arriba en la
 * escala. Es lo que pide el modo componer cuando la tríada se queda sosa.
 */
export type SeventhQuality =
  | 'major7'
  | 'dominant7'
  | 'minor7'
  | 'halfDiminished7'
  | 'diminished7'
  | 'minorMajor7'
  | 'augmentedMajor7';

const SEVENTH_SUFFIX: Readonly<Record<SeventhQuality, string>> = {
  major7: 'maj7',
  dominant7: '7',
  minor7: 'm7',
  halfDiminished7: 'm7b5',
  diminished7: 'dim7',
  minorMajor7: 'mMaj7',
  augmentedMajor7: 'maj7#5',
};

/** Cómo se escribe cada especie en números romanos. */
const SEVENTH_ROMAN: Readonly<Record<SeventhQuality, { upper: boolean; suffix: string }>> = {
  major7: { upper: true, suffix: 'maj7' },
  dominant7: { upper: true, suffix: '7' },
  minor7: { upper: false, suffix: '7' },
  halfDiminished7: { upper: false, suffix: 'ø7' },
  diminished7: { upper: false, suffix: '°7' },
  minorMajor7: { upper: false, suffix: 'maj7' },
  augmentedMajor7: { upper: true, suffix: '+maj7' },
};

export interface SeventhChord {
  readonly degree: Degree;
  readonly root: PitchClass;
  readonly quality: SeventhQuality;
  readonly symbol: string;
  readonly roman: string;
  readonly notes: readonly PitchClass[];
}

function seventhQualityFromIntervals(
  third: number,
  fifth: number,
  seventh: number,
): SeventhQuality {
  if (third === 4 && fifth === 7 && seventh === 11) return 'major7';
  if (third === 4 && fifth === 7 && seventh === 10) return 'dominant7';
  if (third === 3 && fifth === 7 && seventh === 10) return 'minor7';
  if (third === 3 && fifth === 6 && seventh === 10) return 'halfDiminished7';
  if (third === 3 && fifth === 6 && seventh === 9) return 'diminished7';
  if (third === 3 && fifth === 7 && seventh === 11) return 'minorMajor7';
  if (third === 4 && fifth === 8 && seventh === 11) return 'augmentedMajor7';
  throw new RangeError(
    `Los intervalos ${third}, ${fifth} y ${seventh} no forman una cuatríada por terceras.`,
  );
}

export function seventhSymbol(
  root: PitchClass,
  quality: SeventhQuality,
  accidental: Accidental = 'sharp',
): string {
  return `${noteName(root, accidental)}${SEVENTH_SUFFIX[quality]}`;
}

export function seventhRoman(degree: Degree, quality: SeventhQuality): string {
  const numeral = ROMAN_NUMERALS[degree - 1];
  if (numeral === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  const shape = SEVENTH_ROMAN[quality];
  return `${shape.upper ? numeral : numeral.toLowerCase()}${shape.suffix}`;
}

/** Las siete cuatríadas de una tonalidad, en orden de grado. */
export function diatonicSevenths(
  tonic: PitchClass,
  scaleId: HeptatonicScaleId = 'major',
  accidental: Accidental = 'sharp',
): SeventhChord[] {
  const notes = scaleNotes(tonic, scaleId);

  return DEGREES.map((degree) => {
    const root = escalon(notes, scaleId, degree, 0);
    const third = escalon(notes, scaleId, degree, 1);
    const fifth = escalon(notes, scaleId, degree, 2);
    const seventh = escalon(notes, scaleId, degree, 3);

    const quality = seventhQualityFromIntervals(
      normalizePitchClass(third - root),
      normalizePitchClass(fifth - root),
      normalizePitchClass(seventh - root),
    );

    return {
      degree,
      root,
      quality,
      symbol: seventhSymbol(root, quality, accidental),
      roman: seventhRoman(degree, quality),
      notes: [root, third, fifth, seventh],
    };
  });
}

/**
 * La tríada que hay debajo de una cuatríada. Sirve para localizar el grado:
 * un Cmaj7 y un C7 son el mismo grado con distinta séptima.
 */
export function triadQualityOf(quality: SeventhQuality): ChordQuality {
  switch (quality) {
    case 'major7':
    case 'dominant7':
      return 'major';
    case 'minor7':
    case 'minorMajor7':
      return 'minor';
    case 'halfDiminished7':
    case 'diminished7':
      return 'diminished';
    case 'augmentedMajor7':
      return 'augmented';
  }
}
