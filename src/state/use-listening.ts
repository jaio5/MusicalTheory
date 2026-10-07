'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import { listAudioInputDevices, pistaDe, vigilarEntradas } from '@audio/entradas-de-audio';
import type { PitchEngine } from '@audio/pitch-engine';

import { useClaqueta } from './claqueta';
import { microfonoElegido, nombreDeLaEntrada, useMicrofono } from './microfono';
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
  /**
   * Arranca la escucha. Sin entrada, en la elegida (`state/microfono.ts`); si la
   * pedida no está conectada, en la del sistema, y lo dice.
   */
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

/**
 * Con qué se abrió la entrada que suena, para abrir la siguiente igual.
 *
 * Cambiar de micro en caliente lo pide el mando de la barra, que no es quien
 * arrancó: sin esto, una escucha abierta con la entrada de un test se cambiaría
 * por una de verdad.
 */
let fabricaDeLaEntrada: ListeningDeps['createInput'];

/** Si alguien eligió otro micro mientras el de ahora se estaba abriendo. */
let cambiarAlAcabarDeAbrir = false;

/**
 * El aparato que se pidió para la entrada que suena: `undefined`, el del sistema.
 * Elegir mientras se abre puede llegar antes de que se mire cuál pedir, y
 * entonces lo que se abre ya es lo elegido: volver a abrirlo sería otro permiso
 * y otro piloto para nada.
 */
let pedidoDeLaQueSuena: string | undefined;

/** Deja de mirar si la toma ha acabado, si se estaba mirando. */
let dejarDeEsperarLaToma: (() => void) | null = null;

/** Vuelve a mirar si la toma ha acabado, para quien suelta la entrada. */
let mirarSiAcaboLaToma: (() => void) | null = null;

/**
 * Cuántas tomas tienen la entrada sujeta, de principio a fin.
 *
 * La claqueta y la captura no bastan para saber si hay una toma: al parar, la
 * toma las suelta antes de que el grabador acabe —cerrar la claqueta es
 * asíncrono— y en «solo grabar» la captura se marca después de empezar a
 * grabar. En esos huecos un cambio de micro abría un segundo `getUserMedia` con
 * el grabador aún sobre la entrada vieja.
 */
let sujeciones = 0;

/**
 * **La toma sujeta la entrada mientras graba**, y el cambio de micro espera.
 * Devuelve con qué soltarla, que se puede llamar más de una vez.
 */
export function sujetarLaEntrada(): () => void {
  sujeciones += 1;
  let suelta = false;
  return () => {
    if (suelta) {
      return;
    }
    suelta = true;
    sujeciones -= 1;
    mirarSiAcaboLaToma?.();
  };
}

/** Deja de mirar si se conectan o desconectan entradas. */
let dejarDeVigilarLasEntradas: (() => void) | null = null;

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

/**
 * **Si hay una toma en marcha**, contando la cuenta: la de componer y la de
 * ensayar marcan la claqueta, y «solo grabar» y las salidas, la captura.
 */
function hayToma(): boolean {
  return sujeciones > 0 || useClaqueta.getState().enLaToma || useSessionStore.getState().capturing;
}

/** Vuelve a pedir la lista de entradas, que con permiso ya trae los nombres. */
export async function ponerAlDiaLasEntradas(): Promise<void> {
  useMicrofono.getState().acciones.ponerEntradas(await listAudioInputDevices());
}

/**
 * Qué aparato pedir, sabiendo lo que hay conectado.
 *
 * Si el navegador ya da la lista —con permiso— y el elegido no está, se va
 * directo al del sistema: pedir uno que no existe es un fallo de
 * `getUserMedia` que se vería un instante. Sin permiso la lista no trae
 * identificadores y no se sabe; entonces se prueba, y si falla se cae igual.
 */
async function queAparatoPedir(
  explicito: string | undefined,
): Promise<{ readonly pedido: string | undefined; readonly cayo: boolean }> {
  if (explicito === undefined && microfonoElegido() === null) {
    return { pedido: undefined, cayo: false };
  }
  // La lista primero: con ella, un elegido que cambió de identificador se
  // reconoce por el nombre (`state/microfono.ts`).
  await ponerAlDiaLasEntradas();
  const { entradas, elegido } = useMicrofono.getState();
  const pedido = explicito ?? elegido!;
  if (entradas.length > 0 && !entradas.some((entrada) => entrada.id === pedido)) {
    return { pedido: undefined, cayo: true };
  }
  return { pedido, cayo: false };
}

const DICE_QUE_CAYO = 'El micrófono elegido no está conectado: escucho por el del sistema.';

/** Lo que se dice al quedar abierta una entrada: si cayó al del sistema, y si no. */
function contarComoQuedo(cayo: boolean, frase: string | null): void {
  const { acciones } = useMicrofono.getState();
  acciones.marcarCaida(cayo);
  if (cayo) {
    acciones.anunciar(DICE_QUE_CAYO);
  } else if (frase !== null) {
    acciones.anunciar(frase);
  }
}

/**
 * **Elige otro micrófono, y si está escuchando, lo cambia ya.**
 *
 * Con el micro cerrado solo se guarda: la próxima vez se abre ése. Abierto, se
 * cambia en caliente (`cambiarEnCaliente`) **salvo durante una toma**, que espera
 * a que acabe. La toma graba el flujo del aparato que hay
 * (`audio/stream-source.ts`), y un `MediaRecorder` no cambia de pista a mitad: al
 * cerrar la vieja, el sonido grabado se acabaría ahí. Y lo transcrito tampoco
 * saldría igual: el nivel de dos micrófonos no se parece, y el salto se leería
 * como un ataque que nadie tocó.
 */
export async function cambiarDeMicro(id: string | null): Promise<void> {
  const microfono = useMicrofono.getState();
  microfono.acciones.elegir(id);
  const nombre = nombreDeLaEntrada(id, useMicrofono.getState());

  // Antes que mirar si hay entrada: mientras se abre todavía no la hay —se está
  // eligiendo el aparato o descargando el motor— y el cambio se perdía.
  if (arrancandoEn === vuelta) {
    // Se está abriendo con lo que había elegido antes: al acabar, se cambia.
    cambiarAlAcabarDeAbrir = true;
    return;
  }
  if (entradaSonando === null) {
    microfono.acciones.anunciar(`Micrófono: ${nombre}.`);
    return;
  }
  if (hayToma()) {
    cambiarAlAcabarLaToma();
    return;
  }
  await cambiarEnCaliente(`Micrófono cambiado: ${nombre}.`);
}

/**
 * Deja el cambio apuntado hasta que la toma acabe.
 *
 * La toma acaba cuando **suelta la entrada** (`sujetarLaEntrada`), después de
 * que el grabador pare: cerrar la vieja antes le cortaría el final. Y se aplica
 * en la vuelta siguiente del bucle de eventos, porque justo después de soltarla
 * la toma cierra la escucha que abrió, y cambiar ésa sería abrir un aparato para
 * nada.
 */
function cambiarAlAcabarLaToma(): void {
  useMicrofono.getState().acciones.marcarPendiente(true);
  if (dejarDeEsperarLaToma !== null) {
    return;
  }
  const mirar = () => {
    if (hayToma()) {
      return;
    }
    dejarDeEsperarLaToma?.();
    dejarDeEsperarLaToma = null;
    mirarSiAcaboLaToma = null;
    useMicrofono.getState().acciones.marcarPendiente(false);
    setTimeout(() => {
      const { elegido } = useMicrofono.getState();
      void cambiarEnCaliente(
        `Micrófono cambiado: ${nombreDeLaEntrada(elegido, useMicrofono.getState())}.`,
      );
    }, 0);
  };
  const claqueta = useClaqueta.subscribe(mirar);
  const sesion = useSessionStore.subscribe(mirar);
  mirarSiAcaboLaToma = mirar;
  dejarDeEsperarLaToma = () => {
    claqueta();
    sesion();
    mirarSiAcaboLaToma = null;
  };
}

/**
 * Cambia la entrada abierta por la elegida **sin parar la escucha**.
 *
 * Primero se abre la nueva y solo después se cierra la vieja: si la nueva no se
 * puede abrir, se sigue oyendo por la de antes en vez de quedarse sin nada. Los
 * motores son **los mismos** —se vuelven a arrancar sobre la nueva—, así que
 * quien estaba apuntado a ellos (la sesión, el croma, la toma) no se entera de
 * nada más que de un análisis en blanco.
 *
 * Usa la vuelta como el arranque: si se para a mitad, lo abierto aquí se suelta.
 */
async function cambiarEnCaliente(frase: string): Promise<void> {
  const vieja = entradaSonando;
  if (vieja === null || vieja.state !== 'running' || arrancandoEn === vuelta) {
    return;
  }
  const mia = vuelta;
  arrancandoEn = mia;
  const { actions } = useSessionStore.getState();
  try {
    let { pedido, cayo } = await queAparatoPedir(undefined);
    let nueva: AudioInput | null = null;
    for (;;) {
      if (vuelta !== mia) {
        return;
      }
      const candidata = await (fabricaDeLaEntrada?.(pedido) ?? crearEntradaDeCasa(pedido));
      if (vuelta !== mia) {
        return;
      }
      await candidata.start();
      if (vuelta !== mia) {
        await candidata.stop();
        return;
      }
      if (candidata.state === 'running') {
        nueva = candidata;
        break;
      }
      await candidata.stop();
      if (candidata.state !== 'error' || pedido === undefined) {
        break;
      }
      pedido = undefined;
      cayo = true;
    }

    if (nueva === null) {
      // Ni la elegida ni la del sistema: se sigue con la de antes, que funciona.
      useMicrofono
        .getState()
        .acciones.anunciar('No he podido abrir ese micrófono: sigo con el de antes.');
      return;
    }

    dejarDeMirarElEstado?.();
    entradaSonando = nueva;
    pedidoDeLaQueSuena = pedido;
    const abierta = nueva;
    dejarDeMirarElEstado = nueva.subscribe((state) => {
      actions.setListening(LISTENING_BY_INPUT_STATE[state], abierta.error?.message ?? null);
    });
    for (const motor of [motorSonando, motorDeAcordes]) {
      await motor?.start(abierta);
    }
    await vieja.stop();
    contarComoQuedo(cayo, frase);
  } catch {
    /* v8 ignore next 3 -- si ya no es su vuelta, lo abierto lo soltó quien la cambió */
    if (vuelta !== mia) {
      return;
    }
    await soltarLoAbierto();
    actions.setHeardChord(null);
    actions.setPitch(null);
    actions.setListening(
      'error',
      'No he podido cambiar de micrófono. Vuelve a pulsar el micro para escuchar.',
    );
  } finally {
    if (arrancandoEn === mia) {
      arrancandoEn = null;
      cambiarSiSeEligioOtro();
    }
  }
}

/** Si se eligió otro mientras se abría o se cambiaba, ahora le toca a ése. */
function cambiarSiSeEligioOtro(): void {
  if (!cambiarAlAcabarDeAbrir) {
    return;
  }
  cambiarAlAcabarDeAbrir = false;
  const { elegido } = useMicrofono.getState();
  if ((elegido ?? undefined) === pedidoDeLaQueSuena) {
    return;
  }
  void cambiarEnCaliente(
    `Micrófono cambiado: ${nombreDeLaEntrada(elegido, useMicrofono.getState())}.`,
  );
}

/**
 * Lo que pasa al conectar o desconectar algo: la lista se pone al día y, si hace
 * falta, se cambia de entrada.
 *
 * - **Se ha ido la que suena**: su pista acaba y el contexto sigue leyendo
 *   ceros, con la barra diciendo que escucha. Se cambia ya, también en una toma:
 *   lo que esa toma grababa ya se ha cortado con la pista.
 * - **Ha vuelto la elegida** mientras se oía por la del sistema: se vuelve a
 *   ella, esperando a que acabe la toma si la hay.
 */
async function alCambiarLasEntradas(): Promise<void> {
  await ponerAlDiaLasEntradas();
  const entrada = entradaSonando;
  if (entrada === null) {
    return;
  }
  const { elegido, cayo, entradas } = useMicrofono.getState();
  const murio = pistaDe(entrada)?.viva === false;
  const volvio = cayo && elegido !== null && entradas.some(({ id }) => id === elegido);
  const nombre = nombreDeLaEntrada(elegido, useMicrofono.getState());
  if (murio) {
    await cambiarEnCaliente(
      `Se ha desconectado el micrófono; escucho por ${elegido === null ? 'el del sistema' : nombre}.`,
    );
  } else if (volvio) {
    if (hayToma()) {
      cambiarAlAcabarLaToma();
    } else {
      await cambiarEnCaliente(`Ha vuelto el micrófono elegido: ${nombre}.`);
    }
  }
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

        const crear = factories.current.createInput;
        let { pedido, cayo } = await queAparatoPedir(deviceId);
        if (vuelta !== mia) {
          return;
        }

        let input: AudioInput;
        for (;;) {
          input = await (crear?.(pedido) ?? crearEntradaDeCasa(pedido));
          if (vuelta !== mia) {
            // Se paró mientras se descargaba: todavía no se ha pedido nada.
            return;
          }

          entradaSonando = input;
          pedidoDeLaQueSuena = pedido;
          // **Con un aparato pedido, su fallo no se cuenta todavía**: si es que no
          // está, se cae al del sistema, y el aviso de «no se ha encontrado» se
          // habría leído un instante —dentro de un `role="alert"`— para nada.
          let callado = pedido !== undefined;
          const esta = input;
          dejarDeMirarElEstado = input.subscribe((state) => {
            if (callado && state === 'error') {
              return;
            }
            actions.setListening(LISTENING_BY_INPUT_STATE[state], esta.error?.message ?? null);
          });

          await input.start();
          callado = false;

          if (vuelta !== mia) {
            // **El permiso llegó tarde y ya no es de nadie.** Lo que lo esperaba se
            // fue —otra pantalla, o un «parar»— y ya soltó lo abierto, pero el
            // navegador contesta después y entrega una pista viva. Se cierra aquí,
            // que es el único sitio que todavía la tiene.
            await input.stop();
            return;
          }

          if (input.state !== 'error' || pedido === undefined) {
            break;
          }
          // El elegido no se ha podido abrir: se suelta y se prueba el del sistema.
          dejarDeMirarElEstado();
          dejarDeMirarElEstado = null;
          entradaSonando = null;
          await input.stop();
          if (vuelta !== mia) {
            return;
          }
          pedido = undefined;
          cayo = true;
        }

        if (input.state !== 'running') {
          // El permiso se ha denegado o el dispositivo ha fallado: el mensaje ya lo
          // ha puesto la suscripción, aquí solo hay que soltar lo abierto.
          dejarDeMirarElEstado?.();
          dejarDeMirarElEstado = null;
          entradaSonando = null;
          return;
        }

        fabricaDeLaEntrada = crear;
        contarComoQuedo(cayo, null);
        // Con el permiso dado, la lista ya trae los nombres.
        void ponerAlDiaLasEntradas();

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
          cambiarSiSeEligioOtro();
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
  //
  // Y mientras haya alguien, se vigila qué entradas hay: la lista del mando se
  // pone al día al enchufar algo, y la escucha cambia si se va la que suena.
  useEffect(() => {
    montados += 1;
    if (montados === 1) {
      dejarDeVigilarLasEntradas = vigilarEntradas(() => void alCambiarLasEntradas());
    }
    return () => {
      montados -= 1;
      if (montados === 0) {
        dejarDeVigilarLasEntradas?.();
        dejarDeVigilarLasEntradas = null;
        dejarDeEsperarLaToma?.();
        dejarDeEsperarLaToma = null;
        useMicrofono.getState().acciones.marcarPendiente(false);
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
