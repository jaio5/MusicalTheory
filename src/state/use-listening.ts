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
 * **El micrófono es uno, y por eso lo que lo sujeta vive en el módulo y no en el
 * componente.** Esto no era así, y de ahí salía un fallo que se veía en un
 * navegador de verdad: en `/afinar` hay dos botones que abren el micro —el
 * grande del afinador y el de la barra de arriba—, cada uno con su propia copia
 * de estas referencias, y el estado de sesión es uno solo para los dos. Al
 * arrancar desde el afinador, el de la barra se pintaba encendido; al pulsarlo
 * para pararlo, llamaba a *su* `stop`, que no tenía nada abierto: ponía el
 * estado en «sin escuchar», el afinador volvía a su pantalla de arranque… **y el
 * micrófono seguía abierto**, con el piloto del navegador encendido y el motor
 * analizando. En una aplicación cuya primera promesa es que el audio no sale de
 * aquí, un micro que no se cierra cuando dices que lo has cerrado es el peor
 * fallo posible.
 *
 * Con el recurso en el módulo, `start` y `stop` son los mismos para todos: da
 * igual desde qué botón se pulse. Que sea único ya estaba medio reconocido —
 * `entradaSonando` llevaba aquí desde que las salidas necesitaron la entrada
 * abierta—; lo que faltaba era llevarse el resto con ella.
 *
 * Las dependencias entran por parámetro porque en React no hay contenedor de
 * inyección: quien quiera otro motor —un test, o mañana YIN— pasa otra fábrica.
 * Las usa **quien arranca**, que es quien decide con qué se escucha.
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

/**
 * La entrada que está escuchando ahora mismo, si la hay.
 *
 * Referencia de módulo y no estado de React porque **el micro es uno**: no hay
 * dos entradas a la vez ni tendría sentido que las hubiera. La necesita quien
 * quiere guardar el sonido para estudiarlo después —el panel de salidas— y ese
 * está en otra rama del árbol, así que pasarla por props sería atravesar media
 * aplicación con algo que ya es único.
 */
let entradaSonando: AudioInput | null = null;

/** El motor de tono y el de acordes que cuelgan de esa entrada, si los hay. */
let motorSonando: PitchEngine | null = null;
let motorDeAcordes: ChordEngine | null = null;
let dejarDeMirarElEstado: (() => void) | null = null;

/**
 * Cuántos componentes tienen el gancho montado.
 *
 * Se cuenta porque el micro ya no lo cierra el componente que se va: si lo
 * hiciera, salir del afinador cerraría el micro que había abierto el botón de la
 * barra, que vive en el marco y no se desmonta nunca. Se cierra cuando **no
 * queda nadie**, que es lo que pasa al recargar en caliente o al cerrar la
 * pestaña, y es de lo que protegía el efecto de limpieza original.
 */
let montados = 0;

/** La entrada abierta, o nula si el micro está cerrado. */
export function entradaActiva(): AudioInput | null {
  return entradaSonando;
}

/** Suelta el aparato sin tocar el estado de la interfaz. */
async function soltarLoAbierto(): Promise<void> {
  motorSonando?.stop();
  motorSonando = null;

  motorDeAcordes?.stop();
  motorDeAcordes = null;

  dejarDeMirarElEstado?.();
  dejarDeMirarElEstado = null;

  const entrada = entradaSonando;
  entradaSonando = null;
  await entrada?.stop();
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

  const stop = useCallback(async () => {
    await soltarLoAbierto();

    actions.setHeardChord(null);
    actions.setPitch(null);
    actions.setListening('idle');
  }, [actions]);

  const start = useCallback(
    async (deviceId?: string) => {
      if (entradaSonando !== null) {
        return;
      }

      const input =
        factories.current.createInput?.(deviceId) ??
        new WebAudioInput(deviceId === undefined ? {} : { deviceId });
      entradaSonando = input;
      dejarDeMirarElEstado = input.subscribe((state) => {
        actions.setListening(LISTENING_BY_INPUT_STATE[state], input.error?.message ?? null);
      });

      actions.setListening('requesting');
      await input.start();

      if (input.state !== 'running') {
        // El permiso se ha denegado o el dispositivo ha fallado: el mensaje ya lo
        // ha puesto la suscripción, aquí solo hay que soltar lo abierto.
        dejarDeMirarElEstado?.();
        dejarDeMirarElEstado = null;
        entradaSonando = null;
        return;
      }

      const engine = factories.current.createEngine?.() ?? new AutocorrelationPitchEngine();
      motorSonando = engine;
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
        motorDeAcordes = chordEngine;
        chordEngine.subscribe((chord) => {
          actions.setHeardChord(
            chord === null
              ? null
              : {
                  symbol: chord.best.symbol,
                  root: chord.best.root,
                  notes: chord.best.notes,
                  score: chord.best.score,
                  margin: chord.margin,
                  alternatives: chord.alternatives.map((otra) => ({
                    symbol: otra.symbol,
                    root: otra.root,
                    notes: otra.notes,
                    score: otra.score,
                  })),
                  at: performance.now(),
                },
          );
        });
        await chordEngine.start(input);
      }
    },
    [actions],
  );

  // Un micrófono abierto es un recurso, y en React el sitio de soltarlo es el
  // return de un efecto. Sin esto, recargar en caliente deja capturas colgadas.
  //
  // Lo que cambia respecto a antes es **cuándo**: no al irse un componente, sino
  // al irse el último. Salir del afinador no puede cerrar el micro que abrió el
  // botón de la barra, que vive en el marco y sigue ahí.
  useEffect(() => {
    montados += 1;
    return () => {
      montados -= 1;
      if (montados === 0) {
        void soltarLoAbierto();
      }
    };
  }, []);

  return { start, stop };
}
