'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import { AutocorrelationPitchEngine } from '@audio/autocorrelation-pitch-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import { WebAudioInput } from '@audio/web-audio-input';
import { useSessionStore, type ListeningState } from '@state/session-store';

/**
 * Las dependencias entran por parámetro porque en React no hay contenedor de
 * inyección: quien quiera otro motor —un test, o mañana YIN— pasa otra fábrica.
 */
export interface TunerDeps {
  readonly createInput?: () => AudioInput;
  readonly createEngine?: () => PitchEngine;
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

export interface TunerControls {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function useTuner({ createInput, createEngine }: TunerDeps = {}): TunerControls {
  const actions = useSessionStore((state) => state.actions);

  // Las fábricas viven en una ref y no en las dependencias de useCallback: si
  // el componente pasa funciones nuevas en cada render —lo normal con una
  // función anónima— las dependencias cambiarían siempre, y el efecto de
  // limpieza cerraría el micrófono en cada render.
  //
  // La ref se actualiza en un efecto, no durante el render: escribir en una ref
  // mientras se renderiza rompe las garantías de React y lo avisa el linter.
  // Para cuando alguien pulse el botón, el efecto ya ha corrido.
  const factories = useRef({ createInput, createEngine });
  useEffect(() => {
    factories.current = { createInput, createEngine };
  });

  const inputRef = useRef<AudioInput | null>(null);
  const engineRef = useRef<PitchEngine | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stop = useCallback(async () => {
    engineRef.current?.stop();
    engineRef.current = null;

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    const input = inputRef.current;
    inputRef.current = null;
    await input?.stop();

    actions.setPitch(null);
    actions.setListening('idle');
  }, [actions]);

  const start = useCallback(async () => {
    if (inputRef.current !== null) {
      return;
    }

    const input = factories.current.createInput?.() ?? new WebAudioInput();
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
    engine.subscribe((sample) => {
      actions.setPitch(sample?.frequency ?? null, sample?.clarity ?? 0);
    });
    await engine.start(input);
  }, [actions]);

  // Un micrófono abierto es un recurso, y en React el sitio de cerrarlo es el
  // return del efecto. Sin esto, recargar en caliente deja capturas colgadas.
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      unsubscribeRef.current?.();
      void inputRef.current?.stop();
      engineRef.current = null;
      unsubscribeRef.current = null;
      inputRef.current = null;
    };
  }, []);

  return { start, stop };
}
