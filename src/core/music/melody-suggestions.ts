/**
 * Qué nota puede ir después, y por qué.
 *
 * Es el hermano de `suggestions.ts`, que hace lo mismo con acordes, y existe por
 * la misma razón: **con la lista delante se puede componer sin saber teoría**.
 * Elegir el acorde siguiente ya estaba resuelto; elegir la nota siguiente, que es
 * la mitad de escribir un punteo, no.
 *
 * ## Lo que decide el orden
 *
 * Tres cosas, y en este orden, que es como se piensa una melodía y no como se
 * clasifica una escala:
 *
 * 1. **Qué acorde suena debajo.** Una nota del acorde cae de pie: suena bien la
 *    toques cuando la toques, y por eso son las que se ofrecen primero. Las
 *    demás de la escala funcionan de paso, y piden seguir andando.
 * 2. **De dónde vienes.** Después de una nota, lo más fácil de cantar —y lo que
 *    más suena a melodía y no a ejercicio— es la de al lado. Un salto grande se
 *    ofrece, pero detrás.
 * 3. **Si está en la escala.** Lo de fuera va al final y dicho: una nota
 *    cromática entre dos de la escala es medio idioma del blues, y esconderla
 *    sería mentir sobre lo que se puede tocar.
 *
 * ## Lo que no hace
 *
 * No compone. No sabe de frases, ni de tensión y reposo a lo largo de ocho
 * compases, ni de dónde tiene que respirar una melodía. Dice qué cabe en el
 * hueco siguiente, que es una pregunta mucho más pequeña y la única que se puede
 * contestar sin inventarse nada.
 *
 * Dominio puro.
 */

import type { KeyMode } from './keys';
import { MAX_OFFSET, MIN_OFFSET } from './melody';
import { normalizePitchClass, noteName, type Accidental, type PitchClass } from './notes';
import { resolveDegree, type DegreeSymbol } from './progressions';
import { accidentalForScale, scaleNotes, type ScaleId } from './scales';

/** El papel de una nota sobre el acorde que suena debajo. */
export type NoteRole = 'acorde' | 'escala' | 'fuera';

export interface NoteSuggestion {
  /** Semitonos sobre la tónica de la canción, con su octava ya elegida. */
  readonly offset: number;
  /** Cómo se llama, escrita según la escala. */
  readonly name: string;
  readonly role: NoteRole;
  /** Qué hace, en una frase que se lee tocando. */
  readonly why: string;
}

export interface NextNotesOptions {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly scaleId: ScaleId;
  /** El acorde que suena donde va a caer la nota. Sin él solo manda la escala. */
  readonly chord: DegreeSymbol | null;
  /** La última nota escrita, para preferir lo que está al lado. */
  readonly from: number | null;
  readonly limit?: number;
}

/**
 * A qué distancia deja de ser «la de al lado».
 *
 * Dos semitonos es el grado conjunto: la segunda, que es el paso natural de una
 * melodía. Hasta cuatro sigue siendo un salto cómodo —la tercera, que es de lo
 * que están hechos casi todos los arpegios—. Más allá es un salto de verdad y se
 * ofrece detrás.
 */
const PASO = 2;
const SALTO_COMODO = 4;

/**
 * La octava en la que se coloca una nota cuando no hay de dónde venir.
 *
 * Cero es la tónica en la octava del punteo. Con el lienzo vacío es donde
 * empieza cualquiera, y desde ahí las demás se colocan cerca.
 */
const SIN_REFERENCIA = 0;

/**
 * Coloca una clase de altura en la octava más cercana a la referencia.
 *
 * Es lo que convierte «un Mi» en «este Mi»: sin esto, ofrecer una nota daría
 * saltos de octava según de dónde saliera el número, y una melodía escrita así
 * no se puede cantar.
 */
export function nearestOffset(pitchClass: PitchClass, tonic: PitchClass, from: number): number {
  const base: number = normalizePitchClass(pitchClass - tonic);
  let mejor = base;
  let distancia = Infinity;

  // Se prueban las octavas que caben en el rango escribible y se elige la que
  // menos se aleja. Empatadas, gana la de arriba: subir se canta mejor.
  for (let offset = base - 24; offset <= base + 24; offset += 12) {
    if (offset < MIN_OFFSET || offset > MAX_OFFSET) {
      continue;
    }
    const suya = Math.abs(offset - from);
    if (suya < distancia) {
      distancia = suya;
      mejor = offset;
    }
  }
  return mejor;
}

function porQue(role: NoteRole, distancia: number, chord: DegreeSymbol | null): string {
  if (role === 'acorde') {
    return distancia <= PASO
      ? 'Del acorde y aquí al lado: cae de pie y se canta sola.'
      : `Es del acorde${chord === null ? '' : ` de ${chord}`}: suene cuando suene, encaja.`;
  }
  if (role === 'escala') {
    return distancia <= PASO
      ? 'Un paso desde donde estás. Es el movimiento más natural que hay.'
      : 'De la escala: entra, pero pide seguir andando.';
  }
  return 'De fuera de la escala. Roza y sigue: si te paras en ella, se nota.';
}

/**
 * Las notas que pueden ir después, de más a menos segura.
 *
 * Sin acorde debajo solo manda la escala, que es lo que hay antes del primer
 * compás. Sin nota anterior se colocan alrededor de la tónica, que es de donde
 * empieza cualquiera.
 */
export function nextNotes(options: NextNotesOptions): NoteSuggestion[] {
  const { tonic, mode, scaleId, chord, from, limit = 7 } = options;
  const desde = from ?? SIN_REFERENCIA;
  const accidental: Accidental = accidentalForScale(tonic, scaleId);

  const deLaEscala = new Set(scaleNotes(tonic, scaleId));
  const delAcorde = new Set(chord === null ? [] : resolveDegree(tonic, mode, chord).notes);

  const candidatas: (NoteSuggestion & { readonly orden: number })[] = [];

  for (let pitch = 0; pitch < 12; pitch += 1) {
    const pitchClass = normalizePitchClass(pitch);
    const offset = nearestOffset(pitchClass, tonic, desde);

    // La que ya está sonando no es una sugerencia: repetir una nota es una
    // decisión, no una propuesta, y ocuparía el primer sitio de la lista.
    if (offset === from) {
      continue;
    }

    const role: NoteRole = delAcorde.has(pitchClass)
      ? 'acorde'
      : deLaEscala.has(pitchClass)
        ? 'escala'
        : 'fuera';
    const distancia = Math.abs(offset - desde);

    // El orden es el que decide todo, y sale de las tres cosas del encabezado:
    // primero el papel sobre el acorde, dentro de eso lo que está al lado, y al
    // final lo de fuera de la escala.
    const porPapel = role === 'acorde' ? 0 : role === 'escala' ? 100 : 400;
    const porCercania = distancia <= PASO ? 0 : distancia <= SALTO_COMODO ? 10 : 20 + distancia;

    candidatas.push({
      offset,
      name: noteName(pitchClass, accidental),
      role,
      why: porQue(role, distancia, chord),
      orden: porPapel + porCercania,
    });
  }

  // El orden se usa para ordenar y no sale: es un criterio, no algo que la
  // sugerencia sea. Es la misma separación que ya hace `suggestions.ts` con el
  // rango de los acordes.
  return candidatas
    .sort((a, b) => a.orden - b.orden)
    .slice(0, limit)
    .map((candidata) => ({
      offset: candidata.offset,
      name: candidata.name,
      role: candidata.role,
      why: candidata.why,
    }));
}
