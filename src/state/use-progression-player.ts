'use client';

import { useCallback, useEffect, useRef } from 'react';

import { WebAudioProgressionPlayer, type ProgressionPlayer } from '@audio/progression-player';

/**
 * El reproductor de progresiones, montado como hay que montarlo.
 *
 * Tres sitios lo usan —el camino de acordes, las salidas y el lienzo de montar—
 * y los tres tenían escritas las mismas quince líneas. No es que fueran muchas:
 * es que **eran las que se olvidan**, y las tres cosas que hacen no se ven
 * leyéndolas.
 *
 * - **Se crea tarde.** Un `AudioContext` construido al montar el componente nace
 *   suspendido por la política de autoreproducción del navegador: hay que
 *   crearlo dentro de la pulsación que lo va a usar. Por eso esto devuelve una
 *   función que lo pide y no el reproductor ya hecho.
 * - **Se suelta al irse.** Sin el `dispose` del desmontaje, cambiar de pantalla
 *   en mitad de una progresión la deja sonando por detrás, sin nada en la
 *   interfaz que la calle.
 * - **La fábrica vive en una referencia.** Los tests inyectan un reproductor
 *   falso con una función anónima, que es nueva en cada render; metida en las
 *   dependencias de un efecto, la limpieza cerraría el audio en cada render.
 *
 * Vive en `state/` y no en un feature porque lo usan tres que no se conocen
 * entre sí, que es la misma razón por la que `use-listening` está aquí.
 */
export interface Reproductor {
  /** El reproductor, creándolo si es la primera vez que hace falta. */
  readonly pedir: () => ProgressionPlayer;
  /**
   * Lo calla si lo había, y **no crea nada si no lo había**.
   *
   * Parar lo que no suena no puede abrir el audio: es lo que pasaría con un solo
   * método que creara siempre, y significaría que entrar en una pantalla y
   * pulsar «parar» pide el permiso de sonido para nada.
   */
  readonly parar: () => void;
}

export function useProgressionPlayer(createPlayer?: () => ProgressionPlayer): Reproductor {
  const playerRef = useRef<ProgressionPlayer | null>(null);

  const factoryRef = useRef(createPlayer);
  useEffect(() => {
    factoryRef.current = createPlayer;
  });

  useEffect(() => {
    return () => {
      void playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const pedir = useCallback((): ProgressionPlayer => {
    playerRef.current ??= factoryRef.current?.() ?? new WebAudioProgressionPlayer();
    return playerRef.current;
  }, []);

  const parar = useCallback((): void => {
    playerRef.current?.stop();
  }, []);

  return { pedir, parar };
}
