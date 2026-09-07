'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  blocksInOrder,
  playbackStepsOf,
  scheduleProgression,
  type Arrangement,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import { WebAudioProgressionPlayer, type ProgressionPlayer } from '@audio/progression-player';

/**
 * Oír el montaje, y saber por qué bloque va.
 *
 * Es el mismo motor que usan las salidas —`scheduleProgression` y
 * `progression-player`— con una diferencia: allí lo que suena es una lista de
 * compases y aquí es un montaje con partes, así que hay que traducir el índice
 * que devuelve el reproductor al bloque que está sonando. Esa traducción sale de
 * `blocksInOrder`, que recorre el montaje igual que `playbackStepsOf`, para que
 * los dos índices no puedan descuadrarse.
 *
 * El `AudioContext` se crea al primer play y no antes: un contexto abierto sin
 * pulsar nada lo bloquea el navegador, y además gasta batería en una pantalla
 * donde se puede estar solo mirando.
 */
export interface ArrangementPlayback {
  /** Qué parte suena, o nulo si es el montaje entero. Nulo también si no suena. */
  readonly playingPartId: string | null;
  readonly playing: boolean;
  /** El bloque encendido ahora mismo. */
  readonly currentBlockId: string | null;
  /** Suena eso; si ya sonaba lo mismo, se calla. */
  toggle(partId: string | null): void;
  stop(): void;
}

export function useArrangementPlayer(
  arrangement: Arrangement,
  tonic: PitchClass | null,
  mode: KeyMode,
  bpm: number,
  createPlayer?: () => ProgressionPlayer,
): ArrangementPlayback {
  const [playing, setPlaying] = useState(false);
  const [playingPartId, setPlayingPartId] = useState<string | null>(null);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);

  const playerRef = useRef<ProgressionPlayer | null>(null);
  const factoryRef = useRef(createPlayer);
  useEffect(() => {
    factoryRef.current = createPlayer;
  });

  // Al salir de la pantalla se calla y se suelta el contexto. Sin esto, cambiar
  // de pantalla en mitad de una canción la deja sonando por detrás.
  useEffect(() => {
    return () => {
      void playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stop();
    setPlaying(false);
    setPlayingPartId(null);
    setCurrentBlockId(null);
  }, []);

  const toggle = useCallback(
    (partId: string | null) => {
      if (tonic === null) {
        return;
      }
      // El mismo botón para sonar y para callar: escuchando dos partes seguidas,
      // lo que se quiere hacer con la que suena es cortarla.
      if (playing && playingPartId === partId) {
        stop();
        return;
      }

      const pasos = playbackStepsOf(arrangement, tonic, mode, partId);
      if (pasos.length === 0) {
        return;
      }

      const orden = blocksInOrder(arrangement, partId);
      playerRef.current ??= factoryRef.current?.() ?? new WebAudioProgressionPlayer();

      setPlaying(true);
      setPlayingPartId(partId);
      setCurrentBlockId(orden[0]?.blockId ?? null);

      void playerRef.current.play(scheduleProgression(pasos, bpm), (step) => {
        if (step === null) {
          setPlaying(false);
          setPlayingPartId(null);
          setCurrentBlockId(null);
        } else {
          setCurrentBlockId(orden[step]?.blockId ?? null);
        }
      });
    },
    [arrangement, bpm, mode, playing, playingPartId, stop, tonic],
  );

  return { playing, playingPartId, currentBlockId, toggle, stop };
}
