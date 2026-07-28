/**
 * Tríadas diatónicas: los acordes que salen de armonizar una escala de siete
 * notas apilando terceras de la propia escala.
 *
 * Solo tríadas. Las cuatríadas no entran todavía porque el modo componer las
 * pide como color, no como estructura, y aún no hay interfaz que las muestre.
 */

import { noteName, normalizePitchClass, type NoteName, type PitchClass } from './notes';
import { scaleNotes, SCALES, type HeptatonicScaleId } from './scales';

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

/** Nombre en español de cada especie, para los textos de la interfaz. */
export const QUALITY_NAMES: Readonly<Record<ChordQuality, string>> = {
  major: 'mayor',
  minor: 'menor',
  diminished: 'disminuido',
  augmented: 'aumentado',
};

/**
 * Deduce la especie a partir de los dos intervalos que forman la tríada.
 * Cualquier otra combinación no es una tríada por terceras y es un error de
 * quien la construyó, no una entrada del usuario.
 */
function qualityFromIntervals(third: number, fifth: number): ChordQuality {
  if (third === 4 && fifth === 7) return 'major';
  if (third === 3 && fifth === 7) return 'minor';
  if (third === 3 && fifth === 6) return 'diminished';
  if (third === 4 && fifth === 8) return 'augmented';
  throw new RangeError(`Los intervalos ${third} y ${fifth} no forman una tríada por terceras.`);
}

export function chordSymbol(root: PitchClass, quality: ChordQuality): string {
  return `${noteName(root)}${QUALITY_SUFFIX[quality]}`;
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

export function chordNoteNames(chord: DiatonicChord): NoteName[] {
  return chord.notes.map(noteName);
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
): DiatonicChord[] {
  const notes = scaleNotes(tonic, scaleId);
  const size = SCALES[scaleId].intervals.length;

  return DEGREES.map((degree) => {
    const index = degree - 1;
    const root = notes[index];
    const third = notes[(index + 2) % size];
    const fifth = notes[(index + 4) % size];

    if (root === undefined || third === undefined || fifth === undefined) {
      throw new RangeError(`La escala ${scaleId} no tiene siete notas.`);
    }

    const quality = qualityFromIntervals(
      normalizePitchClass(third - root),
      normalizePitchClass(fifth - root),
    );

    return {
      degree,
      root,
      quality,
      symbol: chordSymbol(root, quality),
      roman: romanNumeral(degree, quality),
      notes: [root, third, fifth],
    };
  });
}

export function chordForDegree(
  tonic: PitchClass,
  degree: Degree,
  scaleId: HeptatonicScaleId = 'major',
): DiatonicChord {
  const chord = diatonicTriads(tonic, scaleId)[degree - 1];
  if (chord === undefined) {
    throw new RangeError(`Grado fuera de rango: ${degree}.`);
  }
  return chord;
}
