/**
 * Detección de tonalidad por correlación con los perfiles de Krumhansl.
 *
 * La idea, en lenguaje de músico: cada tonalidad tiene un reparto típico de
 * cuánto suena cada nota. Se cuenta lo que toca el guitarrista, se compara ese
 * reparto con los veinticuatro perfiles (doce mayores y doce menores) y gana el
 * que más se parece. El parecido se mide con la correlación de Pearson, que
 * ignora si toca mucho o poco y solo mira la forma del reparto.
 *
 * El histograma decae con el tiempo: lo de hace un minuto pesa menos que lo de
 * ahora, así que si el guitarrista se va de tono a mitad de sesión la detección
 * le sigue en vez de quedarse anclada al principio.
 */

import { accidentalForKey } from './circle-of-fifths';
import { noteName, SEMITONES_PER_OCTAVE, type PitchClass } from './notes';

export type KeyMode = 'major' | 'minor';

export interface KeyCandidate {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  /** Nombre para la interfaz: «A menor», «C mayor». */
  readonly name: string;
  /** Correlación de Pearson, entre -1 y 1. Cuanto más alta, mejor encaje. */
  readonly score: number;
}

/**
 * Perfiles de Krumhansl y Kessler (1982): cuánto pesa cada grado cromático en
 * una tonalidad mayor y en una menor, empezando por la tónica.
 */
export const KRUMHANSL_MAJOR_PROFILE: readonly number[] = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

export const KRUMHANSL_MINOR_PROFILE: readonly number[] = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

/**
 * Tiempo en el que el peso de una nota se reduce a la mitad. Veinte segundos
 * es media vuelta de una progresión lenta: suficiente para no bailar con cada
 * nota de paso y poco para seguir un cambio de tono real.
 */
export const DEFAULT_HALF_LIFE_MS = 20_000;

/**
 * Reparto acumulado de clases de altura con su marca de tiempo.
 *
 * Es inmutable y el tiempo entra por parámetro: el dominio no lee el reloj,
 * lo hace quien lo llama desde la capa de audio.
 */
export interface PitchHistogram {
  /** Doce pesos, uno por clase de altura, empezando por Do. */
  readonly weights: readonly number[];
  /** Instante en milisegundos al que corresponden esos pesos. */
  readonly updatedAt: number;
}

export function createPitchHistogram(now = 0): PitchHistogram {
  return { weights: new Array<number>(SEMITONES_PER_OCTAVE).fill(0), updatedAt: now };
}

/** Envejece los pesos hasta el instante `at`. Ir hacia atrás no cambia nada. */
export function decayPitchHistogram(
  histogram: PitchHistogram,
  at: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): PitchHistogram {
  if (!(halfLifeMs > 0)) {
    throw new RangeError('La vida media debe ser mayor que cero.');
  }

  const elapsed = at - histogram.updatedAt;
  if (elapsed <= 0) {
    return histogram;
  }

  const factor = Math.pow(2, -elapsed / halfLifeMs);
  return {
    weights: histogram.weights.map((weight) => weight * factor),
    updatedAt: at,
  };
}

export interface AddPitchOptions {
  /** Cuánto suma esta nota. Sirve para pesar por duración o por energía. */
  readonly weight?: number;
  readonly halfLifeMs?: number;
}

/** Envejece el histograma hasta `at` y suma la nota detectada. */
export function addPitchClass(
  histogram: PitchHistogram,
  pitchClass: PitchClass,
  at: number,
  options: AddPitchOptions = {},
): PitchHistogram {
  const { weight = 1, halfLifeMs = DEFAULT_HALF_LIFE_MS } = options;
  const decayed = decayPitchHistogram(histogram, at, halfLifeMs);
  const weights = [...decayed.weights];
  weights[pitchClass] = (weights[pitchClass] ?? 0) + weight;
  return { weights, updatedAt: decayed.updatedAt };
}

function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i] ?? 0;
    sumB += b[i] ?? 0;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }

  const denominator = Math.sqrt(varianceA * varianceB);
  // Un histograma plano (o vacío) no tiene forma que comparar.
  return denominator === 0 ? 0 : covariance / denominator;
}

function rotate(profile: readonly number[], tonic: PitchClass): number[] {
  return profile.map(
    (_, index) => profile[(index - tonic + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE] ?? 0,
  );
}

export function keyName(tonic: PitchClass, mode: KeyMode): string {
  // Bb mayor, no A# mayor: la tonalidad decide su propia escritura.
  return `${noteName(tonic, accidentalForKey(tonic, mode))} ${
    mode === 'major' ? 'mayor' : 'menor'
  }`;
}

function toWeights(source: PitchHistogram | readonly number[]): readonly number[] {
  return Array.isArray(source) ? source : (source as PitchHistogram).weights;
}

/**
 * Las tonalidades que mejor explican lo tocado, de más a menos probable.
 *
 * Devuelve una lista vacía si no hay nada que analizar todavía: es información
 * honesta, y la interfaz debe decir «aún no lo sé» en vez de inventarse un tono.
 */
export function detectKey(source: PitchHistogram | readonly number[], limit = 3): KeyCandidate[] {
  const weights = toWeights(source);
  if (weights.length !== SEMITONES_PER_OCTAVE) {
    throw new RangeError(`El histograma debe tener doce pesos, y tiene ${weights.length}.`);
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return [];
  }

  const candidates: KeyCandidate[] = [];
  for (let tonic = 0; tonic < SEMITONES_PER_OCTAVE; tonic += 1) {
    const pitchClass = tonic as PitchClass;
    candidates.push({
      tonic: pitchClass,
      mode: 'major',
      name: keyName(pitchClass, 'major'),
      score: pearson(weights, rotate(KRUMHANSL_MAJOR_PROFILE, pitchClass)),
    });
    candidates.push({
      tonic: pitchClass,
      mode: 'minor',
      name: keyName(pitchClass, 'minor'),
      score: pearson(weights, rotate(KRUMHANSL_MINOR_PROFILE, pitchClass)),
    });
  }

  // Empate resuelto por tónica y luego por modo, para que dos sesiones con los
  // mismos datos den siempre el mismo orden.
  candidates.sort((a, b) => b.score - a.score || a.tonic - b.tonic || a.mode.localeCompare(b.mode));

  return candidates.slice(0, limit);
}

export function bestKey(source: PitchHistogram | readonly number[]): KeyCandidate | null {
  return detectKey(source, 1)[0] ?? null;
}
