/**
 * Leer un acorde escrito: «F#m7», «Bb», «Csus4», «A7#9».
 *
 * Hace falta para poder buscar un acorde y preguntarle a la aplicación si pega
 * con lo que estás haciendo. Es lo contrario de lo que hace el resto del
 * dominio, que parte de grados y produce cifrados.
 */

import { normalizePitchClass, type NoteName, type PitchClass } from './notes';
import { pitchClassFromName } from './notes';

export interface ChordShape {
  /** Semitonos desde la fundamental. */
  readonly intervals: readonly number[];
  /** Nombre de la especie, en español. */
  readonly name: string;
  /** Cómo se escribe en el cifrado. */
  readonly suffix: string;
}

/**
 * Las especies que se reconocen, con sus formas de escribirse. La clave es el
 * sufijo ya normalizado a minúsculas.
 */
export const CHORD_SHAPES: Readonly<Record<string, ChordShape>> = {
  '': { intervals: [0, 4, 7], name: 'mayor', suffix: '' },
  m: { intervals: [0, 3, 7], name: 'menor', suffix: 'm' },
  '5': { intervals: [0, 7], name: 'quinta', suffix: '5' },
  sus2: { intervals: [0, 2, 7], name: 'con segunda suspendida', suffix: 'sus2' },
  sus4: { intervals: [0, 5, 7], name: 'con cuarta suspendida', suffix: 'sus4' },
  '6': { intervals: [0, 4, 7, 9], name: 'con sexta', suffix: '6' },
  m6: { intervals: [0, 3, 7, 9], name: 'menor con sexta', suffix: 'm6' },
  '7': { intervals: [0, 4, 7, 10], name: 'dominante', suffix: '7' },
  maj7: { intervals: [0, 4, 7, 11], name: 'con séptima mayor', suffix: 'maj7' },
  m7: { intervals: [0, 3, 7, 10], name: 'menor séptima', suffix: 'm7' },
  m7b5: { intervals: [0, 3, 6, 10], name: 'semidisminuido', suffix: 'm7b5' },
  dim: { intervals: [0, 3, 6], name: 'disminuido', suffix: 'dim' },
  dim7: { intervals: [0, 3, 6, 9], name: 'disminuido séptima', suffix: 'dim7' },
  aug: { intervals: [0, 4, 8], name: 'aumentado', suffix: 'aug' },
  add9: { intervals: [0, 2, 4, 7], name: 'con novena añadida', suffix: 'add9' },
  '7sus4': { intervals: [0, 5, 7, 10], name: 'dominante con cuarta suspendida', suffix: '7sus4' },
  '7#9': { intervals: [0, 3, 4, 7, 10], name: 'dominante con novena aumentada', suffix: '7#9' },
  '7b9': { intervals: [0, 1, 4, 7, 10], name: 'dominante con novena bemol', suffix: '7b9' },
  '9': { intervals: [0, 2, 4, 7, 10], name: 'novena', suffix: '9' },
  m9: { intervals: [0, 2, 3, 7, 10], name: 'menor novena', suffix: 'm9' },
  maj9: { intervals: [0, 2, 4, 7, 11], name: 'con novena mayor', suffix: 'maj9' },
};

/** Otras formas de escribir lo mismo. */
const ALIASES: Readonly<Record<string, string>> = {
  min: 'm',
  '-': 'm',
  sus: 'sus4',
  M7: 'maj7',
  Δ: 'maj7',
  ma7: 'maj7',
  mi7: 'm7',
  '°': 'dim',
  '°7': 'dim7',
  o: 'dim',
  ø: 'm7b5',
  'm7-5': 'm7b5',
  '+': 'aug',
  '#5': 'aug',
  add2: 'add9',
  '69': '6',
};

export interface ParsedChord {
  /** Cifrado normalizado: lo que se escribió, bien escrito. */
  readonly symbol: string;
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
  readonly shape: ChordShape;
}

/**
 * De más a menos frecuente en una guitarra. Es el orden en el que se ofrecen al
 * escribir: quien teclea «A» busca A, Am o A7 mucho antes que A7b9.
 */
const BY_USE: readonly string[] = [
  '',
  'm',
  '7',
  'm7',
  'maj7',
  '5',
  'sus4',
  'sus2',
  'add9',
  '6',
  'm6',
  '9',
  'm9',
  'maj9',
  'dim',
  'dim7',
  'm7b5',
  'aug',
  '7sus4',
  '7#9',
  '7b9',
];

export const KNOWN_SUFFIXES: readonly string[] = BY_USE.filter((suffix) => suffix !== '');

/**
 * Interpreta un cifrado. Devuelve null si no lo reconoce, que es información
 * útil: la interfaz puede decir «no conozco ese acorde» en vez de callarse.
 */
export function parseChordSymbol(text: string): ParsedChord | null {
  const clean = text.trim().replace(/\s+/g, '');
  if (clean === '') {
    return null;
  }

  const match = /^([A-Ga-g])([#b]?)(.*)$/.exec(clean);
  if (match === null) {
    return null;
  }

  const [, letter, accidental, rest] = match;
  const name = `${letter!.toUpperCase()}${accidental ?? ''}` as NoteName;

  let root: PitchClass;
  try {
    root = pitchClassFromName(name);
  } catch {
    return null;
  }

  const suffix = normalizeSuffix(rest ?? '');
  const shape = CHORD_SHAPES[suffix];
  if (shape === undefined) {
    return null;
  }

  return {
    symbol: `${name}${shape.suffix}`,
    root,
    notes: [...new Set(shape.intervals.map((interval) => normalizePitchClass(root + interval)))],
    shape,
  };
}

function normalizeSuffix(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  // Las mayúsculas solo importan para distinguir M7 de m7; el resto se compara
  // en minúsculas para aceptar «DIM7» o «Sus4».
  const alias = ALIASES[trimmed] ?? ALIASES[trimmed.toLowerCase()];
  if (alias !== undefined) {
    return alias;
  }
  const lower = trimmed.toLowerCase();
  return CHORD_SHAPES[lower] === undefined ? trimmed : lower;
}

/**
 * Qué acordes podrían ser lo que se está escribiendo.
 *
 * Basta con la fundamental para empezar a proponer: con «A» ya se sabe que
 * puede acabar en A, Am o A7. Lo que no se reconoce como fundamental no propone
 * nada, porque cualquier cosa sería adivinar.
 */
export function suggestChordSymbols(text: string, limit = 8): readonly ParsedChord[] {
  const clean = text.trim().replace(/\s+/g, '');
  const match = /^([A-Ga-g])([#b]?)(.*)$/.exec(clean);
  if (match === null) {
    return [];
  }

  const [, letter, accidental, rest = ''] = match;
  const root = `${letter!.toUpperCase()}${accidental ?? ''}`;
  const typed = rest.trim();
  const resolved = typed === '' ? '' : normalizeSuffix(typed);

  // Lo que ya se ha escrito entero va primero: si alguien teclea «Am7» quiere
  // Am7, y las variantes que empiezan igual vienen detrás.
  const exact = CHORD_SHAPES[resolved] === undefined ? [] : [resolved];
  const starts = BY_USE.filter(
    (suffix) => !exact.includes(suffix) && suffix.toLowerCase().startsWith(typed.toLowerCase()),
  );

  return [...exact, ...starts]
    .slice(0, limit)
    .map((suffix) => parseChordSymbol(`${root}${suffix}`))
    .filter((chord): chord is ParsedChord => chord !== null);
}
