'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  scheduleEvents,
  soundOf,
  type Arrangement,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import { WebAudioProgressionPlayer, type ProgressionPlayer } from '@audio/progression-player';

/**
 * Oír el montaje, y saber por qué bloque va.
 *
 * Es el mismo reproductor que usan las salidas, con dos diferencias. La primera:
 * aquí suena un montaje con partes, así que hay que traducir el índice que
 * devuelve el reproductor al bloque encendido, y esa traducción la da `soundOf`
 * junto a los sonidos para que no puedan descuadrarse.
 *
 * La segunda es el punteo. Las notas van **en la misma lista** que los acordes y
 * no en un segundo reproductor: dos `AudioContext` tienen dos relojes, y unos
 * milisegundos entre el acorde y la nota se oyen como un golpe doble. Cuando lo
 * que suena es una nota, el bloque encendido no cambia —su dueño es nulo— en vez
 * de apagarse, que es lo que haría parpadear el cabezal en cada corchea.
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
  /** Si suena también el punteo, o solo el acompañamiento. */
  withMelody = true,
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

      const { events, owners } = soundOf(arrangement, tonic, mode, partId, withMelody);
      if (events.length === 0) {
        return;
      }

      playerRef.current ??= factoryRef.current?.() ?? new WebAudioProgressionPlayer();

      setPlaying(true);
      setPlayingPartId(partId);
      setCurrentBlockId(owners.find((dueño) => dueño !== null) ?? null);

      void playerRef.current.play(scheduleEvents(events, bpm), (step) => {
        if (step === null) {
          setPlaying(false);
          setPlayingPartId(null);
          setCurrentBlockId(null);
          return;
        }
        const dueño = owners[step];
        if (dueño !== null && dueño !== undefined) {
          setCurrentBlockId(dueño);
        }
      });
    },
    [arrangement, bpm, mode, playing, playingPartId, stop, tonic, withMelody],
  );

  return { playing, playingPartId, currentBlockId, toggle, stop };
}
