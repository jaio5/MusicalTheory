/**
 * Con qué especie suena cada acorde nuevo, y los pasos con que se escribe.
 *
 * Una séptima en un jazz, la quinta en un riff, sin sensible en el modal: lo nuevo
 * hereda lo que ya hacía lo tuyo, y aquí se decide una vez para todos los caminos.
 */
import { seventhNotes, type EspecieDeBloque, type SeventhQuality } from '../chords';
import { roleOfDegreeSymbol } from '../harmonic-function';
import type { KeyMode } from '../keys';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import type { Idioma } from './idioma';
import { especieDelMovimiento, type MoveId } from './movimientos';
import type { PasoPosible, PathStep } from './tipos';
import { deDominantes } from './valor';

/** Las séptimas de cada grado, las que pide un jazz: la cuatríada de la escala. */
const SEPTIMAS: Readonly<Record<KeyMode, Readonly<Record<string, SeventhQuality>>>> = {
  major: {
    I: 'major7',
    ii: 'minor7',
    iii: 'minor7',
    IV: 'major7',
    V: 'dominant7',
    vi: 'minor7',
    'vii°': 'halfDiminished7',
    bII: 'dominant7',
    bIII: 'major7',
    iv: 'minor7',
    bVI: 'major7',
    bVII: 'dominant7',
  },
  minor: {
    i: 'minor7',
    'ii°': 'halfDiminished7',
    bII: 'dominant7',
    III: 'major7',
    iv: 'minor7',
    v: 'minor7',
    V: 'dominant7',
    VI: 'major7',
    VII: 'dominant7',
  },
};

/** Las del blues: todo dominante en los tres de siempre, aunque la teoría diga que no. */
const SEPTIMAS_DEL_BLUES: Readonly<Record<KeyMode, Readonly<Record<string, SeventhQuality>>>> = {
  // El ii del blues de jazz va con su séptima menor, y el bVI7 que baja al V, con la
  // de dominante: una tríada en medio de un coro de séptimas suena a otro grupo.
  major: {
    I: 'dominant7',
    ii: 'minor7',
    IV: 'dominant7',
    V: 'dominant7',
    bVI: 'dominant7',
    bVII: 'dominant7',
  },
  minor: { i: 'minor7', 'ii°': 'halfDiminished7', iv: 'minor7', V: 'dominant7', VI: 'dominant7' },
};

/**
 * La especie de un acorde que pone la salida, **según lo que es el acorde que
 * entra** y nunca según el que se va.
 *
 * Antes heredaba la séptima del compás que sustituía: una tónica final que entraba
 * donde había un V7 salía `i(m7)`, y un VII donde había un V7, `VII7`. Lo que se va
 * no dice nada de lo que entra. El orden:
 *
 * 1. **Quintas si tu canción va en quintas**: es la textura, no una función, y una
 *    tríada en medio de un riff de quintas suena a otro grupo. Lo que solo es lo que
 *    es con séptima —el sustituto tritonal, la dominante secundaria— no se construye
 *    en ese idioma (`precioDelGrado`, `rearmonizaciones`).
 * 2. **La que pide el movimiento**: el sustituto tritonal, la dominante que se pone
 *    delante y la dominante secundaria son dominantes con su séptima.
 * 3. **La del mismo grado en tu canción**: si tocas el V7, el V nuevo es V7; si
 *    tocas la i sin séptima, la i nueva también. Antes lo nuevo no miraba esto y un
 *    bolero que tocaba V7 recibía un V pelado.
 * 4. **La del estilo y la de tu idioma**: en un blues, todo con séptima —las de la
 *    casa del blues, y las de la escala para lo demás—, **y lo mismo si tu tónica o
 *    tu subdominante ya suenan con séptima de dominante** (`Idioma.dominantes`): un
 *    funk en I7 que recibía un IVmaj7 sonaba a otra canción. Si tocas cuatríadas,
 *    la cuatríada de la escala. Sin nada de eso, la tríada.
 */
export function especieNueva(
  id: Idioma,
  degree: DegreeSymbol,
  move: MoveId | null,
): EspecieDeBloque | null {
  if (id.lenguaje === 'quintas') {
    return 'quinta';
  }
  const delMovimiento = move === null ? null : especieDelMovimiento(move, degree);
  if (delMovimiento !== null || degree.includes('/')) {
    return delMovimiento ?? 'dominant7';
  }
  if (id.especieDelGrado.has(degree)) {
    return id.especieDelGrado.get(degree)!;
  }
  // Lo que sustituye a la tónica lleva la cuatríada de la escala también en un
  // funk o un blues: el VI que hace de i es VImaj7, como en un jazz. Con la de
  // dominante —el VI7 del blues— deja de ser tónica: es el que baja al V.
  const sustituyeALaTonica =
    (move === 'funcion' || move === 'relativo') && roleOfDegreeSymbol(degree) === 'tonic';
  if ((deDominantes(id) || id.dominantes) && !sustituyeALaTonica) {
    // Las del blues —y del funk— para lo de siempre y las de la escala para lo
    // demás: sin la segunda, el iii y el vi salían tríadas en medio de un coro de
    // séptimas.
    return sinSensible(
      id,
      degree,
      SEPTIMAS_DEL_BLUES[id.mode][degree] ?? SEPTIMAS[id.mode][degree]!,
    );
  }
  // Todo grado del modo que no es una dominante secundaria tiene su cuatríada.
  return id.lenguaje === 'septimas' || (sustituyeALaTonica && (deDominantes(id) || id.dominantes))
    ? sinSensible(id, degree, SEPTIMAS[id.mode][degree]!)
    : null;
}

/**
 * La cuatríada de la escala, **sin la sensible si tu canción no la quiere**.
 *
 * Las de `SEPTIMAS` son las del mayor y el menor de manual, y el Imaj7 lleva la
 * sensible dentro: en un riff mixolidio, que eligió el bVII para no tenerla, la
 * metía por la puerta de atrás. Ahí el I es I7, que es el mixolidio; y lo demás que
 * la traiga sin tenerla en su tríada se queda en tríada.
 */
function sinSensible(
  id: Idioma,
  degree: DegreeSymbol,
  septima: SeventhQuality,
): EspecieDeBloque | null {
  if (id.modales.length === 0) {
    return septima;
  }
  const acorde = resolveDegree(0, id.mode, degree);
  const trae = seventhNotes(acorde.root, septima).includes(11) && !acorde.notes.includes(11);
  if (!trae) {
    return septima;
  }
  return septima === 'major7' && acorde.quality === 'major' ? 'dominant7' : null;
}

/** Un compás nuevo, con la especie que le toca si le toca alguna. */
export function paso(
  degree: DegreeSymbol,
  beats: number,
  move: MoveId | null,
  especie: EspecieDeBloque | null,
): PasoPosible {
  return especie === null ? { degree, beats, move } : { degree, beats, move, especie };
}

/** Un compás tuyo tal cual, con la especie que traía. */
export function tuyo(id: Idioma, original: readonly PathStep[], i: number): PasoPosible {
  return paso(original[i]!.degree, original[i]!.beats, null, id.especies[i] ?? null);
}
