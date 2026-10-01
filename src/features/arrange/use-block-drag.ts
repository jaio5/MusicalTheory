'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { colocar } from './arrastrar';

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

/**
 * Lo que React tiene que saber de un arrastre: qué bloque y dónde caería.
 *
 * **La posición del puntero no está aquí, y es a propósito.** Estaba, y cada
 * movimiento repintaba el lienzo entero para mover un fantasma dos píxeles. El
 * fantasma lo mueve ahora el propio enganche a través de `fantasma`, y el estado
 * solo cambia cuando cambia el hueco, que es lo único que cambia lo que se pinta.
 */
export interface DragState {
  readonly blockId: string;
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
  /**
   * Se engancha al `ref` del fantasma que sigue al puntero. El enganche le
   * escribe el `transform` en cada movimiento sin pasar por el estado.
   */
  readonly fantasma: (nodo: HTMLElement | null) => void;
}

function mismoHueco(a: DropTarget | null, b: DropTarget | null): boolean {
  return a?.partId === b?.partId && a?.index === b?.index;
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
  // Una sola comprobación y no dos: preguntar por la longitud y luego por el
  // primero deja una rama que no puede darse nunca, y una rama que no puede
  // darse es una rama que nadie ha leído.
  const primera = enLaFila[0];
  if (primera === undefined) {
    return null;
  }
  const partId = primera.partId;

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
  /** Dónde está el puntero, para colocar el fantasma en cuanto se monte. */
  const punteroRef = useRef({ x: 0, y: 0 });
  const fantasmaRef = useRef<HTMLElement | null>(null);
  /** Cómo dejar de escuchar el gesto en curso, si lo hay. */
  const cancelarRef = useRef<(() => void) | null>(null);

  // Desmontarse a mitad del gesto deja los oyentes en el `window`, y el próximo
  // movimiento del ratón arrastraría un bloque que ya no está en pantalla.
  useEffect(() => () => cancelarRef.current?.(), []);

  // El fantasma nace un render después de arrancar el gesto: se coloca al
  // montarse con la última posición conocida, o aparecería un instante en la
  // esquina.
  const fantasma = useCallback((nodo: HTMLElement | null) => {
    fantasmaRef.current = nodo;
    colocar(nodo, punteroRef.current.x, punteroRef.current.y);
  }, []);

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
      let hueco: DropTarget | null = null;

      const mover = (e: PointerEvent) => {
        if (!arrancado && Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < UMBRAL_PX) {
          return;
        }
        // Mientras se arrastra no se selecciona texto ni se desplaza la página.
        e.preventDefault();
        punteroRef.current = { x: e.clientX, y: e.clientY };
        colocar(fantasmaRef.current, e.clientX, e.clientY);

        if (!arrancado) {
          arrancado = true;
          medidasRef.current = medir();
          hueco = huecoEn(medidasRef.current, e.clientX, e.clientY);
          setDrag({ blockId, target: hueco });
          return;
        }
        const ahora = huecoEn(medidasRef.current, e.clientX, e.clientY);
        if (!mismoHueco(hueco, ahora)) {
          hueco = ahora;
          setDrag({ blockId, target: ahora });
        }
      };

      const quitar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        cancelarRef.current = null;
      };

      const soltar = (e: PointerEvent) => {
        quitar();
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
      cancelarRef.current = quitar;
    },
    [medir, onDrop],
  );

  return { drag, start, fantasma };
}

export type { Medida };
