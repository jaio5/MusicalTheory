'use client';

import { useSyncExternalStore } from 'react';

function suscribir(aviso: () => void): () => void {
  window.addEventListener('online', aviso);
  window.addEventListener('offline', aviso);
  return () => {
    window.removeEventListener('online', aviso);
    window.removeEventListener('offline', aviso);
  };
}

/**
 * Si el navegador cree que hay red.
 *
 * El profesor es lo único de aprender que sale del aparato, y sin red la
 * pregunta acababa en «no hemos podido contactar con el profesor, vuelve a
 * intentarlo en un minuto»: culpa del modelo y una espera que no arregla nada.
 * `navigator.onLine` solo sabe si hay red, no si llega al servidor —con red y el
 * servidor caído dice que sí—, y para eso basta: el «sí» lo desmiente la
 * llamada, y el «no» es seguro. En el servidor se supone que sí, para no pintar
 * un aviso que el cliente quitaría al hidratar.
 */
export function useEnLinea(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  );
}
