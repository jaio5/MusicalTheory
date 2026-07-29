/**
 * Qué papel hace cada acorde en la tonalidad.
 *
 * Es la pieza que convierte una lista de acordes en algo que se puede aprender.
 * Sin ella, «Am» y «F» son dos nombres; con ella, uno es reposo y el otro
 * empuja, y se entiende por qué se pueden cambiar por otros.
 *
 * Tres papeles y uno de paso. Los tres primeros son la armonía funcional de
 * toda la vida —reposo, salida, tensión— y el cuarto está para los acordes
 * cromáticos que no hacen ninguno de los tres: solo llevan de un sitio a otro.
 *
 * La sustitución sale de aquí y no de una tabla aparte: dos acordes con el
 * mismo papel se pueden cambiar el uno por el otro, y los que van a tercera de
 * distancia comparten además dos de sus tres notas. Eso es todo el truco.
 */

import type { KeyMode } from './keys';

export type HarmonicRole = 'tonic' | 'subdominant' | 'dominant' | 'approach';

export interface HarmonicRoleInfo {
  readonly id: HarmonicRole;
  /** Cómo se llama. */
  readonly name: string;
  /** Una letra para las etiquetas apretadas: T, S, D. */
  readonly short: string;
  /** Qué hace, en una frase que se lee tocando. */
  readonly what: string;
  /** Adónde suele ir después. */
  readonly goes: string;
}

export const HARMONIC_ROLES: Readonly<Record<HarmonicRole, HarmonicRoleInfo>> = {
  tonic: {
    id: 'tonic',
    name: 'Tónica',
    short: 'T',
    what: 'Reposo. Es donde la frase suena terminada.',
    goes: 'Puede ir a cualquier sitio: es la casa de la que se sale.',
  },
  subdominant: {
    id: 'subdominant',
    name: 'Subdominante',
    short: 'S',
    what: 'La salida. Se ha ido de casa pero todavía no hay tensión.',
    goes: 'Casi siempre a la dominante, o de vuelta a la tónica.',
  },
  dominant: {
    id: 'dominant',
    name: 'Dominante',
    short: 'D',
    what: 'Tensión. Contiene el tritono y pide resolver.',
    goes: 'A la tónica. Llevarla a otro sitio es el recurso, no la norma.',
  },
  approach: {
    id: 'approach',
    name: 'De paso',
    short: '→',
    what: 'No reposa ni resuelve: une dos acordes por el camino más corto.',
    goes: 'Al acorde que tiene medio tono al lado.',
  },
};

/**
 * El papel de cada grado, por su posición en la escala.
 *
 * En mayor los tres de tónica son I, iii y vi; los de subdominante, ii y IV; y
 * los de dominante, V y vii°. Es la agrupación clásica y se sostiene sola en
 * cuanto se miran las notas: I y vi comparten dos, IV y ii comparten dos, V y
 * vii° comparten dos.
 */
const MAJOR_ROLES: readonly HarmonicRole[] = [
  'tonic',
  'subdominant',
  'tonic',
  'subdominant',
  'dominant',
  'tonic',
  'dominant',
];

/**
 * En menor natural la única discutible es la séptima.
 *
 * El VII de la menor natural no es una dominante de manual: no tiene sensible,
 * así que no aprieta como un V. Pero en el idioma modal —que es el que toca
 * quien coge una guitarra eléctrica— VII va a i constantemente y hace de
 * cadencia. Se marca como dominante y el texto avisa de que llega sin sensible,
 * que es justo lo que la distingue.
 */
const MINOR_ROLES: readonly HarmonicRole[] = [
  'tonic',
  'subdominant',
  'tonic',
  'subdominant',
  'dominant',
  'tonic',
  'dominant',
];

export function roleOfDegree(mode: KeyMode, degree: number): HarmonicRole {
  const roles = mode === 'major' ? MAJOR_ROLES : MINOR_ROLES;
  return roles[degree] ?? 'approach';
}

/**
 * En qué orden se enseñan los grados.
 *
 * Primero los tres tonales —I, IV y V—, que son los que sostienen una canción
 * entera y con los que se empieza siempre. Después los modales, que son los que
 * le dan el color al modo sin cambiar de sitio. El disminuido, el último: es el
 * que menos se usa suelto y el que más asusta de ver.
 */
const MAJOR_TEACHING_ORDER = [0, 3, 4, 5, 1, 2, 6];
const MINOR_TEACHING_ORDER = [0, 3, 4, 6, 5, 2, 1];

/** Cuanto más bajo, antes se enseña. Los grados de fuera van detrás de todos. */
export function teachingRank(mode: KeyMode, degree: number): number {
  const order = mode === 'major' ? MAJOR_TEACHING_ORDER : MINOR_TEACHING_ORDER;
  const rank = order.indexOf(degree);
  return rank === -1 ? order.length : rank;
}

/**
 * A qué grado puede sustituir, y por qué.
 *
 * Solo se declara cuando la sustitución es de las que se enseñan el primer día:
 * los grados a tercera de distancia con el mismo papel, que comparten dos de
 * sus tres notas. Un acorde que no sustituye a nada devuelve null, y es
 * preferible callar a inventarse un parentesco.
 */
export interface Substitution {
  /** El grado al que puede reemplazar, en números romanos. */
  readonly of: string;
  readonly why: string;
}

const MAJOR_SUBSTITUTIONS: Readonly<Record<number, Substitution>> = {
  2: { of: 'I', why: 'Comparte dos de sus tres notas con el I y hace el mismo papel de reposo.' },
  5: { of: 'I', why: 'Es el relativo menor: las mismas dos notas que el I y el mismo reposo.' },
  1: { of: 'IV', why: 'Es el relativo menor del IV: mismas dos notas y misma salida.' },
  6: { of: 'V', why: 'Lleva el tritono del V dentro. Es la misma tensión sin la fundamental.' },
};

const MINOR_SUBSTITUTIONS: Readonly<Record<number, Substitution>> = {
  2: { of: 'i', why: 'Es el relativo mayor: comparte dos notas con el i y reposa igual.' },
  5: { of: 'iv', why: 'Comparte dos notas con el iv y hace la misma salida.' },
  1: { of: 'iv', why: 'Comparte dos notas con el iv y empuja hacia la dominante igual que él.' },
};

export function substitutionOfDegree(mode: KeyMode, degree: number): Substitution | null {
  const table = mode === 'major' ? MAJOR_SUBSTITUTIONS : MINOR_SUBSTITUTIONS;
  return table[degree] ?? null;
}
