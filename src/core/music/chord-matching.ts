/**
 * Qué acorde explica mejor lo que está sonando.
 *
 * Entra un croma —doce números, cuánto suena cada nota— y salen candidatos
 * ordenados. Es TypeScript puro: la parte de audio ya ha hecho su trabajo y
 * aquí solo se compara contra las especies que el dominio conoce.
 *
 * El criterio es el coseno entre lo que suena y la plantilla, que castiga las
 * dos cosas a la vez: lo que suena y no debería, y lo que debería y no suena.
 * Hacen falta las dos. Contando solo lo que sobra, un acorde de cinco notas
 * gana siempre —cuantas más notas tiene, más fácil le es cubrir lo que suene—;
 * contando solo lo que falta, Am y C6 son indistinguibles, porque son las
 * mismas tres notas con una cuarta que en Am ni siquiera existe.
 */

import { normalizePitchClass, noteName, type Accidental, type PitchClass } from './notes';
import { CHORD_SHAPES, type ChordShape } from './chord-symbols';

export interface ChordMatch {
  readonly root: PitchClass;
  readonly shape: ChordShape;
  readonly symbol: string;
  readonly notes: readonly PitchClass[];
  /** De 0 a 1. Uno es calcado; por debajo de 0,78 no se parece lo bastante. */
  readonly score: number;
}

export interface MatchOptions {
  /** Cómo escribir el cifrado. */
  readonly accidental?: Accidental;
  readonly limit?: number;
  /** Especies que se buscan. Menos especies, menos confusiones. */
  readonly suffixes?: readonly string[];
}

/**
 * Lo que se busca por defecto: tríadas, séptimas, quintas y suspendidos.
 *
 * Las novenas se dejan fuera a propósito. Una novena tiene cinco notas y en una
 * guitarra casi nunca suenan las cinco, así que compite con ventaja injusta
 * contra la tríada que de verdad estás tocando.
 */
const DEFAULT_SUFFIXES: readonly string[] = [
  '',
  'm',
  '7',
  'm7',
  'maj7',
  '5',
  'sus2',
  'sus4',
  'dim',
  'aug',
  '6',
  'm6',
  'm7b5',
];

/**
 * Se comprime el croma antes de comparar.
 *
 * El oído no es lineal: una tercera a un tercio de volumen se oye, y sin
 * comprimir cuenta tan poco que el acorde se lee como una quinta sin tercera.
 */
const LOUDNESS_EXPONENT = 0.5;

/**
 * Ordena los acordes que mejor explican el croma.
 *
 * Devuelve lista vacía si no suena nada: un croma a cero no es un acorde
 * silencioso, es que no hay nada que reconocer.
 */
export function matchChords(
  chroma: readonly number[],
  options: MatchOptions = {},
): readonly ChordMatch[] {
  const { accidental = 'sharp', limit = 3, suffixes = DEFAULT_SUFFIXES } = options;

  const heard = chroma.map((value) => Math.max(0, value) ** LOUDNESS_EXPONENT);
  const heardNorm = Math.sqrt(heard.reduce((sum, value) => sum + value * value, 0));
  if (heardNorm <= 0) {
    return [];
  }

  const matches: ChordMatch[] = [];

  for (let root = 0; root < 12; root += 1) {
    for (const suffix of suffixes) {
      const shape = CHORD_SHAPES[suffix];
      if (shape === undefined) {
        continue;
      }

      const notes = [
        ...new Set(shape.intervals.map((interval) => normalizePitchClass(root + interval))),
      ];
      const dot = notes.reduce<number>((sum, note) => sum + heard[note]!, 0);
      const score = dot / (heardNorm * Math.sqrt(notes.length));

      matches.push({
        root: normalizePitchClass(root),
        shape,
        symbol: `${noteName(normalizePitchClass(root), accidental)}${shape.suffix}`,
        notes,
        score: Math.max(0, Math.min(1, score)),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** El acorde que suena, o null si nada se parece lo bastante. */
export function bestChord(
  chroma: readonly number[],
  options: MatchOptions & { readonly minScore?: number } = {},
): ChordMatch | null {
  const { minScore = 0.78 } = options;
  const [best] = matchChords(chroma, { ...options, limit: 1 });
  return best !== undefined && best.score >= minScore ? best : null;
}
