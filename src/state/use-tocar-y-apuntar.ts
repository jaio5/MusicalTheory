'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { BrowserMicInput } from '@media/browser-mic-input';
import type { MicInput } from '@media/mic-input';
import type { Recording, SessionRecorder } from '@media/session-recorder';
import { StreamRecorder } from '@media/stream-recorder';

import { useListening, type ListeningDeps } from './use-listening';
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
 * **Son dos micrófonos y se sabe.** `audio/` abre el suyo para el tono y el
 * croma, y `media/` el suyo para los bytes; juntarlos pide que las dos capas
 * compartan un `MediaStream`, que es fontanería con su propio paso en el
 * roadmap. Abrir dos es lo que ya hace hoy quien usa las dos herramientas a la
 * vez, así que esto no empeora nada.
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

    const mic = fabricas.current.createMic?.() ?? new BrowserMicInput();
    micRef.current = mic;
    await mic.start();

    if (mic.state === 'running' && mic.stream !== null) {
      const grabador = fabricas.current.createRecorder?.() ?? new StreamRecorder();
      grabadorRef.current = grabador;
      await grabador.start({ audio: mic.stream });
      if (grabador.state !== 'recording') {
        // Se sigue: lo que se viene a hacer es escribir la canción, y quedarse
        // sin la toma de audio no impide ninguna de las dos cosas.
        setMensaje(grabador.errorMessage ?? 'No he podido grabar el sonido, pero te sigo oyendo.');
        grabadorRef.current = null;
        await mic.stop();
        micRef.current = null;
      }
    } else {
      setMensaje(mic.errorMessage ?? 'No he podido grabar el sonido, pero te sigo oyendo.');
      micRef.current = null;
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
    await escucha.stop();

    const grabador = grabadorRef.current;
    grabadorRef.current = null;
    const mic = micRef.current;
    micRef.current = null;

    setFase('quieto');

    if (grabador === null) {
      await mic?.stop();
      return null;
    }

    const recording = await grabador.stop();
    await mic?.stop();
    return { recording, url: URL.createObjectURL(recording.blob) };
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
