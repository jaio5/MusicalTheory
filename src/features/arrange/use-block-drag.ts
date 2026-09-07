'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Arrastrar bloques con el puntero, sin librería.
 *
 * Son filas de cajas en horizontal, no un árbol ni una rejilla libre, y para eso
 * los Pointer Events del navegador bastan. Meter una dependencia de arrastrar y
 * soltar en un proyecto que tiene diez —y que se escribió su propia detección de
 * tono— habría sido la más cara de todas por lo poco que hace falta.
 *
 * ## Las medidas se toman una vez, al empezar el gesto
 *
 * En cuanto se mueve el primer bloque, React vuelve a pintar la fila y las cajas
 * cambian de sitio: preguntarle al DOM dónde está cada una **durante** el
 * arrastre da posiciones que ya no valen, y el hueco de destino parpadea entre
 * dos valores. Se fotografían los rectángulos al pulsar y el gesto entero se
 * resuelve contra esa foto.
 *
 * ## El umbral de cuatro píxeles
 *
 * Un bloque también se pulsa para oírlo, y un dedo nunca pulsa completamente
 * quieto. Sin umbral, la mitad de las pulsaciones acaban siendo arrastres de dos
 * píxeles que no mueven nada pero se comen el `click`.
 */
const UMBRAL_PX = 4;

/** Dónde caería el bloque si se soltara ahora. */
export interface DropTarget {
  readonly partId: string;
  readonly index: number;
}

export interface DragState {
  readonly blockId: string;
  /** Dónde está el puntero, para dibujar el bloque pegado a él. */
  readonly x: number;
  readonly y: number;
  readonly target: DropTarget | null;
}

/** La foto de una caja al empezar el gesto. */
interface Medida {
  readonly partId: string;
  readonly index: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface BlockDrag {
  readonly drag: DragState | null;
  /** Se engancha al `onPointerDown` del cuerpo de cada bloque. */
  start(event: React.PointerEvent, blockId: string): void;
}

/**
 * Qué hueco corresponde a un punto de la pantalla.
 *
 * Primero la fila —por la banda vertical, que es lo que separa una parte de
 * otra— y dentro de ella el hueco por la mitad de cada caja: pasada la mitad, el
 * bloque va después. Es lo que hace que soltar «encima de la derecha» de un
 * bloque signifique detrás de él y no delante.
 *
 * Fuera de toda banda no hay destino, y eso también es una respuesta: soltar en
 * el aire deja el bloque donde estaba.
 */
function huecoEn(medidas: readonly Medida[], x: number, y: number): DropTarget | null {
  const enLaFila = medidas.filter((m) => y >= m.top && y <= m.bottom);
  if (enLaFila.length === 0) {
    return null;
  }

  const partId = enLaFila[0]?.partId;
  if (partId === undefined) {
    return null;
  }

  // Una parte vacía se mide con una caja fantasma de índice 0, así que aquí ya
  // hay al menos un elemento y el destino sale siempre.
  let index = 0;
  for (const medida of enLaFila) {
    if (x > (medida.left + medida.right) / 2) {
      index = medida.index + 1;
    }
  }
  return { partId, index };
}

/**
 * El arrastre de bloques de una pantalla.
 *
 * `medir` lo da quien dibuja, porque es quien sabe qué elementos hay: devuelve la
 * lista de cajas con la parte y el índice de cada una. Así este hook no busca
 * nada en el DOM ni conoce las clases de nadie.
 */
export function useBlockDrag(
  medir: () => readonly Medida[],
  onDrop: (blockId: string, partId: string, index: number) => void,
): BlockDrag {
  const [drag, setDrag] = useState<DragState | null>(null);
  const medidasRef = useRef<readonly Medida[]>([]);

  const start = useCallback(
    (event: React.PointerEvent, blockId: string) => {
      // Solo el botón principal: con el derecho se abre el menú del sistema, y
      // arrastrar con él deja el bloque pegado al puntero para siempre.
      if (event.button !== 0) {
        return;
      }

      const inicioX = event.clientX;
      const inicioY = event.clientY;
      let arrancado = false;

      const mover = (e: PointerEvent) => {
        if (!arrancado) {
          if (Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < UMBRAL_PX) {
            return;
          }
          arrancado = true;
          medidasRef.current = medir();
        }
        // Mientras se arrastra no se selecciona texto ni se desplaza la página.
        e.preventDefault();
        setDrag({
          blockId,
          x: e.clientX,
          y: e.clientY,
          target: huecoEn(medidasRef.current, e.clientX, e.clientY),
        });
      };

      const soltar = (e: PointerEvent) => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);

        if (arrancado) {
          const destino = huecoEn(medidasRef.current, e.clientX, e.clientY);
          if (destino !== null) {
            onDrop(blockId, destino.partId, destino.index);
          }
        }
        setDrag(null);
      };

      window.addEventListener('pointermove', mover, { passive: false });
      window.addEventListener('pointerup', soltar);
      // `pointercancel` llega cuando el sistema se queda el gesto —el navegador
      // decide que es un desplazamiento, o entra una llamada—. Sin escucharlo, el
      // bloque se queda pegado al puntero y no hay manera de soltarlo.
      window.addEventListener('pointercancel', soltar);
    },
    [medir, onDrop],
  );

  return { drag, start };
}

export type { Medida };
