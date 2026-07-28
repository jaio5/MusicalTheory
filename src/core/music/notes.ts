/**
 * Conversiones entre frecuencia, MIDI, clase de altura y nombre.
 *
 * Todo el módulo asume temperamento igual de doce notas con La4 = 440 Hz.
 * No hay estado ni dependencias del navegador: es aritmética pura.
 */

export const SEMITONES_PER_OCTAVE = 12;
export const CENTS_PER_SEMITONE = 100;

/** Frecuencia de referencia del diapasón (La4). */
export const A4_FREQUENCY = 440;

/** Número MIDI de La4. Ancla las dos conversiones. */
export const A4_MIDI = 69;

/**
 * Clase de altura: la nota sin octava, contada en semitonos desde Do.
 * Do = 0, Do# = 1, ..., Si = 11.
 */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/**
 * Una nota se escribe con sostenido o con bemol según la tonalidad. Fa mayor
 * lleva Sib, no La#: son la misma tecla y dos nombres distintos, y escribir el
 * que no toca es una falta de ortografía musical.
 */
export type Accidental = 'sharp' | 'flat';

export type SharpName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type FlatName = 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'Gb' | 'G' | 'Ab' | 'A' | 'Bb' | 'B';

/**
 * Nombres en notación anglosajona porque es la que usa el cifrado de acordes
 * (Am, C, G). Para la interfaz existe la traducción al español.
 */
export type NoteName = SharpName | FlatName;

export const SHARP_NAMES: readonly SharpName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export const FLAT_NAMES: readonly FlatName[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/** Alias histórico: los nombres con sostenidos. */
export const NOTE_NAMES: readonly SharpName[] = SHARP_NAMES;

/** Traducción para los textos de la interfaz, que van en español. */
export const SPANISH_NOTE_NAMES: Readonly<Record<NoteName, string>> = {
  C: 'Do',
  'C#': 'Do#',
  Db: 'Reb',
  D: 'Re',
  'D#': 'Re#',
  Eb: 'Mib',
  E: 'Mi',
  F: 'Fa',
  'F#': 'Fa#',
  Gb: 'Solb',
  G: 'Sol',
  'G#': 'Sol#',
  Ab: 'Lab',
  A: 'La',
  'A#': 'La#',
  Bb: 'Sib',
  B: 'Si',
};

/** Lectura de altura ya interpretada: qué nota es y cuánto se desvía. */
export interface PitchReading {
  /** Frecuencia medida, en hercios. */
  readonly frequency: number;
  /** Nota temperada más cercana, como número MIDI entero. */
  readonly midi: number;
  readonly pitchClass: PitchClass;
  readonly name: NoteName;
  /** Octava científica: La4 = 440 Hz vive en la octava 4. */
  readonly octave: number;
  /** Desviación respecto a esa nota, en cents. Positivo = alto. */
  readonly cents: number;
}

/** Reduce cualquier entero al rango 0..11, también negativos. */
export function normalizePitchClass(value: number): PitchClass {
  const wrapped =
    ((Math.round(value) % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  // El módulo garantiza 0..11, que es exactamente PitchClass.
  return wrapped as PitchClass;
}

export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Número MIDI continuo: 69.5 es medio semitono por encima de La4. Redondea
 * quien necesite una nota concreta.
 */
export function frequencyToMidi(frequency: number): number {
  if (!(frequency > 0)) {
    throw new RangeError(`La frecuencia debe ser mayor que cero, y se recibió ${frequency}.`);
  }
  return A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY);
}

export function midiToPitchClass(midi: number): PitchClass {
  return normalizePitchClass(midi);
}

export function midiToOctave(midi: number): number {
  return Math.floor(Math.round(midi) / SEMITONES_PER_OCTAVE) - 1;
}

export function noteName(pitchClass: PitchClass, accidental: Accidental = 'sharp'): NoteName {
  const name = (accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES)[pitchClass];
  if (name === undefined) {
    throw new RangeError(`Clase de altura fuera de rango: ${pitchClass}.`);
  }
  return name;
}

export function spanishNoteName(pitchClass: PitchClass, accidental: Accidental = 'sharp'): string {
  return SPANISH_NOTE_NAMES[noteName(pitchClass, accidental)];
}

/** Acepta las dos escrituras: La# y Sib son la misma clase de altura. */
export function pitchClassFromName(name: NoteName): PitchClass {
  const sharp = SHARP_NAMES.indexOf(name as SharpName);
  if (sharp !== -1) {
    return normalizePitchClass(sharp);
  }
  const flat = FLAT_NAMES.indexOf(name as FlatName);
  if (flat === -1) {
    throw new RangeError(`Nombre de nota desconocido: ${name}.`);
  }
  return normalizePitchClass(flat);
}

/**
 * Desviación de una frecuencia respecto a otra, en cents.
 * Positivo cuando la primera está por encima de la referencia.
 */
export function centsBetween(frequency: number, reference: number): number {
  if (!(frequency > 0) || !(reference > 0)) {
    throw new RangeError('Las dos frecuencias deben ser mayores que cero.');
  }
  return CENTS_PER_SEMITONE * SEMITONES_PER_OCTAVE * Math.log2(frequency / reference);
}

/**
 * Interpreta una frecuencia como nota temperada más desviación.
 * Los cents quedan siempre en el rango [-50, 50): es la distancia a la nota
 * más cercana, que es lo que pinta el afinador.
 */
export function describePitch(frequency: number): PitchReading {
  const exactMidi = frequencyToMidi(frequency);
  const midi = Math.round(exactMidi);
  const pitchClass = midiToPitchClass(midi);

  return {
    frequency,
    midi,
    pitchClass,
    name: noteName(pitchClass),
    octave: midiToOctave(midi),
    cents: (exactMidi - midi) * CENTS_PER_SEMITONE,
  };
}
