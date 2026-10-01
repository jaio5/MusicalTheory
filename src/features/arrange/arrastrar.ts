import { useCallback, useEffect, useRef } from 'react';

/**
 * El bucle de un arrastre, sin repetirlo en cada sitio.
 *
 * Los tres gestos del lienzo —mover un bloque, mover una nota, estirar
 * cualquiera de los dos— se escuchan igual: se engancha al `window` en vez de al
 * elemento, porque el puntero se sale de él en cuanto empieza el gesto, y se
 * suelta también con `pointercancel`, que es lo que llega cuando el sistema se
 * queda el gesto —el navegador decide que es un desplazamiento, o entra una
 * llamada—. Sin escuchar ese, la nota se queda pegada al puntero para siempre.
 */
export interface ArrastreOpciones {
  /** Se llama en cada movimiento, con la posición del puntero. */
  readonly mover: (clientX: number, clientY: number) => void;
  /** Al soltar, pase lo que pase. */
  readonly soltar?: () => void;
}

/**
 * Empieza a escuchar el gesto, y devuelve **cómo dejar de escucharlo**.
 *
 * Lo que se devuelve quita los tres oyentes sin llamar a `soltar`, y existe por
 * lo que pasa si quien arrastra se desmonta a mitad del gesto —se cambia de
 * espacio con el teclado, se borra la parte—: los oyentes siguen colgados del
 * `window` y el siguiente movimiento del ratón mueve un bloque que ya no está en
 * pantalla. No se suelta porque soltar **escribe** en la canción, y lo que se
 * desmontó no ha terminado su gesto: lo ha perdido.
 *
 * Quien lo use lo guarda en un `ref` y lo llama en la limpieza de un efecto.
 */
export function arrastrar(opciones: ArrastreOpciones): () => void {
  const mover = (event: PointerEvent) => {
    // Mientras se arrastra no se selecciona texto ni se desplaza la página.
    event.preventDefault();
    opciones.mover(event.clientX, event.clientY);
  };

  const quitar = () => {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', fin);
    window.removeEventListener('pointercancel', fin);
  };

  const fin = () => {
    quitar();
    opciones.soltar?.();
  };

  window.addEventListener('pointermove', mover, { passive: false });
  window.addEventListener('pointerup', fin);
  window.addEventListener('pointercancel', fin);
  return quitar;
}

/**
 * `arrastrar`, con la limpieza ya puesta: lo que se desmonta a mitad del gesto
 * suelta los oyentes y no los deja colgados del `window`.
 *
 * Existe porque el pentagrama y la rejilla del punteo empiezan cinco gestos
 * entre los dos, y guardar a mano el `ref` y el efecto en cada uno era la
 * limpieza que se olvida en el sexto. Lo devuelto es estable, así que no rompe
 * los `useCallback` ni el `memo` de quien lo usa.
 */
export function useArrastre(): (opciones: ArrastreOpciones) => void {
  const quitarRef = useRef<(() => void) | null>(null);
  useEffect(() => () => quitarRef.current?.(), []);
  return useCallback((opciones: ArrastreOpciones) => {
    quitarRef.current = arrastrar(opciones);
  }, []);
}

/**
 * Pone un fantasma de arrastre donde está el puntero, **sin pasar por React**.
 *
 * Moverlo con estado costaba repintar el lienzo entero en cada movimiento —mil
 * cuatrocientas líneas de componente, con todas las partes y sus pentagramas
 * dentro— para cambiar dos números de un `style`: 27 ms por movimiento medidos
 * con la CPU a un sexto, que es un fotograma y medio de cada dos. Escribiendo el
 * `transform` a mano, el movimiento no pinta nada; React solo se entera cuando
 * cambia el sitio donde caería, que es lo único que cambia lo que se ve.
 *
 * `transform` y no `left`/`top`: mueve la capa ya pintada y no obliga a
 * recalcular la maqueta.
 */
export function colocar(nodo: HTMLElement | null, x: number, y: number): void {
  if (nodo !== null) {
    nodo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}
