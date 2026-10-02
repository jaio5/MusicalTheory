'use client';

import { useSyncExternalStore } from 'react';

/**
 * Si hay sitio para el banco de trabajo, o toca una columna con pestañas.
 *
 * El corte es el mismo `lg` de Tailwind —64rem— y está aquí escrito una vez
 * porque **no basta con clases**: por debajo de esa anchura la pantalla no es el
 * mismo árbol con otro reparto, es otra cosa. Apiladas, las cinco áreas en un
 * teléfono dejaban la canción en una rendija y el inspector del acorde llevándose
 * media pantalla, y plegar —que en el banco es un gesto útil— ahí solo añade
 * tiras que ocupan sin enseñar nada.
 *
 * `useSyncExternalStore` y no un efecto con estado: es exactamente lo que hace
 * falta —un valor que vive fuera de React y que hay que leer sin desincronizar—
 * y es el mismo trato que ya tiene el tema.
 *
 * **Lo que se ve al llegar no puede depender de esto**, porque el servidor no
 * sabe el ancho. Contestaba que sí pensando en el escritorio, y el teléfono lo
 * pagaba: pintaba el banco hasta hidratar, y al hidratar la cabecera bajaba de
 * tres renglones a uno y la pantalla entera saltaba (CLS 0,12 en `/componer` a
 * 390). Ahora quien lo usa monta lo de los dos anchos y elige con clases —el
 * mismo corte, `lg:` y `max-lg:`—, y esto solo decide lo que no se puede pintar
 * a la vez o lo que nadie ve hasta después: qué área enseña una pestaña, qué
 * lleva un panel cerrado, los atajos.
 *
 * En el servidor se sigue contestando que **sí**, y ahora por otro motivo: el
 * árbol del banco es el que lleva todo lo de escritorio, y las clases ya lo
 * esconden en un teléfono hasta que el cliente lo poda. Contestar que no
 * dejaría fuera del HTML lo que el escritorio enseña nada más llegar.
 */
const CONSULTA = '(min-width: 64rem)';

function suscribirse(avisar: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

function ahora(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(CONSULTA).matches;
}

function enElServidor(): boolean {
  return true;
}

export function useHayBanco(): boolean {
  return useSyncExternalStore(suscribirse, ahora, enElServidor);
}
