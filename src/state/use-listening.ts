'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import { AutocorrelationPitchEngine } from '@audio/autocorrelation-pitch-engine';
import type { ChordEngine } from '@audio/chord-engine';
import { ChromaChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import { WebAudioInput } from '@audio/web-audio-input';
import { useSessionStore, type ListeningState } from './session-store';

/**
 * Conecta la captura de audio con el estado de sesión.
 *
 * Vive en state/ y no dentro del afinador porque lo usan dos sitios: el panel
 * del afinador y el botón de escuchar de la barra. Un feature no puede importar
 * de otro, así que lo compartido sube aquí.
 *
 * Las dependencias entran por parámetro porque en React no hay contenedor de
 * inyección: quien quiera otro motor —un test, o mañana YIN— pasa otra fábrica.
 */
export interface ListeningDeps {
  readonly createInput?: (deviceId?: string) => AudioInput;
  readonly createEngine?: () => PitchEngine;
  /**
   * Si además de notas se reconocen acordes. Solo lo pide componer: el afinador
   * afina cuerda a cuerda, y analizar el espectro para nada sería gastar batería
   * por gusto.
   */
  readonly chords?: boolean;
  readonly createChordEngine?: () => ChordEngine;
}

/** El estado del dispositivo no es el estado de la interfaz: aquí se traduce. */
const LISTENING_BY_INPUT_STATE: Record<AudioInputState, ListeningState> = {
  idle: 'idle',
  requesting: 'requesting',
  running: 'listening',
  denied: 'denied',
  unsupported: 'unsupported',
  error: 'error',
};

export interface ListeningControls {
  /** Arranca la escucha, opcionalmente en una entrada concreta. */
  start(deviceId?: string): Promise<void>;
  stop(): Promise<void>;
}

export function useListening({
  createInput,
  createEngine,
  chords = false,
  createChordEngine,
}: ListeningDeps = {}): ListeningControls {
  const actions = useSessionStore((state) => state.actions);

  // Las fábricas viven en una ref y no en las dependencias de useCallback: si
  // el componente pasa funciones nuevas en cada render —lo normal con una
  // función anónima— las dependencias cambiarían siempre, y el efecto de
  // limpieza cerraría el micrófono en cada render.
  //
  // La ref se actualiza en un efecto, no durante el render: escribir en una ref
  // mientras se renderiza rompe las garantías de React y lo avisa el linter.
  // Para cuando alguien pulse el botón, el efecto ya ha corrido.
  const factories = useRef({ createInput, createEngine, chords, createChordEngine });
  useEffect(() => {
    factories.current = { createInput, createEngine, chords, createChordEngine };
  });

  const inputRef = useRef<AudioInput | null>(null);
  const engineRef = useRef<PitchEngine | null>(null);
  const chordEngineRef = useRef<ChordEngine | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stop = useCallback(async () => {
    engineRef.current?.stop();
    engineRef.current = null;

    chordEngineRef.current?.stop();
    chordEngineRef.current = null;
    actions.setHeardChord(null);

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    const input = inputRef.current;
    inputRef.current = null;
    await input?.stop();

    actions.setPitch(null);
    actions.setListening('idle');
  }, [actions]);

  const start = useCallback(
    async (deviceId?: string) => {
      if (inputRef.current !== null) {
        return;
      }

      const input =
        factories.current.createInput?.(deviceId) ??
        new WebAudioInput(deviceId === undefined ? {} : { deviceId });
      inputRef.current = input;
      unsubscribeRef.current = input.subscribe((state) => {
        actions.setListening(LISTENING_BY_INPUT_STATE[state], input.error?.message ?? null);
      });

      actions.setListening('requesting');
      await input.start();

      if (input.state !== 'running') {
        // El permiso se ha denegado o el dispositivo ha fallado: el mensaje ya lo
        // ha puesto la suscripción, aquí solo hay que soltar lo abierto.
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        inputRef.current = null;
        return;
      }

      const engine = factories.current.createEngine?.() ?? new AutocorrelationPitchEngine();
      engineRef.current = engine;
      engine.subscribeLevel((rms) => actions.setLevel(rms));
      engine.subscribe((sample) => {
        actions.setPitch(
          sample?.frequency ?? null,
          sample?.clarity ?? 0,
          sample?.at ?? 0,
          sample?.rms,
        );
      });
      await engine.start(input);

      if (factories.current.chords === true) {
        const chordEngine = factories.current.createChordEngine?.() ?? new ChromaChordEngine();
        chordEngineRef.current = chordEngine;
        chordEngine.subscribe((chord) => {
          actions.setHeardChord(
            chord === null
              ? null
              : {
                  symbol: chord.symbol,
                  root: chord.root,
                  notes: chord.notes,
                  score: chord.score,
                  at: performance.now(),
                },
          );
        });
        await chordEngine.start(input);
      }
    },
    [actions],
  );

  // Un micrófono abierto es un recurso, y en React el sitio de cerrarlo es el
  // return del efecto. Sin esto, recargar en caliente deja capturas colgadas.
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      chordEngineRef.current?.stop();
      unsubscribeRef.current?.();
      void inputRef.current?.stop();
      engineRef.current = null;
      chordEngineRef.current = null;
      unsubscribeRef.current = null;
      inputRef.current = null;
    };
  }, []);

  return { start, stop };
}
