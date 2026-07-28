/**
 * A dónde ir desde el acorde que estás tocando.
 *
 * Se parte del catálogo de sugerencias del estilo y se vuelve a ordenar por lo
 * bien que encadena con el acorde actual. Dos cosas mandan: cómo se mueve el
 * bajo y cuántas notas comparten los dos acordes.
 */

import { normalizePitchClass, type PitchClass } from './notes';
import { suggestChords, type ChordSuggestion, type SuggestionInput } from './suggestions';

/**
 * Cómo de fuerte es cada movimiento del bajo, en semitonos hacia arriba.
 *
 * Bajar una quinta —subir una cuarta, 5 semitonos— es el movimiento más fuerte
 * que hay: es lo que hace V–I. El de un tono para arriba o para abajo encadena
 * riffs. El de tercera comparte dos notas y suena a giro suave. El tritono es
 * el más raro de todos y por eso llama la atención.
 */
const ROOT_MOTION: Readonly<Record<number, { weight: number; why: string }>> = {
  0: { weight: 0.35, why: 'Mismo bajo, otro color.' },
  1: { weight: 0.5, why: 'Sube un semitono: tensión inmediata.' },
  2: { weight: 0.75, why: 'Sube un tono, como el bVII al I.' },
  3: { weight: 0.6, why: 'Salto de tercera menor: comparten notas.' },
  4: { weight: 0.55, why: 'Salto de tercera mayor.' },
  5: { weight: 1, why: 'Cae por quintas: el encadenado más fuerte que hay.' },
  6: { weight: 0.3, why: 'Tritono: el salto más raro, y por eso se oye.' },
  7: { weight: 0.8, why: 'Sube una quinta: abre en vez de resolver.' },
  8: { weight: 0.55, why: 'Baja una tercera mayor.' },
  9: { weight: 0.65, why: 'Baja una tercera menor, hacia la relativa.' },
  10: { weight: 0.85, why: 'Baja un tono: la escalera del rock menor.' },
  11: { weight: 0.7, why: 'Baja un semitono: resuelve pegado.' },
};

export interface ChordTransition extends ChordSuggestion {
  /** Cuántas notas comparte con el acorde del que se viene. */
  readonly sharedNotes: number;
  /** Por qué encadena bien. */
  readonly motionWhy: string;
}

export interface TransitionInput extends SuggestionInput {
  /** El acorde en el que estás ahora. */
  readonly from: { readonly root: PitchClass; readonly notes: readonly PitchClass[] };
}

export function sharedNoteCount(a: readonly PitchClass[], b: readonly PitchClass[]): number {
  const set = new Set(a);
  return [...new Set(b)].filter((note) => set.has(note)).length;
}

/**
 * Los acordes a los que se puede ir, de más a menos natural.
 *
 * El acorde del que se viene queda fuera: repetirlo no es ir a ningún sitio.
 */
export function suggestTransitions(input: TransitionInput): ChordTransition[] {
  const { from, limit = 8, ...rest } = input;

  // Se pide de más para tener de dónde elegir después de reordenar.
  const candidates = suggestChords({ ...rest, limit: 40 });

  return candidates
    .filter(
      (candidate) => candidate.root !== from.root || candidate.notes.length !== from.notes.length,
    )
    .map((candidate) => {
      const interval = normalizePitchClass(candidate.root - from.root);
      const motion = ROOT_MOTION[interval] ?? { weight: 0.5, why: '' };
      const sharedNotes = sharedNoteCount(from.notes, candidate.notes);

      // En proporción, no en número: compartir dos notas de cuatro no es más
      // terreno común que compartir una de tres. Contarlas a secas premiaría a
      // los acordes grandes solo por tener más papeletas.
      const commonGround = sharedNotes / Math.max(from.notes.length, candidate.notes.length, 1);

      return {
        ...candidate,
        sharedNotes,
        motionWhy: motion.why,
        // El encadenado manda, pero sin olvidar del todo si el acorde pega en
        // el estilo: si no, en cualquier tonalidad saldría siempre lo mismo.
        score: motion.weight * 0.5 + commonGround * 0.3 + candidate.score * 0.35,
      };
    })
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}
