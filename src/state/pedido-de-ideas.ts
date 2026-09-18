'use client';

import { create } from 'zustand';

/**
 * «Pídeme una idea», dicho desde el lienzo.
 *
 * Existe por un problema de capas, y la alternativa era peor. Quien sabe pedirle
 * una progresión al modelo es `features/ideas` —tiene el contrato, el `fetch` y
 * los cinco estados de error—, y quien quiere pedirla sin salir de la canción es
 * `features/arrange`. **Un feature no importa de otro** (regla 2), y subir el
 * contrato entero a `core/` por un botón sería mover la pieza equivocada: el ADR
 * 0033 dice que el contrato manda y vive donde vive.
 *
 * Con una bandera en `state/` —que las dos capas sí pueden abrir— el lienzo dice
 * «que alguien pida una progresión» y el panel, al abrirse, la pide. Es el mismo
 * trato que ya tienen los hechos de componer con el avance.
 *
 * **Se consume al leerla**, y eso no es un detalle: si se quedara puesta, cada
 * vez que se volviera a abrir el panel se gastaría otra petición del cupo sin
 * que nadie lo hubiera pedido.
 */

export interface PedidoDeIdeas {
  readonly pendiente: boolean;
  readonly acciones: {
    /** Deja pedida una progresión para cuando el panel esté delante. */
    pedirProgresion(): void;
    /** Se la lleva: devuelve si había una pedida y la borra. */
    consumir(): boolean;
  };
}

export const usePedidoDeIdeas = create<PedidoDeIdeas>()((set, get) => ({
  pendiente: false,
  acciones: {
    pedirProgresion() {
      set({ pendiente: true });
    },
    consumir() {
      const habia = get().pendiente;
      if (habia) {
        set({ pendiente: false });
      }
      return habia;
    },
  },
}));
