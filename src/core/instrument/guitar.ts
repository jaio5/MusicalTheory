/**
 * La guitarra como instrumento: cuerdas, afinación y trastes.
 *
 * Está en core/ y no en un feature porque lo usan el afinador y el mástil, y un
 * feature no importa de otro. Sigue siendo TypeScript puro: aquí no hay
 * geometría de pantalla, solo qué nota da cada traste de cada cuerda.
 */

import { midiToFrequency, midiToPitchClass, type PitchClass } from '../music/notes';

export interface GuitarString {
  /** Numeración de guitarrista: la 1 es la más aguda. */
  readonly number: 1 | 2 | 3 | 4 | 5 | 6;
  /** Nota al aire, como número MIDI. */
  readonly midi: number;
  /** Nombre en español, tal como se dice al afinar. */
  readonly label: string;
}

/** Afinación estándar, de la sexta a la primera. */
export const STANDARD_TUNING: readonly GuitarString[] = [
  { number: 6, midi: 40, label: 'Mi grave' },
  { number: 5, midi: 45, label: 'La' },
  { number: 4, midi: 50, label: 'Re' },
  { number: 3, midi: 55, label: 'Sol' },
  { number: 2, midi: 59, label: 'Si' },
  { number: 1, midi: 64, label: 'Mi agudo' },
];

/**
 * Trastes que se muestran. Quince cubre las cinco posiciones de la pentatónica
 * sin que el dibujo se haga ilegible.
 */
export const DEFAULT_FRET_COUNT = 15;

/** Trastes donde van los puntos de referencia del mástil. */
export const INLAY_FRETS: readonly number[] = [3, 5, 7, 9, 12, 15];

export function stringFrequency(string: GuitarString): number {
  return midiToFrequency(string.midi);
}

/** Nota de un traste. El traste 0 es la cuerda al aire. */
export function fretMidi(string: GuitarString, fret: number): number {
  return string.midi + fret;
}

export interface FretPosition {
  readonly string: GuitarString;
  readonly fret: number;
  readonly midi: number;
  readonly pitchClass: PitchClass;
}

/** Todas las posiciones del mástil, cuerda por cuerda y traste por traste. */
export function fretboardPositions(
  fretCount: number = DEFAULT_FRET_COUNT,
  tuning: readonly GuitarString[] = STANDARD_TUNING,
): FretPosition[] {
  const positions: FretPosition[] = [];
  for (const string of tuning) {
    for (let fret = 0; fret <= fretCount; fret += 1) {
      const midi = fretMidi(string, fret);
      positions.push({ string, fret, midi, pitchClass: midiToPitchClass(midi) });
    }
  }
  return positions;
}

/**
 * La cuerda al aire más cercana a lo que está sonando. En un empate, gana la
 * más grave: al afinar se sube desde abajo más veces que se baja desde arriba.
 */
export function nearestString(
  midi: number,
  tuning: readonly GuitarString[] = STANDARD_TUNING,
): GuitarString {
  let closest = tuning[0]!;
  for (const string of tuning) {
    if (Math.abs(string.midi - midi) < Math.abs(closest.midi - midi)) {
      closest = string;
    }
  }
  return closest;
}

/** Distancia en semitonos hasta esa cuerda al aire. Cero si es esa misma. */
export function semitonesFromString(midi: number, string: GuitarString): number {
  return midi - string.midi;
}
