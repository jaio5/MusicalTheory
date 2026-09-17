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
 * y es el mismo trato que ya tiene el tema. En el servidor se contesta que **sí**
 * hay banco: es el caso que sirve la mayoría de las visitas, y equivocarse hacia
 * el móvil dejaría al escritorio pintando pestañas durante un fotograma.
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
