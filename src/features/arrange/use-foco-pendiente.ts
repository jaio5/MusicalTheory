'use client';

import { useCallback, useRef, type RefObject } from 'react';

import { useIsomorphicLayoutEffect } from '@ui/use-isomorphic-layout-effect';

/** A quién devolverle el foco: un acorde, una nota o la parte entera. */
export interface FocoPendiente {
  readonly que: 'bloque' | 'nota' | 'parte';
  readonly id: string;
}

/**
 * Devuelve el foco en cuanto se pinte lo que acaba de cambiar.
 *
 * **Quitar con `Supr` dejaba el foco en el `<body>`**: el bloque enfocado
 * desaparece, el navegador no sabe adónde llevarlo y el siguiente tabulador
 * empieza por arriba de la página. Mover tenía el mismo fallo a medias: para
 * cambiar el orden, React saca de su sitio el nodo que se mueve, y sacar el
 * enfocado también lo suelta. Se apunta quién debe tenerlo —el vecino del que se
 * fue, o el mismo que se movió— y se le da después de pintar.
 *
 * Por identificador y no por referencia al nodo, porque el nodo bueno es el del
 * pintado siguiente. Y en las dos vistas a la vez: el bloque de la tira y el
 * cifrado de la partitura llevan el mismo `data-bloque`.
 *
 * Mira después de **cada** pintado de quien lo usa, y por eso va en el lienzo:
 * es quien se repinta cuando cambia la canción.
 */
export function useFocoPendiente(
  raizRef: RefObject<HTMLElement | null>,
): (destino: FocoPendiente) => void {
  const pendienteRef = useRef<FocoPendiente | null>(null);

  useIsomorphicLayoutEffect(() => {
    const pendiente = pendienteRef.current;
    pendienteRef.current = null;
    // **Solo si el foco se ha perdido.** Si la tecla no cambió nada —mover el
    // primero hacia atrás— no hay pintado, y lo apuntado se queda esperando al
    // siguiente: para entonces el foco puede estar en cualquier otro sitio, y
    // quitárselo a quien lo tenga sería un salto sin motivo.
    const activo = document.activeElement;
    const raiz = raizRef.current;
    /* v8 ignore next 3 -- la lista está montada siempre que hay algo que enfocar */
    if (pendiente === null || raiz === null || (activo !== null && activo !== document.body)) {
      return;
    }
    // Se busca comparando y no metiendo el identificador en el selector: así no
    // hay que escaparlo, venga como venga.
    const atributo = pendiente.que === 'parte' ? 'parteDestino' : pendiente.que;
    const nodo = [
      ...raiz.querySelectorAll<HTMLElement | SVGElement>(
        pendiente.que === 'parte' ? '[data-parte-destino]' : `[data-${pendiente.que}]`,
      ),
    ].find((candidato) => candidato.dataset[atributo] === pendiente.id);
    // Sin vecino al que ir, al primer mando de la parte, que es su nombre: es
    // donde estaba lo que se quitó.
    const destino = pendiente.que === 'parte' ? nodo?.querySelector('button') : nodo;
    destino?.focus();
  });

  return useCallback((destino: FocoPendiente) => {
    pendienteRef.current = destino;
  }, []);
}
