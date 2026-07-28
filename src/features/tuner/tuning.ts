/**
 * Lógica del afinador que no necesita React: cuándo se considera afinada una
 * nota, hacia dónde hay que corregir y qué cuerda es la más cercana.
 */

import { midiToFrequency, noteName, spanishNoteName, type PitchReading } from '@core/music';

/**
 * Margen en cents dentro del cual se da la nota por buena. Cinco cents es
 * aproximadamente el límite de lo que se distingue de oído en una cuerda
 * pulsada, y es lo bastante ancho para que la aguja no baile con el vibrato
 * natural de la mano.
 */
export const IN_TUNE_CENTS = 5;

/** Escala de la aguja: media aguja de lado a lado son cincuenta cents. */
export const METER_RANGE_CENTS = 50;

/**
 * Confianza por debajo de la cual la lectura es válida pero merece un aviso:
 * casi siempre significa distorsión o dos cuerdas sonando a la vez.
 */
export const CLEAN_SIGNAL_CLARITY = 0.95;

export function isSignalClean(clarity: number): boolean {
  return clarity >= CLEAN_SIGNAL_CLARITY;
}

export type TuningStatus = 'afinada' | 'alta' | 'baja';

export function tuningStatus(cents: number, tolerance = IN_TUNE_CENTS): TuningStatus {
  if (Math.abs(cents) <= tolerance) {
    return 'afinada';
  }
  return cents > 0 ? 'alta' : 'baja';
}

/** Qué hacer, dicho con un verbo. */
export function tuningAdvice(status: TuningStatus): string {
  switch (status) {
    case 'afinada':
      return 'Está afinada';
    case 'alta':
      return 'Suena alta: afloja';
    case 'baja':
      return 'Suena baja: tensa';
  }
}

/** Posición de la aguja, de -1 (medio tono baja) a 1 (medio tono alta). */
export function meterOffset(cents: number): number {
  return Math.max(-1, Math.min(1, cents / METER_RANGE_CENTS));
}

export interface GuitarString {
  /** Numeración de guitarrista: la 1 es la más aguda. */
  readonly number: 1 | 2 | 3 | 4 | 5 | 6;
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

export function stringFrequency(string: GuitarString): number {
  return midiToFrequency(string.midi);
}

/**
 * La cuerda al aire más cercana a lo que está sonando. En un empate, gana la
 * más grave: al afinar se sube desde abajo más veces que se baja desde arriba.
 */
export function nearestString(midi: number): GuitarString {
  let closest = STANDARD_TUNING[0]!;
  for (const string of STANDARD_TUNING) {
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

/**
 * Texto para el lector de pantalla. Cambia solo cuando cambia la nota o el
 * estado, no con cada cent: una región viva que se actualiza veinte veces por
 * segundo es inservible.
 */
export function readingAnnouncement(reading: PitchReading | null): string {
  if (reading === null) {
    return 'No se oye nada.';
  }
  const status = tuningStatus(reading.cents);
  return `${spanishNoteName(reading.pitchClass)}${reading.octave}, ${tuningAdvice(status).toLowerCase()}.`;
}

/** Nombre para pintar en grande: en español, con el cifrado anglosajón al lado. */
export function displayNames(reading: PitchReading): { spanish: string; english: string } {
  return {
    spanish: spanishNoteName(reading.pitchClass),
    english: noteName(reading.pitchClass),
  };
}
