/**
 * Los movimientos con los que se rearmoniza, y cómo se comprueba que un acorde
 * propuesto es de verdad el que dice ser.
 *
 * Esto es lo que hace que las versiones de una canción no sean lo que se le
 * ocurra a un modelo: el modelo propone un grado y **dice qué movimiento ha
 * aplicado**, y aquí se aplica ese mismo movimiento al grado de partida y se
 * comparan. Si no coincide, esa versión se cae. Es la misma regla que ya sigue
 * `/api/ideas` con los cifrados —no se creen, se recalculan—, llevada del cifrado
 * al razonamiento.
 *
 * **No hay una tabla de sustituciones escrita a mano.** Cada movimiento es una
 * función que se apoya en el catálogo de grados que ya existe: se pregunta a
 * `resolveDegree` cuántos semitonos y qué especie es un grado, se le hace la
 * transformación y se busca con `degreeOfChord` qué grado ha salido. Así, un
 * grado nuevo en el catálogo entra solo en todos los movimientos, y no puede
 * pasar que la tabla diga una cosa y el catálogo otra.
 *
 * Lo que un movimiento no puede hacer devuelve nulo, y callar es mejor que
 * inventarse un parentesco: `substitutionsFor` solo enseña lo que se sostiene.
 */

import type { ChordQuality } from './chords';
import type { KeyMode } from './keys';
import { normalizePitchClass, type PitchClass } from './notes';
import { degreeOfChord, resolveDegree, type DegreeSymbol } from './progressions';

export type MoveId = 'relativo' | 'tritono' | 'prestamo' | 'interrumpida' | 'intercambio';

export interface Move {
  readonly id: MoveId;
  /** Cómo se llama, para el rótulo. */
  readonly name: string;
  /** Qué hace y por qué funciona, en una frase de músico. */
  readonly why: string;
}

/** Los semitonos y la especie de un grado, preguntados al catálogo. */
function shapeOf(
  mode: KeyMode,
  degree: DegreeSymbol,
): { offset: PitchClass; quality: ChordQuality } | null {
  try {
    // Con tónica en cero, la fundamental que sale **es** el desplazamiento.
    const chord = resolveDegree(0, mode, degree);
    return { offset: chord.root, quality: chord.quality };
  } catch {
    // El grado no existe en ese modo. Es lo que pasa al aplicar un movimiento de
    // mayor a una canción menor, y no es un error: es que ahí no se puede.
    return null;
  }
}

/** El grado que corresponde a esos semitonos y esa especie, o nulo si no hay. */
function degreeAt(mode: KeyMode, offset: number, quality: ChordQuality): DegreeSymbol | null {
  // Sin dominantes secundarias: aquí se pregunta en qué grado diatónico o
  // prestado se convierte un acorde, y una dominante secundaria no es ninguna de
  // las dos cosas.
  return degreeOfChord(0, mode, normalizePitchClass(offset), quality, false);
}

/** La especie contraria, que es lo que distingue un relativo de un traslado. */
function opuesta(quality: ChordQuality): ChordQuality | null {
  if (quality === 'major') {
    return 'minor';
  }
  return quality === 'minor' ? 'major' : null;
}

/**
 * El relativo de un grado: la tercera de distancia que comparte dos notas.
 *
 * Un acorde mayor tiene su relativo menor tres semitonos por debajo —C y Am— y
 * uno menor, su relativo mayor tres por encima. Los disminuidos y aumentados no
 * tienen relativo, y ahí se devuelve nulo en vez de forzar uno.
 */
function relativo(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  if (shape === null) {
    return null;
  }
  const destino = opuesta(shape.quality);
  if (destino === null) {
    return null;
  }
  const salto = shape.quality === 'major' ? -3 : 3;
  return degreeAt(mode, shape.offset + salto, destino);
}

/**
 * La sustitución tritonal: cambiar una dominante por la que está a un tritono.
 *
 * Las dos comparten el tritono que aprieta —la tercera de una es la séptima de
 * la otra—, así que la tensión es la misma y el bajo baja por semitonos en vez
 * de saltar una cuarta. Solo se le hace a un acorde mayor: es la especie que
 * lleva el tritono con la séptima, y aplicárselo a un menor no significa nada.
 */
function tritono(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  if (shape === null || shape.quality !== 'major') {
    return null;
  }
  const destino = degreeAt(mode, shape.offset + 6, 'major');
  // El tritono de un grado consigo mismo no es una sustitución. Pasa cuando el
  // catálogo solo tiene uno de los dos lados.
  return destino === degree ? null : destino;
}

/**
 * El préstamo modal: el mismo grado, traído de la tonalidad paralela.
 *
 * Bajar la fundamental un semitono y volverla mayor es exactamente lo que se ve
 * al mirar iii, vi y vii° desde la menor de la misma tónica: salen bIII, bVI y
 * bVII, que es de donde vienen esos tres nombres.
 *
 * **Solo existe en mayor, y no por descuido.** El catálogo de menor ya trae
 * dentro los préstamos que se usan de verdad —el V mayor viene del menor
 * armónico y el bII es el napolitano—, así que en menor no queda un grado «de
 * fuera» al que ir: lo que se querría hacer ahí (v por V) es cambiar la especie,
 * y para eso está `intercambio`. Devolver nulo es lo honesto; inventar un
 * destino sería enseñar un parentesco que no existe.
 */
function prestamo(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  if (mode !== 'major' || shape === null) {
    return null;
  }
  const prestado = degreeAt(mode, shape.offset - 1, 'major');
  return prestado === degree ? null : prestado;
}

/**
 * La cadencia interrumpida: la dominante promete la tónica y da su relativo.
 *
 * Se define desde la tónica y no desde una tabla: el destino es el relativo del
 * primer grado, que en mayor es vi y en menor es III. Por eso solo tiene
 * sentido aplicada a un grado que empuja —una dominante—, y a lo demás devuelve
 * nulo.
 */
function interrumpida(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  const tonica: DegreeSymbol = mode === 'major' ? 'I' : 'i';

  // Empuja el que está a una quinta de la tónica, sea mayor o menor.
  if (shape === null || shape.offset !== 7) {
    return null;
  }
  return relativo(mode, tonica);
}

/**
 * El intercambio: el mismo grado con la especie cambiada.
 *
 * Es el más simple y el que más cambia el ánimo sin mover el bajo: la
 * fundamental se queda donde está y la tercera sube o baja un semitono. Devuelve
 * nulo cuando el catálogo no tiene ese grado con la otra especie, que es lo
 * honesto: significa que en esta tonalidad ese acorde no se usa así.
 */
function intercambio(mode: KeyMode, degree: DegreeSymbol): DegreeSymbol | null {
  const shape = shapeOf(mode, degree);
  if (shape === null) {
    return null;
  }
  const destino = opuesta(shape.quality);
  return destino === null ? null : degreeAt(mode, shape.offset, destino);
}

const APLICAR: Readonly<
  Record<MoveId, (mode: KeyMode, degree: DegreeSymbol) => DegreeSymbol | null>
> = {
  relativo,
  tritono,
  prestamo,
  interrumpida,
  intercambio,
};

/**
 * En orden de cuánto se notan, que es el orden en el que se enseñan.
 *
 * El relativo primero porque es el que menos rompe —dos notas de tres siguen
 * ahí— y el tritono el último de los tres fuertes porque es el que más suena a
 * jazz en una canción que no lo era.
 */
export const MOVES: readonly Move[] = [
  {
    id: 'relativo',
    name: 'Su relativo',
    why: 'Comparte dos de sus tres notas y hace el mismo papel: cambia el color sin cambiar la función.',
  },
  {
    id: 'intercambio',
    name: 'Mayor por menor',
    why: 'La fundamental se queda y la tercera se mueve un semitono. Cambia el ánimo sin mover el bajo.',
  },
  {
    id: 'prestamo',
    name: 'Prestado del otro modo',
    why: 'El mismo grado visto desde la tonalidad paralela. Oscurece o aclara sin salir del centro.',
  },
  {
    id: 'interrumpida',
    name: 'Cadencia interrumpida',
    why: 'La dominante promete la tónica y entrega su relativo. Alarga la frase justo cuando iba a cerrar.',
  },
  {
    id: 'tritono',
    name: 'Sustitución tritonal',
    why: 'La dominante a un tritono lleva el mismo tritono dentro: igual de tensa, y el bajo baja por semitonos.',
  },
];

export function moveById(id: unknown): Move | null {
  return MOVES.find((move) => move.id === id) ?? null;
}

/** El grado que sale de aplicar ese movimiento, o nulo si a ese no se le puede. */
export function applyMove(mode: KeyMode, degree: DegreeSymbol, id: unknown): DegreeSymbol | null {
  const aplicar = typeof id === 'string' ? APLICAR[id as MoveId] : undefined;
  return aplicar === undefined ? null : aplicar(mode, degree);
}

/**
 * Si el movimiento que alguien dice haber aplicado es cierto.
 *
 * Es la función que sostiene toda la fase: lo que devuelve el modelo pasa por
 * aquí antes de enseñarse, y una versión que dice «sustitución tritonal» sin
 * serlo se cae en vez de llegar a la pantalla con una explicación falsa.
 */
export function isMove(mode: KeyMode, from: DegreeSymbol, to: DegreeSymbol, id: unknown): boolean {
  return applyMove(mode, from, id) === to;
}

/**
 * Un cambio posible: a qué grado y por qué.
 *
 * Se llama así y no `Substitution` porque ese nombre ya es de
 * `harmonic-function.ts`, donde significa otra cosa —qué grado puede hacer el
 * papel de otro— y tenerlos los dos con el mismo nombre en el índice de `music/`
 * obligaría a mirar de dónde viene cada uno.
 */
export interface Reharmonization {
  readonly to: DegreeSymbol;
  readonly move: Move;
}

/** Todo lo que se puede poner en lugar de ese grado, con lo que lo justifica. */
export function reharmonizationsFor(mode: KeyMode, degree: DegreeSymbol): Reharmonization[] {
  const salidas: Reharmonization[] = [];
  const vistos = new Set<string>();

  for (const move of MOVES) {
    const to = applyMove(mode, degree, move.id);
    // Ni el propio grado ni dos movimientos que llevan al mismo sitio: en la
    // pantalla serían la misma fila dos veces con dos explicaciones distintas.
    if (to === null || to === degree || vistos.has(to)) {
      continue;
    }
    vistos.add(to);
    salidas.push({ to, move });
  }
  return salidas;
}
