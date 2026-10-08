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
 *
 * ## Con el dedo, el arrastre empieza con una pulsación larga
 *
 * Con el ratón, mover es arrastrar: no hay otra cosa que un ratón pueda querer
 * decir al moverse con el botón pulsado. Con el dedo, mover es **desplazar**: la
 * tira de bloques se sale por la derecha en un teléfono y la columna entera se
 * sube y se baja barriendo, y los bloques tapan casi toda la tira. Medido a 390:
 * con ocho acordes sobraban 238 px y un barrido sobre la tira la dejaba en
 * `scrollLeft` 0 mientras cambiaba el orden de los acordes; un barrido vertical
 * que nacía en un bloque no movía la columna, con 548 px por debajo.
 *
 * Así que con el dedo el bloque se **sujeta** primero —`PULSACION_LARGA_MS`
 * quieto— y entonces se mueve. Antes de eso, el navegador se queda el gesto y
 * desplaza, que es lo que el bloque declara con `touch-action: pan-x pan-y`; y en
 * cuanto el bloque está sujeto se le dice al navegador que **no** desplace
 * (`touchmove` con `preventDefault`), que es lo único que un `pointermove` no
 * puede decirle. Es el mismo trato que da cualquier lista que se reordena en un
 * teléfono, y lo que hace que el pulgar pueda barrer por encima de la canción
 * sin descolocarla.
 */
const UMBRAL_PX = 4;

/**
 * Cuánto hay que sujetar un bloque con el dedo para cogerlo.
 *
 * Trescientos milisegundos: por debajo de los quinientos en que el navegador
 * táctil abre el menú de contexto, y por encima de lo que dura un toque para
 * oírlo. Exportado para que quien pruebe el gesto no lo copie.
 */
export const PULSACION_LARGA_MS = 300;

/** Dónde caería el bloque si se soltara ahora. */
interface DropTarget {
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
interface DragState {
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
      const conElDedo = event.pointerType === 'touch';
      /** Con el ratón se coge al instante; con el dedo, tras sujetarlo. */
      let cogido = !conElDedo;
      let arrancado = false;
      /** Si el bloque llegó a moverse: sujetarlo y soltarlo sin más no lo cambia de sitio. */
      let movido = false;
      let hueco: DropTarget | null = null;
      let temporizador: ReturnType<typeof setTimeout> | null = null;

      const arrancar = (x: number, y: number) => {
        arrancado = true;
        punteroRef.current = { x, y };
        colocar(fantasmaRef.current, x, y);
        medidasRef.current = medir();
        hueco = huecoEn(medidasRef.current, x, y);
        setDrag({ blockId, target: hueco });
      };

      const mover = (e: PointerEvent) => {
        const lejos = Math.hypot(e.clientX - inicioX, e.clientY - inicioY) >= UMBRAL_PX;
        if (!cogido) {
          // El dedo se ha ido antes de sujetar el bloque: es un desplazamiento,
          // y es del navegador. Se deja de escuchar sin tocar nada.
          if (lejos) {
            quitar();
          }
          return;
        }
        if (!arrancado && !lejos) {
          return;
        }
        // Mientras se arrastra no se selecciona texto ni se desplaza la página.
        e.preventDefault();
        if (lejos) {
          movido = true;
        }
        if (!arrancado) {
          arrancar(e.clientX, e.clientY);
          return;
        }
        punteroRef.current = { x: e.clientX, y: e.clientY };
        colocar(fantasmaRef.current, e.clientX, e.clientY);
        const ahora = huecoEn(medidasRef.current, e.clientX, e.clientY);
        if (!mismoHueco(hueco, ahora)) {
          hueco = ahora;
          setDrag({ blockId, target: ahora });
        }
      };

      // Un `pointermove` no puede impedir que el navegador desplace: eso solo lo
      // dice un `touchmove` que no sea pasivo. Se le dice en cuanto el bloque
      // está cogido; antes, el barrido es suyo.
      const frenarDesplazamiento = (e: TouchEvent) => {
        if (cogido && e.cancelable) {
          e.preventDefault();
        }
      };
      // Sujetar quieto medio segundo abre el menú de contexto en un teléfono, y
      // aquí sujetar quieto es justo cómo se coge un bloque.
      const sinMenu = (e: Event) => e.preventDefault();

      const quitar = () => {
        if (temporizador !== null) {
          clearTimeout(temporizador);
          temporizador = null;
        }
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        window.removeEventListener('touchmove', frenarDesplazamiento);
        window.removeEventListener('contextmenu', sinMenu);
        cancelarRef.current = null;
      };

      const soltar = (e: PointerEvent) => {
        quitar();
        if (arrancado && movido) {
          const destino = huecoEn(medidasRef.current, e.clientX, e.clientY);
          if (destino !== null) {
            onDrop(blockId, destino.partId, destino.index);
          }
        }
        setDrag(null);
      };

      if (conElDedo) {
        temporizador = setTimeout(() => {
          temporizador = null;
          cogido = true;
          // Cogido, el bloque se levanta ya —se apaga en su sitio y el fantasma
          // sale bajo el dedo—: es lo que dice que la pulsación larga ha
          // funcionado y que ahora moverse es moverlo.
          arrancar(inicioX, inicioY);
        }, PULSACION_LARGA_MS);
        window.addEventListener('touchmove', frenarDesplazamiento, { passive: false });
        window.addEventListener('contextmenu', sinMenu);
      }
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
