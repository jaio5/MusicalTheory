'use client';

import { useCallback, useRef, useState, type PointerEvent } from 'react';

import type { DegreeSymbol } from '@core/music';

import { arrastrar, colocar, useCerrarAlDesmontar } from './arrastrar';

/**
 * Cuánto hay que moverse para que una pulsación sea un arrastre.
 *
 * El mismo cuatro que usan los bloques, y por lo mismo: un dedo nunca pulsa
 * completamente quieto, y sin umbral la mitad de las pulsaciones acaban siendo
 * arrastres de dos píxeles.
 */
const UMBRAL_ARRASTRE = 4;

/** El destino de un acorde arrastrado: en qué parte y delante de qué compás. */
export type Destino = { readonly partId: string; readonly at: number | null } | null;

function mismoDestino(a: Destino, b: Destino): boolean {
  return a?.partId === b?.partId && a?.at === b?.at;
}

/**
 * Dónde caería el acorde: en qué parte y **entre qué dos compases**.
 *
 * Antes solo miraba la parte y lo metía al final, que es lo que se puede hacer
 * con una fila de bloques a la que se apunta de lejos. Sobre una partitura no
 * vale: se suelta encima de un compás porque se quiere **ahí**, y aparecer cuatro
 * compases más allá se lee como que el gesto no ha funcionado.
 *
 * La parte de debajo se busca con `elementFromPoint` y no midiéndolas al empezar,
 * como sí hace el arrastre de bloques: aquí lo que hay debajo no se mueve
 * mientras dura el gesto, así que no hace falta la foto.
 */
function huecoBajo(x: number, y: number): Destino {
  const elemento = document.elementFromPoint(x, y);
  const parte = elemento?.closest<HTMLElement>('[data-parte-destino]');
  if (parte === null || parte === undefined) {
    return null;
  }
  /* v8 ignore next -- el `data-parte-destino` lo escribe la propia fila que se acaba de encontrar */
  const partId = parte.dataset['parteDestino'] ?? '';
  const hueco = elemento?.closest<HTMLElement>('[data-indice]');
  const indice = hueco?.dataset['indice'];

  if (indice === undefined || hueco?.dataset['parte'] !== partId) {
    // Sobre la parte pero no sobre un compás: al final, que es donde se sigue
    // una canción cuando no se apunta a ningún sitio concreto.
    return { partId, at: null };
  }
  // Pasada la mitad, el acorde va detrás. Es la misma regla que sigue el
  // arrastre de bloques, para que los dos gestos se sientan igual.
  const caja = hueco.getBoundingClientRect();
  return { partId, at: Number(indice) + (x > (caja.left + caja.right) / 2 ? 1 : 0) };
}

/** Lo que se está arrastrando y adónde caería, mientras dura. */
export interface Soltando {
  readonly symbol: string;
  readonly destino: Destino;
}

/**
 * Arrastrar un acorde de «Qué poner ahora» hasta una parte.
 *
 * Es la otra manera de poner un acorde, y la que hace falta con más de una parte
 * delante: pulsar lo mete en la de destino, que puede no ser la que se está
 * mirando. Arrastrando se dice dónde va, y se ve antes de soltar.
 *
 * **Sin la posición del puntero en el estado**, por lo mismo que el arrastre de
 * bloques: el fantasma se mueve escribiéndole el `transform` (`colocar`), y el
 * estado solo cambia cuando cambia dónde caería.
 */
export function useArrastreDeSugerencias(
  alSoltar: (partId: string, degree: DegreeSymbol, at: number | null) => void,
) {
  const [soltando, setSoltando] = useState<Soltando | null>(null);
  const punteroRef = useRef({ x: 0, y: 0 });
  const fantasmaRef = useRef<HTMLElement | null>(null);
  /**
   * El destino se guarda en un ref además de en el estado: leerlo dentro del
   * actualizador de `setSoltando` para soltarlo allí mismo es cambiar un
   * componente mientras se está pintando otro, y React lo dice por consola.
   */
  const destinoRef = useRef<Destino>(null);
  const arrastradaRef = useRef(false);
  /** Si el fantasma ya está puesto: el primer destino se pinta siempre. */
  const puestoRef = useRef(false);
  const cancelarRef = useRef<(() => void) | null>(null);
  useCerrarAlDesmontar(cancelarRef);

  const fantasma = useCallback((nodo: HTMLElement | null) => {
    fantasmaRef.current = nodo;
    colocar(nodo, punteroRef.current.x, punteroRef.current.y);
  }, []);

  const arrastrarSugerencia = useCallback(
    (event: PointerEvent, degree: DegreeSymbol, symbol: string) => {
      if (event.button !== 0) {
        return;
      }
      const inicioX = event.clientX;
      const inicioY = event.clientY;
      destinoRef.current = null;
      arrastradaRef.current = false;
      puestoRef.current = false;

      cancelarRef.current = arrastrar({
        mover: (x, y) => {
          punteroRef.current = { x, y };
          colocar(fantasmaRef.current, x, y);
          if (!arrastradaRef.current) {
            if (Math.hypot(x - inicioX, y - inicioY) < UMBRAL_ARRASTRE) {
              return;
            }
            arrastradaRef.current = true;
          }
          const destino = huecoBajo(x, y);
          if (puestoRef.current && mismoDestino(destinoRef.current, destino)) {
            // El mismo sitio que en el movimiento de antes: el fantasma ya se ha
            // movido y no hay nada más que pintar.
            return;
          }
          puestoRef.current = true;
          destinoRef.current = destino;
          setSoltando({ symbol, destino });
        },
        soltar: () => {
          cancelarRef.current = null;
          const destino = destinoRef.current;
          setSoltando(null);
          if (arrastradaRef.current && destino !== null) {
            alSoltar(destino.partId, degree, destino.at);
          }
        },
      });
    },
    [alSoltar],
  );

  /**
   * Si la pulsación que llega es la de vuelta de un arrastre, y la olvida.
   *
   * Un arrastre no es además una pulsación: el navegador dispara el `click`
   * después del `pointerup` aunque el puntero haya recorrido media pantalla.
   */
  const fueArrastre = useCallback(() => {
    const fue = arrastradaRef.current;
    arrastradaRef.current = false;
    return fue;
  }, []);

  return { soltando, fantasma, arrastrarSugerencia, fueArrastre };
}
