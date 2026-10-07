'use client';

import { useCallback, type FocusEvent } from 'react';

/**
 * Que el control que recibe el foco **se vea entero** dentro de una tira que se
 * desplaza de lado.
 *
 * Las tiras con `hay-mas-al-lado` —la barra de componer en un teléfono, la del
 * lienzo, la de cada parte— no caben y se arrastran. Con el tabulador se llega a
 * un control que está fuera, y el navegador solo desplaza lo justo para que
 * asome: medido a 390, «Tempo» enseñaba 13 de sus 82 píxeles, y quien navega
 * con teclado no sabía qué tenía enfocado. Aquí se le pide que lo traiga entero.
 *
 * Se pone en la tira y no en cada hijo: el `onFocus` de React sube, así que
 * basta un oyente para todo lo que haya dentro.
 *
 * **Solo cuando la tira de verdad se desplaza.** En ancho se envuelven y caben,
 * y pedir `scrollIntoView` ahí movería además la página en vertical para nada.
 * Y `nearest` en los dos ejes: si ya se ve entero no se toca nada, y si no, se
 * mueve lo mínimo.
 */
export function useTraerALaVista<T extends HTMLElement = HTMLElement>(): (
  event: FocusEvent<T>,
) => void {
  return useCallback((event: FocusEvent<T>) => {
    const tira = event.currentTarget;
    // Lo que recibe el foco es siempre un elemento: el texto no se enfoca.
    const enfocado: Element = event.target;
    if (enfocado === tira || tira.scrollWidth <= tira.clientWidth) {
      return;
    }
    enfocado.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, []);
}
