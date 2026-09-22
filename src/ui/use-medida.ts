'use client';

import { useEffect, useRef, useState } from 'react';

/** Lo que mide una caja, en píxeles. */
export interface Medida {
  readonly ancho: number;
  readonly alto: number;
}

const SIN_MEDIR: Medida = { ancho: 0, alto: 0 };

/**
 * Cuánto mide una caja, medido de verdad y no en porcentajes.
 *
 * **Un `ResizeObserver` y no CSS**, siempre por la misma razón: hace falta *el
 * número*. El pentagrama reparte los pulsos por el ancho que haya, el lienzo
 * decide cuánto vale un pulso y el mástil reparte los trastes; a ninguno le vale
 * un `width: 100%`, que estiraría también las notas y los trastes hasta
 * deformarlos.
 *
 * Estaba escrito tres veces igual —pentagrama, lienzo y mástil—, y la tercera la
 * escribí copiando la segunda. **Una copia más y alguna se queda sin desconectar
 * el observador**, que es una fuga que no se ve hasta que la pestaña lleva un
 * rato abierta.
 *
 * Devuelve cero mientras no haya medida: el primer pintado no tiene caja todavía,
 * y **jsdom no trae `ResizeObserver`**, así que en los tests se queda en cero
 * salvo que se ponga uno de mentira.
 */
export function useMedida<T extends HTMLElement>(): {
  readonly ref: React.RefObject<T | null>;
  readonly medida: Medida;
} {
  const ref = useRef<T | null>(null);
  const [medida, setMedida] = useState<Medida>(SIN_MEDIR);

  useEffect(() => {
    const caja = ref.current;
    /* v8 ignore next 3 -- la caja está montada; lo que falta en jsdom es el observador, y eso sí se prueba */
    if (caja === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observador = new ResizeObserver(([entrada]) => {
      setMedida({
        ancho: entrada?.contentRect.width ?? 0,
        alto: entrada?.contentRect.height ?? 0,
      });
    });
    observador.observe(caja);
    return () => observador.disconnect();
  }, []);

  return { ref, medida };
}
