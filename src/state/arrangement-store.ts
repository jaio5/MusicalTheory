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
  addNote,
  addPart,
  EMPTY_ARRANGEMENT,
  findBlock,
  fixBlock,
  keepDegreesOfMode,
  moveBlock,
  moveNote,
  movePart,
  removeBlock,
  removeNote,
  removePart,
  writtenBlock,
  renamePart,
  setPartRole,
  resizeBlock,
  resizeNote,
  setBars,
  type Arrangement,
  type CapturedStep,
  type DegreeSymbol,
  type LeadNote,
  type KeyMode,
  type SectionRole,
} from '@core/music';

import { apuntarHecho } from './hechos-de-componer';

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
  /** Dice qué papel hace la parte. Ajusta el nombre si lo puso la aplicación. */
  setPartRole(partId: string, role: SectionRole): void;
  movePart(partId: string, to: number): void;
  /** Alarga o acorta una parte, en compases. Nunca por debajo de lo que hay. */
  setBars(partId: string, bars: number, beatsPerBar: number): void;

  /** Un bloque al final de esa parte, o en `at` si se dice. */
  addBlock(partId: string, degree: DegreeSymbol, beats: number, at?: number | null): string;
  removeBlock(blockId: string): void;
  /** Cambia el acorde de un bloque y lo da por bueno: es la corrección. */
  fixBlock(blockId: string, degree: DegreeSymbol): void;
  /** Deja el acorde como está y deja de preguntar por él. */
  confirmBlock(blockId: string): void;
  resizeBlock(blockId: string, beats: number): void;
  moveBlock(blockId: string, toPartId: string, to: number): void;

  /** Una nota del punteo, y devuelve su identificador. */
  addNote(partId: string, offset: number, start: number, length: number): string;
  removeNote(noteId: string): void;
  /** Otro momento, otra altura, o las dos: arrastrando es un solo gesto. */
  moveNote(noteId: string, start: number, offset: number): void;
  resizeNote(noteId: string, length: number): void;

  /**
   * Mete de una vez lo que se acaba de grabar: los acordes y el punteo.
   *
   * Una sola entrada en el deshacer para toda la grabación, acordes y notas
   * juntos: quien acaba de tocar ocho compases quiere quitarlos de una vez.
   */
  addRecorded(steps: readonly CapturedStep[], name: string, notes?: readonly LeadNote[]): string;

  /** Abre un montaje entero: al cargar una canción, o al deshacerlo todo. */
  replace(arrangement: Arrangement): void;
  /** Deja fuera los grados que ese modo no tiene. Lo llama el cambio de rueda. */
  keepMode(mode: KeyMode): void;

  /**
   * Un arrastre entero cuenta como un paso atrás.
   *
   * Sin esto, soltar una nota después de moverla veinte píxeles deja veinte
   * entradas en el deshacer y hacen falta veinte pulsaciones para volver.
   * Se abre al empezar el gesto y se cierra al soltar.
   */
  beginGesture(): void;
  endGesture(): void;

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
   * Si hay un arrastre en marcha, y si ya se guardó su punto de partida.
   *
   * Van fuera del estado porque no se pintan: que haya un gesto abierto no cambia
   * nada de lo que se ve, y meterlo en el store repintaría la pantalla entera dos
   * veces por arrastre.
   */
  let enGesto = false;
  let yaApilado = false;

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
    // Dentro de un gesto solo se apila la primera vez: lo que se deshace es el
    // arrastre entero, no cada píxel por el que pasó el puntero.
    const apilar = !enGesto || !yaApilado;
    yaApilado = true;
    set({
      arrangement: siguiente,
      past: apilar ? [arrangement, ...past].slice(0, MAX_UNDO) : past,
    });
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
      setPartRole(partId, role) {
        cambiar((actual) => setPartRole(actual, partId, role));
        // Decir qué es lo que acabas de tocar cuenta como practicar: es la
        // decisión que convierte cuatro compases en una parte de una canción, y
        // es el dato con el que la IA sabe qué le estás pidiendo.
        apuntarHecho('parte');
      },
      movePart(partId, to) {
        cambiar((actual) => movePart(actual, partId, to));
      },
      setBars(partId, bars, beatsPerBar) {
        cambiar((actual) => setBars(actual, partId, bars, beatsPerBar));
      },

      addBlock(partId, degree, beats, at = null) {
        const id = nuevoId('bloque');
        cambiar((actual) => addBlock(actual, partId, writtenBlock(id, degree, beats), at));
        return id;
      },
      removeBlock(blockId) {
        cambiar((actual) => removeBlock(actual, blockId));
      },
      fixBlock(blockId, degree) {
        cambiar((actual) => fixBlock(actual, blockId, degree));
      },
      confirmBlock(blockId) {
        const actual = findBlock(get().arrangement, blockId);
        if (actual !== null) {
          cambiar((montaje) => fixBlock(montaje, blockId, actual.block.degree, true));
        }
      },
      resizeBlock(blockId, beats) {
        cambiar((actual) => resizeBlock(actual, blockId, beats));
      },
      moveBlock(blockId, toPartId, to) {
        cambiar((actual) => moveBlock(actual, blockId, toPartId, to));
      },

      addNote(partId, offset, start, length) {
        const id = nuevoId('nota');
        const note: LeadNote = { id, offset, start, length };
        cambiar((actual) => addNote(actual, partId, note));
        return id;
      },
      removeNote(noteId) {
        cambiar((actual) => removeNote(actual, noteId));
      },
      moveNote(noteId, start, offset) {
        cambiar((actual) => moveNote(actual, noteId, start, offset));
      },
      resizeNote(noteId, length) {
        cambiar((actual) => resizeNote(actual, noteId, length));
      },

      addRecorded(steps, name, notes = []) {
        const partId = nuevoId('parte');
        cambiar((actual) => {
          // Una sola entrada en el deshacer para toda la grabación: quien acaba
          // de tocar ocho compases quiere quitarlos de una vez, no uno a uno.
          let siguiente = addPart(actual, partId, name);
          for (const step of steps) {
            // Oído, con la duda que traía: es lo que permite marcar en el
            // lienzo los compases de los que el motor no estaba seguro.
            siguiente = addBlock(siguiente, partId, {
              id: nuevoId('bloque'),
              degree: step.degree,
              beats: step.beats,
              source: 'heard',
              confidence: step.confidence,
              alternatives: step.alternatives,
            });
          }
          for (const note of notes) {
            siguiente = addNote(siguiente, partId, { ...note, id: nuevoId('nota') });
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

      beginGesture() {
        enGesto = true;
        yaApilado = false;
      },
      endGesture() {
        enGesto = false;
        yaApilado = false;
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
