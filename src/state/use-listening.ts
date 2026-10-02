'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import { useSessionStore, type ListeningState, type SessionActions } from './session-store';

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
 *
 * **Y el micro abierto sigue abierto al cambiar de pantalla**, porque lo que lo
 * abre de verdad es el botón de la barra, y la barra no se va: el marco común
 * vive en el layout de `(marco)`, no en cada página. Quien abre el micro en
 * `/afinar` y se va a `/aprender` a hacer una unidad de oído espera seguir
 * oyéndose, y el piloto de la barra sigue diciendo que escucha y sigue siendo
 * el botón que lo cierra. Lo que no puede pasar es lo que pasaba: cada página
 * montaba su propio marco, al navegar se desmontaba, **el micro se cerraba y la
 * barra seguía encendida**, y el primer clic en ella no paraba nada.
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
 * Cuántas veces se ha soltado lo abierto.
 *
 * Es lo que dice si un arranque **sigue siendo de alguien**. Abrir el micro
 * espera varias veces —a descargar los motores, a que el navegador conteste el
 * permiso, a que arranque el análisis— y entretanto puede pasar que se pare, o
 * que se vaya el último que lo tenía montado. Antes de esto el arranque seguía
 * igual al volver de la espera: con el permiso tardando tres segundos y un
 * cambio de pantalla en medio, la pista quedaba viva, sin dueño y con la barra
 * apagada y sin manera de cerrarla. Ahora cada espera mira si la vuelta es la
 * misma con la que empezó, y si no, suelta lo suyo y se va.
 */
let vuelta = 0;

/**
 * La vuelta del arranque que está a medias, o nula si no hay ninguno.
 *
 * Una vuelta y no un sí o un no: un arranque que se ha quedado sin dueño
 * —esperando el permiso cuando se fue la pantalla— no puede impedir el
 * siguiente. Solo estorba el que sigue siendo de la vuelta de ahora.
 */
let arrancandoEn: number | null = null;

/**
 * Cuántos componentes tienen el gancho montado.
 *
 * Se cuenta porque el micro ya no lo cierra el componente que se va: si lo
 * hiciera, salir del afinador cerraría el micro que había abierto el botón de la
 * barra, que vive en el marco y no se desmonta al navegar. Se cierra cuando **no
 * queda nadie** —al recargar en caliente, al ir a la portada, que no lleva el
 * marco— y entonces **la interfaz también lo dice**: cerrar el aparato y dejar
 * el estado en «escuchando» era el piloto encendido de un micro apagado.
 */
let montados = 0;

/** La entrada abierta, o nula si el micro está cerrado. */
export function entradaActiva(): AudioInput | null {
  return entradaSonando;
}

/**
 * El motor de tono que está escuchando, o nulo si no hay ninguno.
 *
 * Lo pide la toma para apuntarse a **cada análisis** (`subscribeFrames`) mientras
 * se toca: el historial de la sesión guarda las veinticuatro últimas notas, y una
 * toma de punteo entera no cabe ahí. Es el mismo motor, no uno nuevo: el micro
 * es uno y el análisis también.
 */
export function motorDeTonoActivo(): PitchEngine | null {
  return motorSonando;
}

/** Suelta el aparato sin tocar el estado de la interfaz. */
async function soltarLoAbierto(): Promise<void> {
  // Lo primero: un arranque que esté esperando ya sabe, al volver, que no es suyo.
  vuelta += 1;

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

/**
 * Los motores de la aplicación, **descargados al pulsar y no al cargar**.
 *
 * El gancho lo monta la barra, y la barra está en todas las pantallas: con los
 * `import` de arriba, el análisis de tono, el croma y la entrada de Web Audio
 * viajaban a `/planes`, a `/cuenta` y a `/profesor`, donde no se escucha nada
 * hasta que alguien pulsa el micro. Aquí llegan cuando se pulsa, que es cuando
 * hacen falta, y el navegador ya los guarda para la vez siguiente.
 *
 * Solo en el camino de casa: quien pasa sus fábricas —los tests— no descarga
 * nada.
 */
async function crearEntradaDeCasa(deviceId?: string): Promise<AudioInput> {
  const { WebAudioInput } = await import('@audio/web-audio-input');
  return new WebAudioInput(deviceId === undefined ? {} : { deviceId });
}

async function crearMotorDeCasa(): Promise<PitchEngine> {
  const { AutocorrelationPitchEngine } = await import('@audio/autocorrelation-pitch-engine');
  return new AutocorrelationPitchEngine();
}

async function crearMotorDeAcordesDeCasa(): Promise<ChordEngine> {
  const { ChromaChordEngine } = await import('@audio/chord-engine');
  return new ChromaChordEngine();
}

/** Lo que el motor de acordes reconoce, dicho como lo guarda la sesión. */
function oirAcordes(motor: ChordEngine, actions: SessionActions): void {
  motor.subscribe((chord) => {
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

  /**
   * Pone a escuchar acordes sobre la entrada que ya hay.
   *
   * Hace falta porque el micro ya no se cierra al cambiar de pantalla: abierto
   * en `/afinar`, que no pide acordes, seguía abierto en `/componer`, y la toma
   * que lo pedía prestado se encontraba sin croma y no escribía ni un acorde.
   */
  const anadirAcordes = useCallback(
    async (input: AudioInput, mia: number): Promise<void> => {
      const chordEngine = await (factories.current.createChordEngine?.() ??
        crearMotorDeAcordesDeCasa());
      if (vuelta !== mia) {
        // Se ha parado mientras se descargaba: este motor no llegó a escuchar
        // nada y se queda sin arrancar.
        return;
      }
      motorDeAcordes = chordEngine;
      oirAcordes(chordEngine, actions);
      await chordEngine.start(input);
      if (vuelta !== mia) {
        // Parado mientras arrancaba: `soltarLoAbierto` ya lo paró, pero arrancar
        // después de parar lo habría dejado en marcha.
        chordEngine.stop();
      }
    },
    [actions],
  );

  /**
   * Abre el micro, o añade lo que falte al que ya está abierto.
   *
   * **Después de cada espera se mira si el arranque sigue siendo de alguien**
   * (`vuelta`), y si no, se suelta lo que haya abierto él y se va. Cada `await`
   * es un hueco por el que puede entrar un «parar» o un cambio de pantalla.
   *
   * Las fábricas se esperan siempre, devuelvan o no una promesa: así el camino
   * de casa, que descarga, y el de los tests, que no, son el mismo.
   */
  const start = useCallback(
    async (deviceId?: string) => {
      if (arrancandoEn === vuelta) {
        return;
      }
      const mia = vuelta;
      arrancandoEn = mia;
      try {
        if (entradaSonando !== null) {
          if (
            factories.current.chords === true &&
            motorDeAcordes === null &&
            entradaSonando.state === 'running'
          ) {
            await anadirAcordes(entradaSonando, mia);
          }
          return;
        }

        // «Pidiendo» desde el primer instante: descargar los motores tarda, y el
        // botón tiene que contestar al dedo antes de que lleguen.
        actions.setListening('requesting');

        const input = await (factories.current.createInput?.(deviceId) ??
          crearEntradaDeCasa(deviceId));
        if (vuelta !== mia) {
          // Se paró mientras se descargaba: todavía no se ha pedido nada.
          return;
        }

        entradaSonando = input;
        dejarDeMirarElEstado = input.subscribe((state) => {
          actions.setListening(LISTENING_BY_INPUT_STATE[state], input.error?.message ?? null);
        });

        await input.start();

        if (vuelta !== mia) {
          // **El permiso llegó tarde y ya no es de nadie.** Lo que lo esperaba se
          // fue —otra pantalla, o un «parar»— y ya soltó lo abierto, pero el
          // navegador contesta después y entrega una pista viva. Se cierra aquí,
          // que es el único sitio que todavía la tiene.
          await input.stop();
          return;
        }

        if (input.state !== 'running') {
          // El permiso se ha denegado o el dispositivo ha fallado: el mensaje ya lo
          // ha puesto la suscripción, aquí solo hay que soltar lo abierto.
          dejarDeMirarElEstado?.();
          dejarDeMirarElEstado = null;
          entradaSonando = null;
          return;
        }

        const engine = await (factories.current.createEngine?.() ?? crearMotorDeCasa());
        if (vuelta !== mia) {
          return;
        }
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
        if (vuelta !== mia) {
          engine.stop();
          return;
        }

        if (factories.current.chords === true) {
          await anadirAcordes(input, mia);
        }
      } catch {
        // Lo que más fácil falla aquí es la descarga de los motores —sin red, o
        // con una versión nueva publicada a mitad de sesión—. Sin esto el botón
        // se quedaba en «pidiendo» para siempre, desactivado y sin decir nada.
        //
        // Si ya no es su vuelta, lo que tenía abierto lo soltó quien la cambió, y
        // lo de ahora es de otro arranque: no se toca.
        if (vuelta !== mia) {
          return;
        }
        await soltarLoAbierto();
        actions.setHeardChord(null);
        actions.setPitch(null);
        actions.setListening(
          'error',
          'No he podido preparar la escucha. Recarga la página y vuelve a probar.',
        );
      } finally {
        if (arrancandoEn === mia) {
          arrancandoEn = null;
        }
      }
    },
    [actions, anadirAcordes],
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
        // Y la interfaz en reposo, como al parar: lo que se oía ya no suena.
        // Sin esto, lo siguiente que se montara leería «escuchando» de un micro
        // cerrado.
        actions.setHeardChord(null);
        actions.setPitch(null);
        actions.setListening('idle');
      }
    };
  }, [actions]);

  return { start, stop };
}
