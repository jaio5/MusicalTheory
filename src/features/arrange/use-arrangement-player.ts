'use client';

import { useCallback, useState } from 'react';
import { useProgressionPlayer } from '@state/use-progression-player';

import {
  scheduleEvents,
  soundOf,
  type Arrangement,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import type { ProgressionPlayer } from '@audio/progression-player';

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

  const { pedir, parar } = useProgressionPlayer(createPlayer);

  const stop = useCallback(() => {
    parar();
    setPlaying(false);
    setPlayingPartId(null);
    setCurrentBlockId(null);
    // `pedir` y `parar` no cambian entre renders: los memoriza
    // `useProgressionPlayer`. Van en la lista para que ESLint pueda comprobarlo.
  }, [parar]);

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

      const player = pedir();

      setPlaying(true);
      setPlayingPartId(partId);
      setCurrentBlockId(owners.find((dueño) => dueño !== null) ?? null);

      void player.play(scheduleEvents(events, bpm), (step) => {
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
    [arrangement, bpm, mode, pedir, playing, playingPartId, stop, tonic, withMelody],
  );

  return { playing, playingPartId, currentBlockId, toggle, stop };
}
