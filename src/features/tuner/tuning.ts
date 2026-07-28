/**
 * Lógica del afinador que no necesita React: cuándo se considera afinada una
 * nota, hacia dónde hay que corregir y qué cuerda es la más cercana.
 */

import { noteName, type Accidental, type PitchReading } from '@core/music';

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

/**
 * Texto para el lector de pantalla. Cambia solo cuando cambia la nota o el
 * estado, no con cada cent: una región viva que se actualiza veinte veces por
 * segundo es inservible.
 */
export function readingAnnouncement(
  reading: PitchReading | null,
  accidental: Accidental = 'sharp',
): string {
  if (reading === null) {
    return 'No se oye nada.';
  }
  const status = tuningStatus(reading.cents);
  return `${noteName(reading.pitchClass, accidental)}${reading.octave}, ${tuningAdvice(
    status,
  ).toLowerCase()}.`;
}
