/**
 * La tónica del modo, que es donde cierra una canción.
 *
 * Estaba escrita cinco veces —quien valida, el juez, las formas, lo que dice una
 * salida y los movimientos—, dos con el mayor primero y tres con el menor, y
 * hacían lo mismo porque solo hay dos modos.
 */
import type { KeyMode } from '../keys';
import type { DegreeSymbol } from '../progressions';

export function tonicaDe(mode: KeyMode): DegreeSymbol {
  return mode === 'minor' ? 'i' : 'I';
}
