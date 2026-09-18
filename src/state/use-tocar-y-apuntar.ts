'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { BrowserMicInput } from '@media/browser-mic-input';
import type { MicInput } from '@media/mic-input';
import type { Recording, SessionRecorder } from '@media/session-recorder';
import { StreamRecorder } from '@media/stream-recorder';

import { canShareStream } from '@audio/stream-source';

import { entradaActiva, useListening, type ListeningDeps } from './use-listening';
import { useSessionStore } from './session-store';

/**
 * Tocar y que se escriba: una sola pulsación para las tres cosas.
 *
 * Componer tocando estaba construido entero y **en dos tiempos**: se pulsaba
 * «apuntar», se tocaba, se paraba, y luego había que acordarse de pulsar «traer
 * lo grabado» para que aquello entrara en la canción. Y grabar el sonido era
 * otra herramienta en otra pestaña que no se enteraba de nada, cuando es la
 * misma acción —tocar algo y quedárselo—
 * ([adr/0034](../../docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
 *
 * Aquí se juntan: al empezar se abre el micro de análisis, se empieza a grabar y
 * se marca el tramo; al parar se cierra todo y se devuelve la toma. Lo que hace
 * falta hacer con lo apuntado —convertirlo en una parte— lo hace
 * `apuntar-lo-tocado.ts`, que es lo que comparte con el botón de siempre.
 *
 * **Es un micrófono, no dos.** Lo fueron: `audio/` abría el suyo para el tono y
 * el croma y `media/` otro para los bytes, y dos `getUserMedia` sobre el mismo
 * aparato son dos permisos y dos pilotos —y en un iPhone, el segundo puede
 * quedarse con el dispositivo y dejar al primero sin señal—. No hacía falta:
 * el grabador de `media/` **recibe** un `MediaStream`, no lo pide, así que aquí
 * se le presta el que ya está abierto (`audio/stream-source.ts`). Si la entrada
 * no tiene flujo que prestar —los dobles de los tests no lo tienen— se abre el
 * de `media/` como antes.
 *
 * **Y el sonido no sale de aquí.** Se graba para poder oírlo y descargarlo, como
 * ya hacía la grabadora.
 */

export type FaseDeTocar = 'quieto' | 'preparando' | 'tocando';

export interface Toma {
  readonly recording: Recording;
  /** La dirección para oírla. La suelta quien la recibe. */
  readonly url: string;
}

export interface TocarYApuntar {
  readonly fase: FaseDeTocar;
  /** Qué ha ido mal, si algo ha ido mal. */
  readonly mensaje: string | null;
  /** Cuántos segundos llevas tocando. */
  readonly segundos: number;
  readonly empezar: () => Promise<void>;
  /** Para, y devuelve la toma de audio si la hubo. */
  readonly parar: () => Promise<Toma | null>;
}

export interface TocarDeps extends ListeningDeps {
  readonly createMic?: () => MicInput;
  readonly createRecorder?: () => SessionRecorder;
}

/**
 * El flujo del micro que ya está abierto para analizar, si lo hay.
 *
 * Nulo cuando la entrada no puede prestarlo: los dobles de los tests no tienen
 * `MediaStream` detrás, y entonces se abre el de `media/` como siempre.
 */
function flujoPrestado(): MediaStream | null {
  const entrada = entradaActiva();
  return canShareStream(entrada) ? entrada.stream : null;
}

export function useTocarYApuntar(deps: TocarDeps = {}): TocarYApuntar {
  const acciones = useSessionStore((state) => state.actions);
  // Con acordes encendidos: sin el croma no hay progresión que apuntar, que es
  // la mitad de lo que se viene a hacer aquí.
  const escucha = useListening({ ...deps, chords: true });

  const [fase, setFase] = useState<FaseDeTocar>('quieto');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);

  const micRef = useRef<MicInput | null>(null);
  const grabadorRef = useRef<SessionRecorder | null>(null);

  // Las fábricas en una referencia, y no en las dependencias: un componente que
  // pase funciones anónimas las cambia en cada render, y ahí dentro eso cerraría
  // el micrófono cada vez.
  const fabricas = useRef(deps);
  useEffect(() => {
    fabricas.current = deps;
  });

  // El contador se pone a cero al empezar, no aquí: reiniciarlo dentro del
  // efecto es escribir estado durante una sincronización y encadena renders.
  // Aquí solo se enchufa y se desenchufa el reloj.
  const tocando = fase === 'tocando';
  useEffect(() => {
    if (!tocando) {
      return;
    }
    const desde = Date.now();
    const tic = setInterval(() => setSegundos(Math.floor((Date.now() - desde) / 1000)), 500);
    return () => {
      clearInterval(tic);
    };
  }, [tocando]);

  const empezar = useCallback(async () => {
    setMensaje(null);
    setSegundos(0);
    setFase('preparando');

    // Primero el análisis: es lo que de verdad hace falta para escribir. Si el
    // sonido no se puede grabar se sigue sin él, pero sin motor no hay nada que
    // apuntar y entonces no se empieza.
    await escucha.start();
    if (useSessionStore.getState().listening !== 'listening') {
      setFase('quieto');
      return;
    }

    // El micro de análisis ya está abierto: se le pide prestado el flujo en vez
    // de abrir otro. Solo si no tiene —una entrada de mentira en un test, o un
    // navegador raro— se cae al micrófono de `media/`, que es lo que se hacía
    // siempre.
    const prestado = flujoPrestado();
    let flujo = prestado;
    let motivo: string | null = null;

    if (flujo === null) {
      const mic = fabricas.current.createMic?.() ?? new BrowserMicInput();
      micRef.current = mic;
      await mic.start();
      if (mic.state === 'running' && mic.stream !== null) {
        flujo = mic.stream;
      } else {
        motivo = mic.errorMessage;
        micRef.current = null;
      }
    }

    if (flujo !== null) {
      const grabador = fabricas.current.createRecorder?.() ?? new StreamRecorder();
      grabadorRef.current = grabador;
      await grabador.start({ audio: flujo });
      if (grabador.state !== 'recording') {
        motivo = grabador.errorMessage;
        grabadorRef.current = null;
        await micRef.current?.stop();
        micRef.current = null;
      }
    }

    if (grabadorRef.current === null) {
      // Se sigue: lo que se viene a hacer es escribir la canción, y quedarse sin
      // la toma de audio no impide ninguna de las dos cosas.
      setMensaje(motivo ?? 'No he podido grabar el sonido, pero te sigo oyendo.');
    }

    // **`performance.now` y no `Date.now`.** Es el reloj con el que se apuntan
    // los acordes del motor y las notas del historial, y mezclarlos deja los
    // instantes a mil millones de distancia: el punteo se quedaría entero fuera
    // del tramo y no aparecería ni una nota.
    acciones.startCapture(performance.now());
    setFase('tocando');
  }, [acciones, escucha]);

  const parar = useCallback(async (): Promise<Toma | null> => {
    acciones.stopCapture(performance.now());

    const grabador = grabadorRef.current;
    grabadorRef.current = null;
    const mic = micRef.current;
    micRef.current = null;

    // **El grabador primero y la escucha después**, que es lo que cambia al
    // compartir el micro: ahora graba sobre el flujo de la entrada de análisis,
    // y cerrarla antes le cortaba la toma por el final.
    const recording = grabador === null ? null : await grabador.stop();

    await escucha.stop();
    await mic?.stop();
    setFase('quieto');

    return recording === null ? null : { recording, url: URL.createObjectURL(recording.blob) };
  }, [acciones, escucha]);

  // Irse de la pantalla en mitad de una toma no puede dejar el micrófono
  // abierto: en una aplicación cuya primera promesa es que el audio no sale de
  // aquí, un micro que sigue encendido cuando ya no se ve es el peor fallo.
  useEffect(() => {
    return () => {
      void grabadorRef.current?.stop();
      void micRef.current?.stop();
      grabadorRef.current = null;
      micRef.current = null;
    };
  }, []);

  return { fase, mensaje, segundos, empezar, parar };
}
