/**
 * Escalas como listas de intervalos en semitonos desde la tónica.
 *
 * Una escala aquí no tiene octava: es un conjunto de clases de altura. Quien
 * necesite trastes concretos multiplica por octavas al pintarlos.
 */

import {
  normalizePitchClass,
  noteName,
  type Accidental,
  type NoteName,
  type PitchClass,
} from './notes';

import { keyPosition } from './circle-of-fifths';

export type ScaleId =
  | 'major'
  | 'naturalMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'phrygian'
  | 'harmonicMinor';

/** Escalas de siete notas: las únicas que admiten armonización por terceras. */
export type HeptatonicScaleId = Extract<
  ScaleId,
  'major' | 'naturalMinor' | 'dorian' | 'mixolydian' | 'phrygian' | 'harmonicMinor'
>;

export interface ScaleDefinition {
  readonly id: ScaleId;
  /** Nombre para la interfaz, en español. */
  readonly name: string;
  /** Semitonos desde la tónica, en orden ascendente y empezando por 0. */
  readonly intervals: readonly number[];
  /** Qué aporta al que toca, en una frase. */
  readonly character: string;
  /**
   * Semitonos hasta la tónica de la mayor de la que sale.
   *
   * Es lo que decide si sus alteraciones se escriben con sostenidos o con
   * bemoles: la pentatónica menor de C sale de Eb mayor, y por eso es
   * C Eb F G Bb y no C D# F G A#, que suena igual y no lo escribe nadie.
   */
  readonly parentOffset: number;
}

export const SCALES: Readonly<Record<ScaleId, ScaleDefinition>> = {
  major: {
    id: 'major',
    name: 'Mayor',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    character: 'La referencia. Todo lo demás se explica como una alteración de esta.',
    parentOffset: 0,
  },
  naturalMinor: {
    id: 'naturalMinor',
    name: 'Menor natural',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    character: 'La relativa menor de la mayor: las mismas notas, otro centro.',
    parentOffset: 3,
  },
  majorPentatonic: {
    id: 'majorPentatonic',
    name: 'Pentatónica mayor',
    intervals: [0, 2, 4, 7, 9],
    character: 'A mayor sin los dos grados que chocan. Difícil sonar mal.',
    parentOffset: 0,
  },
  minorPentatonic: {
    id: 'minorPentatonic',
    name: 'Pentatónica menor',
    intervals: [0, 3, 5, 7, 10],
    character: 'La caja del rock. La primera posición que aprende todo el mundo.',
    parentOffset: 3,
  },
  blues: {
    id: 'blues',
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    character: 'La pentatónica menor con la quinta bemol de paso.',
    parentOffset: 3,
  },
  dorian: {
    id: 'dorian',
    name: 'Dórico',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    character: 'Menor con la sexta mayor. Menos oscura que la menor natural.',
    parentOffset: 10,
  },
  mixolydian: {
    id: 'mixolydian',
    name: 'Mixolidio',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    character: 'Mayor con la séptima menor. El sonido del riff sobre dominante.',
    parentOffset: 5,
  },
  phrygian: {
    id: 'phrygian',
    name: 'Frigio',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    character: 'Menor con la segunda bemol. El giro español y el metal.',
    parentOffset: 8,
  },
  harmonicMinor: {
    id: 'harmonicMinor',
    name: 'Menor armónica',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    character: 'Menor con sensible: crea la dominante que la menor natural no tiene.',
    parentOffset: 3,
  },
};

export const SCALE_IDS: readonly ScaleId[] = Object.keys(SCALES) as ScaleId[];

export const HEPTATONIC_SCALE_IDS: readonly HeptatonicScaleId[] = [
  'major',
  'naturalMinor',
  'dorian',
  'mixolydian',
  'phrygian',
  'harmonicMinor',
];

export function scaleDefinition(id: ScaleId): ScaleDefinition {
  return SCALES[id];
}

export function isHeptatonic(id: ScaleId): id is HeptatonicScaleId {
  return SCALES[id].intervals.length === 7;
}

/** Las clases de altura de la escala, ordenadas desde la tónica. */
/**
 * Cómo se escriben las alteraciones de esta escala sobre esta tónica.
 *
 * Cada escala se escribe con la armadura de la mayor de la que sale, que es la
 * regla de toda la vida: C mixolidio viene de F mayor, así que su séptima es
 * Bb; B menor viene de D mayor, así que su tercera es F# y no Gb.
 */
export function accidentalForScale(tonic: PitchClass, id: ScaleId): Accidental {
  const position = keyPosition(normalizePitchClass(tonic + SCALES[id].parentOffset), 'major');

  // Cuando la mayor de la que sale es C no hay armadura que mande, y entonces
  // decide la escala: si rebaja algún grado se escribe con bemoles. Es lo que
  // hace que el blues de A tenga Eb y no D#.
  if (position === 0) {
    return SCALES[id].intervals.some((interval) => LOWERED.includes(interval)) ? 'flat' : 'sharp';
  }
  return position <= 6 ? 'sharp' : 'flat';
}

/** Intervalos que solo aparecen rebajando un grado de la mayor. */
const LOWERED: readonly number[] = [1, 3, 6, 8, 10];

export function scaleNotes(tonic: PitchClass, id: ScaleId): PitchClass[] {
  return SCALES[id].intervals.map((interval) => normalizePitchClass(tonic + interval));
}

export function scaleNoteNames(
  tonic: PitchClass,
  id: ScaleId,
  accidental: Accidental = accidentalForScale(tonic, id),
): NoteName[] {
  return scaleNotes(tonic, id).map((pitchClass) => noteName(pitchClass, accidental));
}

export function isInScale(pitchClass: PitchClass, tonic: PitchClass, id: ScaleId): boolean {
  return scaleNotes(tonic, id).includes(pitchClass);
}

/**
 * Grado de la nota dentro de la escala, empezando por 1 en la tónica.
 * Devuelve null si la nota no pertenece a la escala.
 */
export function scaleDegree(pitchClass: PitchClass, tonic: PitchClass, id: ScaleId): number | null {
  const index = scaleNotes(tonic, id).indexOf(pitchClass);
  return index === -1 ? null : index + 1;
}
