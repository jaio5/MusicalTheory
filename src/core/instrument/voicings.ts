/**
 * Formas de hacer un acorde sobre el mástil.
 *
 * Nada de tabla de digitaciones copiada: se buscan. Para cada posición del
 * mástil se prueban las combinaciones de trastes que dan las notas del acorde y
 * se descartan las que no se pueden tocar con una mano. Así funciona con
 * cualquier acorde, incluidos los raros que no salen en ningún libro.
 */

import { midiToPitchClass, normalizePitchClass, type PitchClass } from '../music/notes';
import { STANDARD_TUNING, type GuitarString } from './guitar';

export interface Voicing {
  /** Traste por cuerda, de la sexta a la primera. `null` es cuerda muda. */
  readonly frets: readonly (number | null)[];
  /** Traste más grave que se pisa. Cero si es un acorde al aire. */
  readonly position: number;
  /** Cuántas cuerdas suenan. */
  readonly sounding: number;
  /** Si hay que hacer cejilla: varias cuerdas en el traste más bajo. */
  readonly barre: boolean;
  /** Nombre para la interfaz: «al aire», «5.ª posición con cejilla». */
  readonly name: string;
  readonly score: number;
}

export interface VoicingOptions {
  /** Hasta qué traste se busca. */
  readonly maxFret?: number;
  /** Cuántos trastes puede abarcar la mano. */
  readonly maxSpan?: number;
  readonly tuning?: readonly GuitarString[];
  readonly limit?: number;
}

const DEFAULTS = { maxFret: 12, maxSpan: 4, limit: 4 } as const;

/**
 * Cuántas cuerdas tienen que sonar como mínimo. Una quinta se toca con dos o
 * tres cuerdas; una cuatríada necesita al menos sus cuatro notas.
 */
function minimumSounding(chordSize: number): number {
  return Math.max(2, Math.min(4, chordSize));
}

function fretPitchClass(string: GuitarString, fret: number): PitchClass {
  return midiToPitchClass(string.midi + fret);
}

/**
 * Busca las formas de tocar un acorde.
 *
 * Reglas que se aplican, y que son las que separan una digitación real de una
 * combinación de notas cualquiera:
 *
 * - Todas las notas del acorde tienen que estar.
 * - La cuerda más grave que suena lleva la fundamental. Las inversiones son
 *   válidas en música, pero no es lo que se busca al aprender un acorde.
 * - La mano abarca cuatro trastes, contando solo lo que se pisa.
 * - Una cuerda muda en medio de dos que suenan penaliza: se puede, pero cuesta.
 */
export function chordVoicings(
  root: PitchClass,
  intervals: readonly number[],
  options: VoicingOptions = {},
): Voicing[] {
  const {
    maxFret = DEFAULTS.maxFret,
    maxSpan = DEFAULTS.maxSpan,
    tuning = STANDARD_TUNING,
    limit = DEFAULTS.limit,
  } = options;

  const chordNotes = new Set(intervals.map((interval) => normalizePitchClass(root + interval)));
  const needed = minimumSounding(chordNotes.size);
  const found = new Map<string, Voicing>();

  for (let window = 0; window + maxSpan <= maxFret + 1; window += 1) {
    search(0, [], window);
  }

  function search(index: number, frets: (number | null)[], window: number): void {
    if (index === tuning.length) {
      record(frets);
      return;
    }

    const string = tuning[index]!;

    // Muda: solo se permite antes de que suene nada, o al final.
    search(index + 1, [...frets, null], window);

    const candidates: number[] = [];
    if (fretPitchClass(string, 0) !== undefined && chordNotes.has(fretPitchClass(string, 0))) {
      candidates.push(0);
    }
    for (let fret = window; fret < window + maxSpan; fret += 1) {
      if (fret !== 0 && fret <= maxFret && chordNotes.has(fretPitchClass(string, fret))) {
        candidates.push(fret);
      }
    }

    for (const fret of candidates) {
      const sounding = frets.filter((value) => value !== null);
      // La primera cuerda que suena marca el bajo, y el bajo es la fundamental.
      if (sounding.length === 0 && fretPitchClass(string, fret) !== root) {
        continue;
      }
      search(index + 1, [...frets, fret], window);
    }
  }

  function record(frets: readonly (number | null)[]): void {
    const soundingFrets = frets.filter((fret): fret is number => fret !== null);
    if (soundingFrets.length < needed) {
      return;
    }

    const covered = new Set<PitchClass>();
    frets.forEach((fret, index) => {
      if (fret !== null) {
        covered.add(fretPitchClass(tuning[index]!, fret));
      }
    });
    if (covered.size !== chordNotes.size) {
      return;
    }

    const pressed = soundingFrets.filter((fret) => fret > 0);
    const position = pressed.length === 0 ? 0 : Math.min(...pressed);
    if (pressed.length > 0 && Math.max(...pressed) - position >= maxSpan) {
      return;
    }

    const signature = frets.map((fret) => (fret === null ? 'x' : fret)).join('-');
    if (found.has(signature)) {
      return;
    }

    const open = soundingFrets.filter((fret) => fret === 0).length;
    const first = frets.findIndex((fret) => fret !== null);
    const last = frets.length - 1 - [...frets].reverse().findIndex((fret) => fret !== null);
    const innerMutes = frets.slice(first, last + 1).filter((fret) => fret === null).length;
    const barre = pressed.filter((fret) => fret === position).length >= 2 && position > 0;

    found.set(signature, {
      frets,
      position,
      sounding: soundingFrets.length,
      barre,
      name: describeVoicing(position, open, barre),
      score: scoreVoicing({
        position,
        open,
        innerMutes,
        barre,
        sounding: soundingFrets.length,
        span: pressed.length === 0 ? 0 : Math.max(...pressed) - position,
        chordSize: chordNotes.size,
      }),
    });
  }

  // Una por posición. Sin esto, las cuatro mejores son la misma forma con
  // cuerdas quitadas —022100, 02210x, xx2100— que no le sirve a nadie: lo que
  // se quiere ver son sitios distintos del mástil donde cae ese acorde.
  const best = new Map<number, Voicing>();
  for (const voicing of [...found.values()].sort((a, b) => b.score - a.score)) {
    if (!best.has(voicing.position)) {
      best.set(voicing.position, voicing);
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

interface VoicingShape {
  readonly position: number;
  readonly open: number;
  readonly innerMutes: number;
  readonly barre: boolean;
  readonly sounding: number;
  readonly span: number;
  readonly chordSize: number;
}

/**
 * Lo que hace que una digitación sea la que uno toca de verdad.
 *
 * Manda la posición: un acorde en primera posición con cuerdas al aire es el
 * que se aprende y el que se usa, aunque más arriba del mástil existan diez
 * formas más. Después van las cuerdas al aire, y restan el estiramiento, las
 * mudas en medio y la cejilla.
 *
 * Cuántas cuerdas suenan no es «cuantas más mejor»: una tríada abierta suena a
 * seis cuerdas, pero una quinta se toca con dos o tres. Por eso se compara con
 * lo que pide el acorde en vez de premiar el número a secas.
 */
function scoreVoicing(shape: VoicingShape): number {
  const ideal = shape.chordSize >= 3 ? 6 : 3;

  return (
    20 -
    shape.position * 2.2 +
    shape.open * 1.6 -
    shape.innerMutes * 3 -
    shape.span * 0.8 -
    Math.abs(shape.sounding - ideal) * 0.7 -
    (shape.barre ? 0.8 : 0)
  );
}

export function describeVoicing(position: number, openStrings: number, barre: boolean): string {
  if (position === 0) {
    return openStrings > 0 ? 'Al aire' : 'Primera posición';
  }
  return `${position}.ª posición${barre ? ' con cejilla' : ''}`;
}

/** Cómo se escribe una digitación en texto: x02210. */
export function voicingToText(voicing: Voicing): string {
  return voicing.frets.map((fret) => (fret === null ? 'x' : fret)).join('');
}
