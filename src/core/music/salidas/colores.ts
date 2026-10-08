/**
 * Los colores de una salida: si oscurece, aclara, tensa o cierra.
 *
 * Son las etiquetas que el menú enseña junto a cada salida, y se sacan de lo que
 * cambió, no de lo que dice el nombre.
 */
import type { EspecieDeBloque } from '../chords';
import type { KeyMode } from '../keys';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import { esPrestado } from './idioma';
import type { Color, PasoPosible, PathStep } from './tipos';
import { tonicaDe } from './tonica';
import { pulsosDe } from './validar';

/**
 * **De dónde viene** el color de un grado: un préstamo del menor —o el napolitano—
 * en mayor, una dominante secundaria o un suspendido que retiene la tercera; nulo si
 * no es color. La misma vara del juez (`colorDe` en `juez/novedad.ts`): un color no se cambia
 * por otro de otra casa.
 */
export function colorDelGrado(
  mode: KeyMode,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
): 'prestado' | 'secundaria' | 'suspendido' | null {
  // En menor el bII es de la casa: lo trae su catálogo (el juez dice lo mismo).
  if (mode === 'major' && esPrestado(mode, degree)) {
    return 'prestado';
  }
  if (degree.includes('/')) {
    return 'secundaria';
  }
  return especie === 'sus2' || especie === 'sus4' ? 'suspendido' : null;
}

/** Un grado de color oscuro: menor, disminuido o prestado del otro modo. */
function oscuro(mode: KeyMode, degree: DegreeSymbol): boolean {
  return degree.startsWith('b') || resolveDegree(0, mode, degree).quality !== 'major';
}

/**
 * Un grado que tensa: la dominante con sensible, el vii° o la dominante de otro.
 * **El bVII no**: llega a casa sin sensible, y llamar «tensión» a un riff
 * mixolidio era el mismo error que darle el papel del V.
 */
function tenso(degree: DegreeSymbol): boolean {
  return degree.includes('/') || degree === 'V' || degree === 'vii°';
}

/**
 * Los colores de una canción frente a la tuya.
 *
 * Solo cuenta lo que **cambia**: un compás nuevo con un grado que no estaba, o
 * uno tuyo que pasa de un color a otro. Que tu canción ya fuera menor no hace
 * triste a una salida que no ha tocado nada de eso.
 */
export function coloresDe(
  mode: KeyMode,
  original: readonly PathStep[],
  cancion: readonly PasoPosible[],
): Color[] {
  const tuyos = new Set(original.map((paso) => paso.degree));
  const cambios = cancion
    .map((paso, i) => ({ paso, antes: original[i]?.degree ?? null }))
    .filter(({ paso, antes }) => antes !== paso.degree);
  const llega = (
    degree: DegreeSymbol,
    antes: DegreeSymbol | null,
    es: (d: DegreeSymbol) => boolean,
  ) => es(degree) && (antes === null ? !tuyos.has(degree) : !es(antes));

  const colores: Color[] = [];
  if (cambios.some(({ paso, antes }) => llega(paso.degree, antes, (d) => oscuro(mode, d)))) {
    colores.push('oscurece');
  }
  if (cambios.some(({ paso, antes }) => llega(paso.degree, antes, (d) => !oscuro(mode, d)))) {
    colores.push('aclara');
  }
  if (
    cambios.some(({ paso, antes }) => paso.move === 'tritono' || llega(paso.degree, antes, tenso))
  ) {
    colores.push('tension');
  }
  if (
    mode === 'major' &&
    cambios.some(({ paso }) => esPrestado(mode, paso.degree) && !tuyos.has(paso.degree))
  ) {
    colores.push('prestado');
  }
  colores.push(cancion[cancion.length - 1]!.degree === tonicaDe(mode) ? 'cierra' : 'abierto');
  // Lo que dura solo se cuenta al retocar: al continuar todo alarga, y decir «más
  // lento» de cada salida sería no decir nada.
  if (cancion.length === original.length) {
    const antes = pulsosDe(original);
    const ahora = pulsosDe(cancion);
    if (ahora !== antes) {
      colores.push(ahora > antes ? 'mas-lento' : 'mas-rapido');
    }
  } else if (cancion.length < original.length) {
    colores.push('mas-corto');
  }
  return colores;
}
