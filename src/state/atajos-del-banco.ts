'use client';

import { useEffect } from 'react';

import { useBancoStore } from './banco';
import type { AreaPlegable, EspacioDeTrabajo } from './workspace';

/**
 * Las teclas del banco de trabajo.
 *
 * No son un extra, y eso lo decidió
 * [adr/0031](../../docs/adr/0031-componer-es-un-banco-de-trabajo.md) al hacer que
 * las áreas se puedan encoger: **si una se puede esconder, tiene que haber una
 * tecla que la devuelva.** Sin eso, quien pliega las cuatro se queda mirando una
 * pantalla vacía sin saber cómo deshacerlo.
 *
 * Los números eligen espacio, los corchetes pliegan los lados y la barra lo
 * devuelve todo. Van sin modificador porque se usan con la guitarra puesta y una
 * mano libre, y la combinación de dos teclas pide las dos manos.
 *
 * **Se apagan mientras se escribe**, que es la trampa de no llevar modificador:
 * poner un «2» en el tempo o escribir «ensayar» en el nombre de una parte no
 * puede cambiar de espacio. Se mira dónde está el foco, no qué se teclea.
 */

const ESPACIOS: Readonly<Record<string, EspacioDeTrabajo>> = {
  '1': 'tocando',
  '2': 'escribir',
  '3': 'ensayar',
};

const LADOS: Readonly<Record<string, AreaPlegable>> = {
  '[': 'izquierda',
  ']': 'derecha',
};

/** Cómo se dicen en un `title` y en `aria-keyshortcuts`. */
export const ATAJOS = {
  tocando: '1',
  escribir: '2',
  ensayar: '3',
  izquierda: '[',
  derecha: ']',
  devolver: '\\',
} as const;

/** Si el foco está en algo donde se escribe. */
function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) {
    return false;
  }
  if (destino.isContentEditable) {
    return true;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
}

/**
 * Enciende las teclas del banco.
 *
 * `hayBanco` apaga las de plegar abajo de `lg`: allí las áreas van en pestañas y
 * plegar no se ve, así que la tecla cambiaría un estado invisible. Las de
 * espacio siguen, que ésas sí se notan.
 */
export function useAtajosDelBanco(hayBanco: boolean): void {
  useEffect(() => {
    function alPulsar(evento: KeyboardEvent): void {
      // Con modificador es un atajo del navegador o del sistema, no nuestro.
      if (evento.ctrlKey || evento.metaKey || evento.altKey || escribiendo(evento.target)) {
        return;
      }

      const espacio = ESPACIOS[evento.key];
      if (espacio !== undefined) {
        evento.preventDefault();
        useBancoStore.getState().actions.espacio(espacio);
        return;
      }

      if (!hayBanco) {
        return;
      }

      const lado = LADOS[evento.key];
      if (lado !== undefined) {
        evento.preventDefault();
        useBancoStore.getState().actions.plegar(lado);
        return;
      }

      if (evento.key === ATAJOS.devolver) {
        evento.preventDefault();
        useBancoStore.getState().actions.devolverElReparto();
      }
    }

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [hayBanco]);
}
