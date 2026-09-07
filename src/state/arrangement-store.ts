/**
 * El montaje que hay en el lienzo, y el deshacer.
 *
 * Vive aparte de `session-store` a propósito. Aquel es «lo que está pasando
 * mientras alguien toca» —lo que suena, lo que se oye, el tono detectado— y se
 * borra al recargar sin que nadie lo eche de menos. Un montaje es trabajo: media
 * hora colocando bloques. Mezclarlos habría hecho que `reset()`, que existe para
 * empezar una sesión limpia, se llevara la canción por delante.
 *
 * La tonalidad no está aquí, sino en `session-store`: un montaje son grados
 * —[core/music/arrangement.ts]— y el tono con el que suenan lo pone la rueda. Es
 * lo que hace que cambiar de tonalidad no toque un solo bloque.
 *
 * **El deshacer es una pila de montajes enteros**, no de operaciones inversas.
 * Un montaje son unos cientos de bytes y todas las funciones del dominio
 * devuelven uno nuevo, así que guardar el anterior es gratis y no puede
 * descuadrarse; escribir la inversa de cada gesto sí, y el gesto que peor se
 * deshace —arrastrar entre partes— es justo el más frecuente.
 */

import { create } from 'zustand';

import {
  addBlock,
  addPart,
  clampBeats,
  EMPTY_ARRANGEMENT,
  keepDegreesOfMode,
  moveBlock,
  movePart,
  removeBlock,
  removePart,
  renamePart,
  resizeBlock,
  type Arrangement,
  type Block,
  type DegreeSymbol,
  type KeyMode,
} from '@core/music';

/**
 * Cuántos pasos atrás se guardan.
 *
 * Veinte es lo que cabe en un rato de montaje sin que la pila crezca sola. Más
 * atrás nadie se acuerda de qué había.
 */
export const MAX_UNDO = 20;

export interface ArrangementActions {
  /** Una parte nueva al final, y devuelve su identificador. */
  addPart(name?: string): string;
  removePart(partId: string): void;
  renamePart(partId: string, name: string): void;
  movePart(partId: string, to: number): void;

  /** Un bloque al final de esa parte, o en `at` si se dice. */
  addBlock(partId: string, degree: DegreeSymbol, beats: number, at?: number | null): string;
  removeBlock(blockId: string): void;
  resizeBlock(blockId: string, beats: number): void;
  moveBlock(blockId: string, toPartId: string, to: number): void;

  /** Mete de una vez lo que se acaba de grabar, con sus duraciones. */
  addRecorded(steps: readonly { degree: DegreeSymbol; beats: number }[], name: string): string;

  /** Abre un montaje entero: al cargar una canción, o al deshacerlo todo. */
  replace(arrangement: Arrangement): void;
  /** Deja fuera los grados que ese modo no tiene. Lo llama el cambio de rueda. */
  keepMode(mode: KeyMode): void;

  undo(): void;
  clear(): void;
}

export interface ArrangementState {
  readonly arrangement: Arrangement;
  /** Montajes anteriores, el último primero. */
  readonly past: readonly Arrangement[];
  readonly actions: ArrangementActions;
}

/**
 * Un identificador único para un bloque o una parte.
 *
 * `crypto.randomUUID` no está en todas partes —hace falta contexto seguro, y en
 * `http://` de una red local no lo hay—, así que hay respaldo. No se usa para
 * nada que dependa de que sea impredecible: solo tiene que no repetirse dentro
 * de un montaje.
 */
let contador = 0;
export function nuevoId(prefijo: string): string {
  contador += 1;
  const azar =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${azar}-${contador}`;
}

export const useArrangementStore = create<ArrangementState>((set, get) => {
  /**
   * Aplica un cambio guardando lo que había.
   *
   * Si el cambio no cambia nada —soltar un bloque donde ya estaba, estirar hasta
   * un ancho que ya tenía, cambiar de modo sin perder ningún grado— no se apunta
   * en el deshacer. La comparación es por referencia y basta con eso porque el
   * dominio lo garantiza: `arrangement.ts` devuelve el mismo montaje cuando no
   * hay nada que cambiar.
   */
  function cambiar(cambio: (actual: Arrangement) => Arrangement): void {
    const { arrangement, past } = get();
    const siguiente = cambio(arrangement);
    if (siguiente === arrangement) {
      return;
    }
    set({ arrangement: siguiente, past: [arrangement, ...past].slice(0, MAX_UNDO) });
  }

  return {
    arrangement: EMPTY_ARRANGEMENT,
    past: [],
    actions: {
      addPart(name) {
        const id = nuevoId('parte');
        cambiar((actual) => addPart(actual, id, name));
        return id;
      },
      removePart(partId) {
        cambiar((actual) => removePart(actual, partId));
      },
      renamePart(partId, name) {
        cambiar((actual) => renamePart(actual, partId, name));
      },
      movePart(partId, to) {
        cambiar((actual) => movePart(actual, partId, to));
      },

      addBlock(partId, degree, beats, at = null) {
        const id = nuevoId('bloque');
        const block: Block = { id, degree, beats: clampBeats(beats) };
        cambiar((actual) => addBlock(actual, partId, block, at));
        return id;
      },
      removeBlock(blockId) {
        cambiar((actual) => removeBlock(actual, blockId));
      },
      resizeBlock(blockId, beats) {
        cambiar((actual) => resizeBlock(actual, blockId, beats));
      },
      moveBlock(blockId, toPartId, to) {
        cambiar((actual) => moveBlock(actual, blockId, toPartId, to));
      },

      addRecorded(steps, name) {
        const partId = nuevoId('parte');
        cambiar((actual) => {
          // Una sola entrada en el deshacer para toda la grabación: quien acaba
          // de tocar ocho compases quiere quitarlos de una vez, no uno a uno.
          let siguiente = addPart(actual, partId, name);
          for (const step of steps) {
            siguiente = addBlock(siguiente, partId, {
              id: nuevoId('bloque'),
              degree: step.degree,
              beats: step.beats,
            });
          }
          return siguiente;
        });
        return partId;
      },

      replace(arrangement) {
        cambiar(() => arrangement);
      },
      keepMode(mode) {
        cambiar((actual) => keepDegreesOfMode(actual, mode));
      },

      undo() {
        const { past } = get();
        const [anterior, ...resto] = past;
        if (anterior === undefined) {
          return;
        }
        set({ arrangement: anterior, past: resto });
      },
      clear() {
        cambiar(() => EMPTY_ARRANGEMENT);
      },
    },
  };
});

/** Si hay algo que deshacer, para no dejar el botón encendido sin nada detrás. */
export function selectCanUndo(state: ArrangementState): boolean {
  return state.past.length > 0;
}
