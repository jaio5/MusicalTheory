/**
 * La rueda de quintas: el orden en que se colocan las doce tonalidades y en
 * qué ángulo cae cada una.
 *
 * Los ángulos son geometría de un círculo, no de una pantalla: van en grados,
 * medidos desde arriba y en sentido horario. Quien dibuje decide el radio.
 */

import { normalizePitchClass, type PitchClass } from './notes';
import type { KeyMode } from './keys';

/**
 * Las doce tonalidades mayores, cada una una quinta justa por encima de la
 * anterior: Do, Sol, Re, La, Mi, Si, Fa#, Do#, Sol#, Re#, La#, Fa.
 */
export const CIRCLE_OF_FIFTHS: readonly PitchClass[] = Array.from({ length: 12 }, (_, step) =>
  normalizePitchClass(step * 7),
);

export const DEGREES_PER_STEP = 360 / 12;

/** La relativa menor de una tonalidad mayor: una tercera menor por debajo. */
export function relativeMinor(major: PitchClass): PitchClass {
  return normalizePitchClass(major + 9);
}

/** La relativa mayor de una tonalidad menor: una tercera menor por encima. */
export function relativeMajor(minor: PitchClass): PitchClass {
  return normalizePitchClass(minor + 3);
}

/** Posición en la rueda, de 0 a 11, contando desde Do. */
export function circlePosition(tonic: PitchClass): number {
  const position = CIRCLE_OF_FIFTHS.indexOf(tonic);
  if (position === -1) {
    throw new RangeError(`Clase de altura fuera de rango: ${tonic}.`);
  }
  return position;
}

/**
 * Posición de una tonalidad, sea mayor o menor. Una menor ocupa el mismo sitio
 * que su relativa mayor: son las mismas notas, y en la rueda van juntas.
 */
export function keyPosition(tonic: PitchClass, mode: KeyMode): number {
  return circlePosition(mode === 'major' ? tonic : relativeMajor(tonic));
}

/** Ángulo de una posición, en grados desde arriba y en sentido horario. */
export function positionAngle(position: number): number {
  return position * DEGREES_PER_STEP;
}

/**
 * Cuánto hay que girar la rueda para dejar esa tonalidad arriba. Negativo
 * porque la rueda gira al revés que la posición.
 */
export function rotationForKey(tonic: PitchClass, mode: KeyMode): number {
  const angle = positionAngle(keyPosition(tonic, mode));
  // Sin esto, Do mayor devolvería cero negativo: no rompe la aritmética, pero
  // sí las comparaciones estrictas y cualquier cosa que se serialice.
  return angle === 0 ? 0 : -angle;
}

/**
 * El giro más corto entre dos ángulos. Sin esto, pasar de Fa a Do daría una
 * vuelta entera de más porque son 330 grados en vez de -30.
 */
export function shortestRotation(from: number, to: number): number {
  const difference = ((((to - from) % 360) + 540) % 360) - 180;
  return from + difference;
}
