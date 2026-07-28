/**
 * Caminos habituales entre grados, con criterio de rock.
 *
 * Esto no es armonía de coral a cuatro voces: aquí el bVII es tan normal como
 * el V, la dominante muchas veces es menor y nadie exige que la sensible
 * resuelva. Los pesos son frecuencia de uso en el repertorio, no reglas.
 */

import { chordSymbol, triadNotes, type ChordQuality } from './chords';
import { accidentalForKey } from './circle-of-fifths';
import { normalizePitchClass, type PitchClass } from './notes';
import type { KeyMode } from './keys';

/** Grados sobre tonalidad mayor, incluidos los tres prestados de rigor. */
export type MajorDegreeSymbol =
  'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°' | 'bIII' | 'bVI' | 'bVII';

/** Grados sobre tonalidad menor, con las dos dominantes y el napolitano. */
export type MinorDegreeSymbol = 'i' | 'ii°' | 'bII' | 'III' | 'iv' | 'v' | 'V' | 'VI' | 'VII';

export type DegreeSymbol = MajorDegreeSymbol | MinorDegreeSymbol;

interface DegreeShape {
  /** Semitonos de la fundamental sobre la tónica. */
  readonly offset: number;
  readonly quality: ChordQuality;
  /** Por qué se usa, en una frase de músico. */
  readonly role: string;
}

const MAJOR_DEGREES: Readonly<Record<MajorDegreeSymbol, DegreeShape>> = {
  I: { offset: 0, quality: 'major', role: 'Casa.' },
  ii: { offset: 2, quality: 'minor', role: 'Antesala de la dominante.' },
  iii: { offset: 4, quality: 'minor', role: 'Casa en penumbra: comparte dos notas con I.' },
  IV: { offset: 5, quality: 'major', role: 'El otro polo. Con I y V basta para medio repertorio.' },
  V: { offset: 7, quality: 'major', role: 'Tensión que pide volver a I.' },
  vi: { offset: 9, quality: 'minor', role: 'La relativa menor: el mismo material, otro ánimo.' },
  'vii°': {
    offset: 11,
    quality: 'diminished',
    role: 'Poco frecuente en rock; suele sustituirse por V.',
  },
  bIII: {
    offset: 3,
    quality: 'major',
    role: 'Prestado del menor. Sube el riff sin salir del tono.',
  },
  bVI: { offset: 8, quality: 'major', role: 'Prestado del menor. Oscurece de golpe.' },
  bVII: { offset: 10, quality: 'major', role: 'El giro mixolidio. Vuelve a I sin sensible.' },
};

const MINOR_DEGREES: Readonly<Record<MinorDegreeSymbol, DegreeShape>> = {
  i: { offset: 0, quality: 'minor', role: 'Casa.' },
  'ii°': { offset: 2, quality: 'diminished', role: 'Raro en rock: casi siempre se cambia por iv.' },
  bII: {
    offset: 1,
    quality: 'major',
    role: 'El color frigio. Un semitono por encima de la tónica.',
  },
  III: { offset: 3, quality: 'major', role: 'La relativa mayor: abre sin cambiar de notas.' },
  iv: { offset: 5, quality: 'minor', role: 'El otro polo del menor.' },
  v: { offset: 7, quality: 'minor', role: 'Dominante menor, sin sensible. La del menor natural.' },
  V: {
    offset: 7,
    quality: 'major',
    role: 'Dominante mayor, prestada del menor armónico. Aprieta más.',
  },
  VI: { offset: 8, quality: 'major', role: 'Descanso luminoso dentro del menor.' },
  VII: { offset: 10, quality: 'major', role: 'Escalón hacia i o hacia III.' },
};

export interface DegreeMove {
  readonly to: DegreeSymbol;
  /** Frecuencia de uso, de 0 a 1. Sirve para ordenar sugerencias. */
  readonly weight: number;
  readonly why: string;
}

const MAJOR_MOVES: Readonly<Record<MajorDegreeSymbol, readonly DegreeMove[]>> = {
  I: [
    { to: 'IV', weight: 0.9, why: 'El movimiento más natural del rock.' },
    { to: 'V', weight: 0.85, why: 'Abre tensión de inmediato.' },
    { to: 'vi', weight: 0.8, why: 'El bucle de los cuatro acordes empieza así.' },
    { to: 'bVII', weight: 0.6, why: 'Sale del diatónico sin perder el centro.' },
    { to: 'iii', weight: 0.35, why: 'Cambio de color suave.' },
    { to: 'ii', weight: 0.3, why: 'Camino largo hacia la dominante.' },
  ],
  ii: [
    { to: 'V', weight: 0.9, why: 'El paso clásico hacia la dominante.' },
    { to: 'I', weight: 0.4, why: 'Vuelta directa a casa.' },
    { to: 'IV', weight: 0.35, why: 'Se queda en la zona blanda.' },
  ],
  iii: [
    { to: 'vi', weight: 0.7, why: 'Cae por quintas.' },
    { to: 'IV', weight: 0.6, why: 'Sube un tono y refresca.' },
    { to: 'I', weight: 0.4, why: 'Vuelta a casa.' },
  ],
  IV: [
    { to: 'I', weight: 0.9, why: 'La cadencia plagal, el amén del rock.' },
    { to: 'V', weight: 0.8, why: 'Escalón hacia la tensión máxima.' },
    { to: 'vi', weight: 0.4, why: 'Sigue el bucle sin volver a casa.' },
    { to: 'bVII', weight: 0.3, why: 'Baja un tono y suena a riff.' },
  ],
  V: [
    { to: 'I', weight: 0.95, why: 'La resolución esperada.' },
    { to: 'vi', weight: 0.5, why: 'Cadencia rota: promete casa y da la menor.' },
    { to: 'IV', weight: 0.45, why: 'Muy usada en blues, impensable en un coral.' },
  ],
  vi: [
    { to: 'IV', weight: 0.9, why: 'Cierra el bucle de los cuatro acordes.' },
    { to: 'V', weight: 0.5, why: 'Recupera tensión.' },
    { to: 'ii', weight: 0.4, why: 'Cae por quintas.' },
    { to: 'I', weight: 0.35, why: 'Vuelta a casa.' },
  ],
  'vii°': [
    { to: 'I', weight: 0.7, why: 'Resuelve por semitono.' },
    { to: 'V', weight: 0.3, why: 'Se reabsorbe en la dominante.' },
  ],
  bIII: [
    { to: 'bVII', weight: 0.7, why: 'Encadena dos prestados y suena a riff mayor.' },
    { to: 'IV', weight: 0.55, why: 'Vuelve al diatónico por el lado blando.' },
    { to: 'I', weight: 0.5, why: 'Regreso brusco y efectivo.' },
  ],
  bVI: [
    { to: 'bVII', weight: 0.8, why: 'Escalón que empuja hacia la tónica.' },
    { to: 'I', weight: 0.5, why: 'Corta el oscurecimiento de golpe.' },
  ],
  bVII: [
    { to: 'I', weight: 0.9, why: 'Cadencia mixolidia: casa sin sensible.' },
    { to: 'IV', weight: 0.6, why: 'Se queda fuera un compás más.' },
    { to: 'bVI', weight: 0.3, why: 'Sigue bajando por tonos.' },
  ],
};

const MINOR_MOVES: Readonly<Record<MinorDegreeSymbol, readonly DegreeMove[]>> = {
  i: [
    { to: 'VII', weight: 0.9, why: 'El descenso por tonos del rock menor.' },
    { to: 'VI', weight: 0.85, why: 'Abre sin abandonar el ánimo.' },
    { to: 'iv', weight: 0.7, why: 'El otro polo del menor.' },
    { to: 'III', weight: 0.6, why: 'Sale a la relativa mayor.' },
    { to: 'bII', weight: 0.3, why: 'Color frigio, muy directo.' },
    { to: 'V', weight: 0.3, why: 'Prepara una vuelta con más tensión.' },
  ],
  'ii°': [
    { to: 'V', weight: 0.6, why: 'Sirve de antesala si se usa la dominante mayor.' },
    { to: 'i', weight: 0.3, why: 'Vuelta directa.' },
  ],
  bII: [
    { to: 'i', weight: 0.9, why: 'Resuelve bajando un semitono. La cadencia frigia.' },
    { to: 'VII', weight: 0.3, why: 'Sigue bajando.' },
  ],
  III: [
    { to: 'VII', weight: 0.7, why: 'Continúa el descenso.' },
    { to: 'VI', weight: 0.6, why: 'Cae por quintas.' },
    { to: 'iv', weight: 0.4, why: 'Vuelve al terreno menor.' },
  ],
  iv: [
    { to: 'i', weight: 0.9, why: 'Cadencia plagal menor.' },
    { to: 'V', weight: 0.5, why: 'Escalón hacia la dominante mayor.' },
    { to: 'v', weight: 0.4, why: 'La misma tensión, sin sensible.' },
    { to: 'VII', weight: 0.35, why: 'Baja al escalón siguiente.' },
  ],
  v: [
    { to: 'i', weight: 0.85, why: 'Resolución modal, sin sensible.' },
    { to: 'iv', weight: 0.35, why: 'Alarga la zona blanda.' },
  ],
  V: [
    { to: 'i', weight: 0.95, why: 'Resolución con sensible: la más tensa del menor.' },
    { to: 'VI', weight: 0.4, why: 'Cadencia rota en menor.' },
  ],
  VI: [
    { to: 'VII', weight: 0.85, why: 'El escalón previo a la vuelta.' },
    { to: 'III', weight: 0.4, why: 'Cae por quintas hacia la relativa mayor.' },
    { to: 'i', weight: 0.4, why: 'Vuelta directa.' },
  ],
  VII: [
    { to: 'i', weight: 0.9, why: 'Cierra el descenso.' },
    { to: 'III', weight: 0.5, why: 'Sube a la relativa mayor.' },
    { to: 'VI', weight: 0.4, why: 'Se queda dando vueltas fuera de casa.' },
  ],
};

export interface ProgressionTemplate {
  readonly id: string;
  readonly name: string;
  readonly mode: KeyMode;
  readonly degrees: readonly DegreeSymbol[];
  readonly note: string;
}

export const PROGRESSIONS: readonly ProgressionTemplate[] = [
  {
    id: 'four-chords',
    name: 'El bucle de cuatro acordes',
    mode: 'major',
    degrees: ['I', 'V', 'vi', 'IV'],
    note: 'Funciona siempre y por eso cansa. Buen punto de partida, mal punto de llegada.',
  },
  {
    id: 'rock-and-roll',
    name: 'Rock and roll',
    mode: 'major',
    degrees: ['I', 'IV', 'V'],
    note: 'Tres acordes y una actitud.',
  },
  {
    id: 'mixolydian-riff',
    name: 'Giro mixolidio',
    mode: 'major',
    degrees: ['I', 'bVII', 'IV'],
    note: 'El bVII evita la sensible y deja el riff a medio camino entre mayor y menor.',
  },
  {
    id: 'twelve-bar-blues',
    name: 'Blues de doce compases',
    mode: 'major',
    degrees: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
    note: 'Un compás por grado. El último V es el giro que reengancha.',
  },
  {
    id: 'minor-descent',
    name: 'Descenso menor',
    mode: 'minor',
    degrees: ['i', 'VII', 'VI', 'VII'],
    note: 'La escalera de bajada de medio rock de los setenta.',
  },
  {
    id: 'andalusian',
    name: 'Cadencia andaluza',
    mode: 'minor',
    degrees: ['i', 'VII', 'VI', 'V'],
    note: 'Igual que la anterior pero cerrando con dominante mayor: aprieta al volver.',
  },
  {
    id: 'minor-plagal',
    name: 'Plagal menor',
    mode: 'minor',
    degrees: ['i', 'iv', 'i', 'v'],
    note: 'Se mueve poco y aguanta mucho: buena base para una letra larga.',
  },
];

export interface ResolvedChord {
  readonly degree: DegreeSymbol;
  readonly root: PitchClass;
  readonly quality: ChordQuality;
  readonly symbol: string;
  readonly notes: readonly PitchClass[];
  readonly role: string;
}

function shapeFor(mode: KeyMode, degree: DegreeSymbol): DegreeShape {
  const shape =
    mode === 'major'
      ? MAJOR_DEGREES[degree as MajorDegreeSymbol]
      : MINOR_DEGREES[degree as MinorDegreeSymbol];

  if (shape === undefined) {
    throw new RangeError(`El grado ${degree} no existe en tonalidad ${mode}.`);
  }
  return shape;
}

/** Convierte un grado en un acorde concreto dentro de una tonalidad. */
export function resolveDegree(
  tonic: PitchClass,
  mode: KeyMode,
  degree: DegreeSymbol,
): ResolvedChord {
  const shape = shapeFor(mode, degree);
  const root = normalizePitchClass(tonic + shape.offset);

  return {
    degree,
    root,
    quality: shape.quality,
    // El grado sabe en qué tonalidad vive, así que puede escribirse solo.
    symbol: chordSymbol(root, shape.quality, accidentalForKey(tonic, mode)),
    notes: triadNotes(root, shape.quality),
    role: shape.role,
  };
}

export function resolveProgression(
  tonic: PitchClass,
  mode: KeyMode,
  degrees: readonly DegreeSymbol[],
): ResolvedChord[] {
  return degrees.map((degree) => resolveDegree(tonic, mode, degree));
}

/** A dónde se suele ir desde un grado, de más a menos frecuente. */
export function nextDegrees(mode: KeyMode, from: DegreeSymbol): DegreeMove[] {
  const moves =
    mode === 'major'
      ? MAJOR_MOVES[from as MajorDegreeSymbol]
      : MINOR_MOVES[from as MinorDegreeSymbol];

  if (moves === undefined) {
    throw new RangeError(`El grado ${from} no existe en tonalidad ${mode}.`);
  }
  return [...moves].sort((a, b) => b.weight - a.weight);
}

export function degreesFor(mode: KeyMode): DegreeSymbol[] {
  return mode === 'major'
    ? (Object.keys(MAJOR_DEGREES) as MajorDegreeSymbol[])
    : (Object.keys(MINOR_DEGREES) as MinorDegreeSymbol[]);
}

export function progressionsFor(mode: KeyMode): ProgressionTemplate[] {
  return PROGRESSIONS.filter((progression) => progression.mode === mode);
}

/**
 * Encuentra el grado que corresponde a un acorde ya sonando, para poder
 * sugerir a dónde ir desde ahí. Devuelve null si el acorde no encaja en la
 * tonalidad ni entre los prestados habituales.
 */
export function degreeOfChord(
  tonic: PitchClass,
  mode: KeyMode,
  root: PitchClass,
  quality: ChordQuality,
): DegreeSymbol | null {
  const offset = normalizePitchClass(root - tonic);
  const table = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;

  for (const [degree, shape] of Object.entries(table)) {
    if (shape.offset === offset && shape.quality === quality) {
      return degree as DegreeSymbol;
    }
  }
  return null;
}
