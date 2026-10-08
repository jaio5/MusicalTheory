'use client';

import { useCallback, useRef, type PointerEvent, type RefObject } from 'react';

import { findBlock } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useFuncionEstable } from '@ui/use-funcion-estable';

import { arrastrar, useCerrarAlDesmontar } from './arrastrar';
import { ZONA_ESTIRAR_PX } from './BlockButton';
import { useBlockDrag, type BlockDrag, type Medida } from './use-block-drag';

/**
 * Coger un bloque de la tira: moverlo de sitio o estirarlo, según por dónde.
 *
 * La franja de estirar son los últimos píxeles del bloque. Se decide aquí y no
 * en dos elementos distintos porque una manija propia sería un control de
 * catorce píxeles en una interfaz donde nada de lo que se pulsa baja de
 * cuarenta y cuatro.
 */
export function useArrastreDeBloques({
  listaRef,
  porPulso,
  alSoltar,
}: {
  /** La caja de las filas, donde se miden los huecos. */
  readonly listaRef: RefObject<HTMLElement | null>;
  readonly porPulso: number;
  /** El bloque ha caído en esa parte, que pasa a ser la de destino. */
  readonly alSoltar: (partId: string) => void;
}): Pick<BlockDrag, 'drag' | 'fantasma'> & {
  readonly cogerBloque: (event: PointerEvent<HTMLButtonElement>, blockId: string) => void;
} {
  const acciones = useArrangementStore((state) => state.actions);

  /**
   * Las cajas de todos los bloques, para resolver el arrastre.
   *
   * Se leen del DOM por sus `data-`, y no de un registro de refs, porque son las
   * posiciones de verdad —con el desplazamiento horizontal de cada fila ya
   * aplicado— y eso un ref no lo sabe.
   */
  const medir = useCallback((): Medida[] => {
    const raiz = listaRef.current;
    /* v8 ignore next 3 -- solo corre durante un arrastre sobre la lista, que está puesta porque se arrastra dentro de ella */
    if (raiz === null) {
      return [];
    }
    return [...raiz.querySelectorAll<HTMLElement>('[data-parte]')].map((elemento) => {
      const caja = elemento.getBoundingClientRect();
      return {
        /* v8 ignore start -- los dos `data-` los escribe la propia fila */
        partId: elemento.dataset['parte'] ?? '',
        index: Number(elemento.dataset['indice'] ?? 0),
        /* v8 ignore stop */
        left: caja.left,
        right: caja.right,
        top: caja.top,
        bottom: caja.bottom,
      };
    });
  }, [listaRef]);

  const soltar = useCallback(
    (blockId: string, partId: string, index: number) => {
      acciones.moveBlock(blockId, partId, index);
      alSoltar(partId);
    },
    [acciones, alSoltar],
  );

  const { drag, start, fantasma } = useBlockDrag(medir, soltar);

  /**
   * Cómo dejar de escuchar un estirón a medias si el lienzo se desmonta —se
   * cambia de espacio con el teclado, que es un atajo sin modificador—: los
   * oyentes se quedaban colgados del `window` y el gesto del deshacer, abierto
   * (`useCerrarAlDesmontar`).
   */
  const cancelarRef = useRef<(() => void) | null>(null);
  useCerrarAlDesmontar(cancelarRef);

  const cogerBloque = useFuncionEstable(
    (event: PointerEvent<HTMLButtonElement>, blockId: string) => {
      const caja = event.currentTarget.getBoundingClientRect();
      if (event.clientX <= caja.right - ZONA_ESTIRAR_PX) {
        start(event, blockId);
        return;
      }
      if (event.button !== 0) {
        return;
      }

      const inicioX = event.clientX;
      const arrangement = useArrangementStore.getState().arrangement;
      /* v8 ignore next -- el bloque que se coge esta pintado, y lo esta porque esta en el montaje */
      const pulsosIniciales = findBlock(arrangement, blockId)?.block.beats ?? 4;
      // **Un estirón es un solo paso de deshacer.** Sin abrir el gesto, cada
      // movimiento del puntero apilaba su deshacer, y volver atrás un estirón
      // pedía pulsar «Deshacer» tantas veces como píxeles se había movido.
      acciones.beginGesture();

      cancelarRef.current = arrastrar({
        mover: (x) => acciones.resizeBlock(blockId, pulsosIniciales + (x - inicioX) / porPulso),
        soltar: () => {
          cancelarRef.current = null;
          acciones.endGesture();
        },
      });
    },
  );

  return { drag, fantasma, cogerBloque };
}
