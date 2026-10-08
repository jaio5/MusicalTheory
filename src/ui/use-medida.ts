'use client';

import { useEffect, useRef, useState } from 'react';

/** Lo que mide una caja, en píxeles. */
export interface Medida {
  readonly ancho: number;
  readonly alto: number;
}

const SIN_MEDIR: Medida = { ancho: 0, alto: 0 };

function medidaDe(caja: DOMRectReadOnly | undefined): Medida {
  return { ancho: caja?.width ?? 0, alto: caja?.height ?? 0 };
}

/**
 * **Lo mismo que había no es una medida nueva.** El observador avisa también
 * cuando cambia algo que no es el tamaño —y arrastrando un divisor avisa en cada
 * fotograma—, y un objeto nuevo con los mismos dos números repinta el lienzo
 * entero para nada. Devolviendo el de antes, React ni entra.
 */
function mismaMedida(antes: Medida, ahora: Medida): boolean {
  return antes.ancho === ahora.ancho && antes.alto === ahora.alto;
}

function anchoDe(caja: DOMRectReadOnly | undefined): number {
  return caja?.width ?? 0;
}

/**
 * El observador, una vez para los dos ganchos.
 *
 * Estaba escrito tres veces igual —pentagrama, lienzo y mástil—, y la tercera la
 * escribí copiando la segunda. **Una copia más y alguna se queda sin desconectar
 * el observador**, que es una fuga que no se ve hasta que la pestaña lleva un
 * rato abierta.
 *
 * `inicial`, `leer` e `igual` son constantes de este fichero, así que el
 * observador se crea una vez, al montar.
 */
function useObservada<T extends HTMLElement, V>(
  inicial: V,
  leer: (caja: DOMRectReadOnly | undefined) => V,
  igual: (antes: V, ahora: V) => boolean,
): { readonly ref: React.RefObject<T | null>; readonly valor: V } {
  const ref = useRef<T | null>(null);
  const [valor, setValor] = useState<V>(inicial);

  useEffect(() => {
    const caja = ref.current;
    /* v8 ignore next 3 -- la caja está montada; lo que falta en jsdom es el observador, y eso sí se prueba */
    if (caja === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    // Lo último que se dio, para no llamar a `setValor` con lo mismo: React, tras
    // un cambio, todavía pinta una vez el componente antes de ver que el valor
    // repetido no cambia nada, y con el observador avisando en cada fotograma
    // eso es un pintado de más por cada uno que hace falta.
    let ultimo = inicial;
    const observador = new ResizeObserver(([entrada]) => {
      const ahora = leer(entrada?.contentRect);
      if (!igual(ultimo, ahora)) {
        ultimo = ahora;
        setValor(ahora);
      }
    });
    observador.observe(caja);
    return () => observador.disconnect();
  }, [inicial, leer, igual]);

  return { ref, valor };
}

/**
 * Cuánto mide una caja, medido de verdad y no en porcentajes.
 *
 * **Un `ResizeObserver` y no CSS**, siempre por la misma razón: hace falta *el
 * número*. El mástil reparte los trastes por el ancho y el alto que haya; no le
 * vale un `width: 100%`, que estiraría también los trastes hasta deformarlos.
 *
 * Devuelve cero mientras no haya medida: el primer pintado no tiene caja todavía,
 * y **jsdom no trae `ResizeObserver`**, así que en los tests se queda en cero
 * salvo que se ponga uno de mentira.
 */
export function useMedida<T extends HTMLElement>(): {
  readonly ref: React.RefObject<T | null>;
  readonly medida: Medida;
} {
  const { ref, valor } = useObservada<T, Medida>(SIN_MEDIR, medidaDe, mismaMedida);
  return { ref, medida: valor };
}

/**
 * Solo el ancho de una caja, para quien reparte a lo ancho y **crece a lo alto
 * con lo que reparte**.
 *
 * El pentagrama y el lienzo miden la caja que envuelve su dibujo, y el alto de esa
 * caja sale del propio reparto: con `useMedida`, cada cambio de ancho traía un
 * segundo aviso por el alto nuevo y cada pentagrama se pintaba dos veces. Un
 * número igual que el de antes React lo descarta sin pintar.
 */
export function useAncho<T extends HTMLElement>(): {
  readonly ref: React.RefObject<T | null>;
  readonly ancho: number;
} {
  const { ref, valor } = useObservada<T, number>(0, anchoDe, Object.is);
  return { ref, ancho: valor };
}
