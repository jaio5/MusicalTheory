/**
 * ¿Pega este acorde con lo que estoy haciendo?
 *
 * Sirve para el buscador: escribes un cifrado cualquiera y la aplicación te
 * dice si cabe en la tonalidad, si es un color conocido o si se va fuera, y
 * cuánto encaja con lo que estás tocando ahora mismo.
 */

import type { KeyMode } from './keys';
import { noteName, type Accidental, type PitchClass } from './notes';
import { accidentalForKey } from './circle-of-fifths';
import { scaleNotes } from './scales';
import { chordFit, suggestChords } from './suggestions';
import type { StyleId } from './styles';

export type Verdict = 'diatonic' | 'colour' | 'outside';

export interface ChordJudgement {
  readonly verdict: Verdict;
  /** Notas del acorde que no están en la tonalidad. */
  readonly outOfKey: readonly PitchClass[];
  /** Qué grado es, si el catálogo del estilo lo reconoce. */
  readonly label: string | null;
  /** Cuánto encaja con lo que suena, de 0 a 1. */
  readonly fit: number;
  /** El veredicto en una frase. */
  readonly why: string;
}

export interface JudgementContext {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly styleId: StyleId;
  readonly playedNotes?: readonly PitchClass[];
}

function describe(outOfKey: readonly PitchClass[], accidental: Accidental): string {
  return outOfKey.map((note) => noteName(note, accidental)).join(', ');
}

/**
 * Juzga un acorde contra una tonalidad y un estilo.
 *
 * Que una nota se salga de la tonalidad no lo convierte en un error: la mitad
 * de lo que hace interesante a una progresión son notas de fuera. Lo que
 * distingue un color de un choque es si el acorde tiene un uso conocido, y eso
 * lo dice el catálogo del estilo.
 */
export function judgeChord(
  chord: { readonly root: PitchClass; readonly notes: readonly PitchClass[] },
  context: JudgementContext,
): ChordJudgement {
  const { tonic, mode, styleId, playedNotes = [] } = context;
  const accidental = accidentalForKey(tonic, mode);

  const scale = new Set(scaleNotes(tonic, mode === 'major' ? 'major' : 'naturalMinor'));
  const outOfKey = chord.notes.filter((note) => !scale.has(note));
  const fit = chordFit(chord.notes, playedNotes);

  // El catálogo del estilo trae los prestados, las dominantes secundarias y
  // demás: si el acorde está ahí, tiene un uso reconocido aunque se salga.
  const known = suggestChords({ tonic, mode, styleId, limit: 200 }).find(
    (candidate) =>
      candidate.root === chord.root &&
      candidate.notes.length === chord.notes.length &&
      candidate.notes.every((note) => chord.notes.includes(note)),
  );

  if (outOfKey.length === 0) {
    return {
      verdict: 'diatonic',
      outOfKey,
      label: known?.label ?? null,
      fit,
      why: 'Todas sus notas están en la tonalidad: entra sin discusión.',
    };
  }

  if (known !== undefined) {
    return {
      verdict: 'colour',
      outOfKey,
      label: known.label,
      fit,
      why: `Se sale por ${describe(outOfKey, accidental)}, y aun así tiene su sitio: ${known.why.toLowerCase()}`,
    };
  }

  return {
    verdict: 'outside',
    outOfKey,
    label: null,
    fit,
    why:
      outOfKey.length === 1
        ? `Trae ${describe(outOfKey, accidental)}, que no está en la tonalidad. Puede funcionar de paso, pero no se sostiene.`
        : `Trae ${describe(outOfKey, accidental)} fuera de la tonalidad: suena a cambio de tono, no a color.`,
  };
}
