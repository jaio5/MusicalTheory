'use client';

import { useEffect } from 'react';

import { useArrangementStore } from './arrangement-store';
import { selectActiveKey, useSessionStore, type SessionState } from './session-store';

/**
 * Que el montaje esté siempre escrito en el modo de la tonalidad que hay puesta.
 *
 * Es una invariante, no una comodidad: **sin ella la pantalla de componer se
 * caía entera**. Los dos modos no nombran los mismos grados, así que un montaje
 * hecho en Do mayor —con su `I`, su `IV` y su `vi`— deja de poder leerse en
 * cuanto la rueda pasa a La menor: `resolveDegree` y `nextDegrees` lanzan
 * `RangeError` con un grado que no les toca, React tira el árbol y encima de
 * media hora de trabajo aparece un «This page couldn't load». Reproducido con
 * cuatro bloques puestos y un clic en la rueda.
 *
 * `arrangement-store` ya traía la acción para arreglarlo y su comentario decía
 * «lo llama el cambio de rueda». No lo llamaba nadie: estaba escrita, probada y
 * sin enchufar.
 *
 * **Se engancha a los dos almacenes y no a `pinKey`.** El modo no cambia solo
 * pulsando la rueda: también cuando se detecta una tonalidad por el micro, al
 * volver a hacer caso a la detección y al retomar una sesión guardada. Lo que
 * importa es el modo que sale de `selectActiveKey`, no por dónde entró. Y se
 * mira también al cambiar el montaje, porque abrir una canción guardada mete
 * grados nuevos de golpe —`replace`— que pueden venir del otro modo.
 *
 * **Y no puede ser un efecto de React.** Un efecto corre después de pintar, y
 * para entonces el lienzo ya ha intentado leer los grados viejos y ha lanzado.
 * Los avisos de Zustand se reparten dentro del propio `set`, antes de que React
 * vuelva a pintar, así que cuando llega el repintado el montaje ya está
 * traducido. El efecto de aquí solo sirve para apuntarse y desapuntarse.
 */
const modoDe = (estado: SessionState): 'major' | 'minor' | null =>
  selectActiveKey(estado)?.mode ?? null;

function ponerlo(modo: 'major' | 'minor' | null): void {
  if (modo === null) {
    return;
  }
  // `keepMode` devuelve el mismo montaje cuando no hay nada que traducir, así
  // que llamarlo de más no gasta un paso del deshacer ni repinta a nadie.
  useArrangementStore.getState().actions.keepMode(modo);
}

/**
 * Deja la vigilancia puesta y devuelve cómo quitarla.
 *
 * Fuera de un componente para poder probarla sin montar React, que es lo que
 * pedía `core/`: aquí no hay ventana que haga falta.
 */
export function vigilarElModoDelMontaje(): () => void {
  ponerlo(modoDe(useSessionStore.getState()));

  const dejarLaTonalidad = useSessionStore.subscribe((estado, anterior) => {
    const ahora = modoDe(estado);
    if (ahora !== modoDe(anterior)) {
      ponerlo(ahora);
    }
  });

  const dejarElMontaje = useArrangementStore.subscribe((estado, anterior) => {
    if (estado.arrangement !== anterior.arrangement) {
      ponerlo(modoDe(useSessionStore.getState()));
    }
  });

  return () => {
    dejarLaTonalidad();
    dejarElMontaje();
  };
}

/** Lo mismo, para una pantalla que pinta el montaje. */
export function useMontajeEnSuModo(): void {
  useEffect(() => vigilarElModoDelMontaje(), []);
}
