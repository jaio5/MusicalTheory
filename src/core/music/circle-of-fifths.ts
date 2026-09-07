/**
 * La rueda de quintas: el orden en que se colocan las doce tonalidades y en
 * qué ángulo cae cada una.
 *
 * Los ángulos son geometría de un círculo, no de una pantalla: van en grados,
 * medidos desde arriba y en sentido horario. Quien dibuje decide el radio.
 */

import { normalizePitchClass, type Accidental, type PitchClass } from './notes';
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
  // Sin esto, C mayor devolvería cero negativo: no rompe la aritmética, pero
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

/**
 * Si esa tonalidad se escribe con sostenidos o con bemoles.
 *
 * La regla es la posición en la rueda: de Do a Fa# se va añadiendo sostenidos,
 * y de ahí en adelante es más corto contarlo como bemoles. Fa lleva un bemol
 * (Sib), Sib lleva dos, y así. Fa# y Solb empatan a seis; gana Fa#, que es lo
 * que escribe todo el mundo en guitarra.
 */
export function accidentalForKey(tonic: PitchClass, mode: KeyMode): Accidental {
  return keyPosition(tonic, mode) <= 6 ? 'sharp' : 'flat';
}

/**
 * El orden en que se escriben las alteraciones en la armadura.
 *
 * No es un capricho tipográfico: es el orden del propio círculo. Cada sostenido
 * que se añade está una quinta por encima del anterior, y cada bemol una quinta
 * por debajo, así que las dos listas son la misma leída al revés.
 */
const ORDEN_SOSTENIDOS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;
const ORDEN_BEMOLES = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const;

/** La altura natural de cada letra, sin armadura ninguna. */
const NATURALES: Readonly<Record<string, PitchClass>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export interface KeySignature {
  /** Las letras alteradas, en el orden en que se escriben. */
  readonly letters: readonly string[];
  readonly accidental: Accidental;
}

/**
 * Qué lleva la armadura de esa tonalidad.
 *
 * Sale de la posición en el círculo y no de una tabla escrita a mano: la posición
 * **es** el número de alteraciones. Uno hacia los sostenidos, un sostenido; uno
 * hacia los bemoles, un bemol.
 *
 * Hace falta para dos cosas que parecen distintas y son la misma: dibujar el
 * pentagrama, y saber qué nota es la que se escribe en una línea. En Sol mayor,
 * la línea del Fa es un Fa sostenido, y quien arrastra una nota hasta ahí espera
 * la de la tonalidad, no la natural.
 */
export function keySignature(tonic: PitchClass, mode: KeyMode): KeySignature {
  const position = keyPosition(tonic, mode);
  return position <= 6
    ? { letters: ORDEN_SOSTENIDOS.slice(0, position), accidental: 'sharp' }
    : { letters: ORDEN_BEMOLES.slice(0, 12 - position), accidental: 'flat' };
}

/**
 * Qué altura suena en la línea de esa letra, con la armadura puesta.
 *
 * Es lo que convierte «la tercera línea del pentagrama» en una nota concreta, y
 * por eso pasa por la armadura en vez de por la escala: buscar la letra entre las
 * notas de la escala falla en Fa sostenido mayor, donde el Mi sostenido se llama
 * `F` con los doce nombres que hay y taparía al Fa sostenido.
 */
export function pitchOfLetter(letter: string, signature: KeySignature): PitchClass {
  const natural = NATURALES[letter];
  if (natural === undefined) {
    throw new RangeError(`No es una letra de nota: ${letter}.`);
  }
  if (!signature.letters.includes(letter)) {
    return natural;
  }
  return normalizePitchClass(natural + (signature.accidental === 'sharp' ? 1 : -1));
}
