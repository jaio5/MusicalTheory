'use client';

import { create } from 'zustand';

import type { DegreeSymbol } from '@core/music';

import { useArrangementStore } from './arrangement-store';
import { useSessionStore } from './session-store';

/**
 * Lo que el copiloto propone, mientras nadie lo ha aceptado.
 *
 * **Vive aquí y no en `core/music/arrangement.ts`**, que es lo que decidió
 * [adr/0033](../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md): una
 * propuesta sin aceptar **no es música todavía**. Si viviera en el montaje
 * sonaría al pulsar «Escuchar la canción», entraría en el guion del ensayo,
 * contaría compases y se guardaría con la canción. Todo eso es exactamente lo
 * que no tiene que pasar.
 *
 * Y por eso tampoco pasa por el deshacer: no hay nada que deshacer hasta que
 * alguien dice que sí. Lo que sí pasa por el deshacer es **aceptarla**, porque
 * eso ya escribe bloques.
 *
 * Hay **una sola propuesta a la vez**, y pedir otra tira la anterior. Dos listas
 * de fantasmas en dos partes distintas serían dos sitios donde mirar para una
 * decisión que es una: esto o nada.
 */

export interface Propuesta {
  /** En qué parte entrarían, al final de lo que ya hay. */
  readonly partId: string;
  /** Lo que queda por aceptar. Aceptar uno lo quita de aquí. */
  readonly degrees: readonly DegreeSymbol[];
  /** De dónde salió, para poder decirlo. */
  readonly titulo: string;
}

export interface PropuestaState {
  readonly propuesta: Propuesta | null;
  readonly acciones: {
    proponer(partId: string, degrees: readonly DegreeSymbol[], titulo: string): void;
    /** Acepta los `cuantos` primeros. Sin número, el primero. */
    aceptar(cuantos?: number): void;
    aceptarTodo(): void;
    descartar(): void;
  };
}

export const usePropuestaStore = create<PropuestaState>()((set, get) => ({
  propuesta: null,
  acciones: {
    proponer(partId, degrees, titulo) {
      const limpios = degrees.filter((degree) => degree !== undefined);
      set({ propuesta: limpios.length === 0 ? null : { partId, degrees: limpios, titulo } });
    },

    aceptar(cuantos = 1) {
      const { propuesta } = get();
      if (propuesta === null) {
        return;
      }
      const cuantosDeVerdad = Math.max(1, Math.min(cuantos, propuesta.degrees.length));
      const acciones = useArrangementStore.getState().actions;

      // Un gesto y no uno por acorde: aceptar cuatro de golpe se deshace de una
      // vez, que es como se piensa al arrepentirse.
      acciones.beginGesture();
      // Un compás cada uno, que es lo que dura un acorde mientras no se diga
      // otra cosa: estirarlo es lo primero que se hace en el lienzo.
      const pulsos = useSessionStore.getState().beatsPerBar;
      let ultimo: string | null = null;
      for (const degree of propuesta.degrees.slice(0, cuantosDeVerdad)) {
        ultimo = acciones.addBlock(propuesta.partId, degree, pulsos);
      }
      acciones.endGesture();
      // Lo aceptado queda elegido: es lo último que se ha puesto, y es de lo que
      // habla la columna del acorde.
      if (ultimo !== null) {
        acciones.elegirBloque(ultimo);
      }

      const quedan = propuesta.degrees.slice(cuantosDeVerdad);
      set({ propuesta: quedan.length === 0 ? null : { ...propuesta, degrees: quedan } });
    },

    aceptarTodo() {
      get().acciones.aceptar(get().propuesta?.degrees.length ?? 0);
    },

    descartar() {
      set({ propuesta: null });
    },
  },
}));

/** Lo propuesto para esta parte, o vacío. */
export function selectPropuestaDe(partId: string) {
  return (state: PropuestaState): readonly DegreeSymbol[] =>
    state.propuesta?.partId === partId ? state.propuesta.degrees : VACIO;
}

/** Una sola lista vacía: devolver `[]` nueva en cada lectura repinta siempre. */
const VACIO: readonly DegreeSymbol[] = [];
