'use client';

import { useEffect, useRef, useState } from 'react';

import { reloj } from '@core/reloj';
import { BrowserMicInput } from '@media/browser-mic-input';
import type { MicInput } from '@media/mic-input';
import type { Recording, SessionRecorder } from '@media/session-recorder';
import { StreamRecorder } from '@media/stream-recorder';
import { Button } from '@ui/Button';
import { IconoDescargar, IconoPapelera, IconoParar, IconoPunto } from '@ui/icons';
import { Aviso } from '@ui/Aviso';

export interface GrabadoraProps {
  readonly createMic?: () => MicInput;
  readonly createRecorder?: () => SessionRecorder;
}

type Fase = 'idle' | 'preparing' | 'recording' | 'done';

/**
 * Una toma terminada: el fichero y la dirección con la que se oye.
 *
 * Van **juntos en un solo estado** y no en dos. Con la dirección derivada de la
 * grabación en un efecto había que llamar a `setUrl` dentro del efecto, que es
 * justo lo que hace renderizar dos veces por cada toma; y separados, existía un
 * instante con grabación y sin dirección en el que el reproductor se pintaba
 * vacío. `URL.createObjectURL` se puede llamar donde se para de grabar, que es
 * donde se sabe que hay algo que oír.
 */
interface Toma {
  readonly recording: Recording;
  readonly url: string;
}

/**
 * Grabar lo que tocas, oírlo y quedártelo.
 *
 * Es **solo sonido**. Hubo una fase con cámara: te veías detrás de la interfaz
 * mientras tocabas, y para eso la aplicación entera se ponía en contorno sobre
 * el vídeo. Pedía trípode, pantalla grande y el permiso más caro que hay para
 * algo que se prueba una vez, mientras que lo que de verdad se quiere volver a
 * oír es la toma ([adr/0023](../../../docs/adr/0023-grabar-solo-el-sonido.md)).
 *
 * Lo que cambia de raíz es **el final**: antes se paraba y salía un botón de
 * descargar un vídeo que no habías visto. Ahora sale el reproductor, así que lo
 * primero que puedes hacer es escucharte; descargar y tirar vienen después, que
 * es el orden en que se decide si una toma vale.
 *
 * El sonido no sale del equipo: se graba, se oye y se descarga aquí.
 */
export function Grabadora({ createMic, createRecorder }: GrabadoraProps = {}) {
  const [fase, setFase] = useState<Fase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [toma, setToma] = useState<Toma | null>(null);
  const [segundos, setSegundos] = useState(0);

  const micRef = useRef<MicInput | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);

  const factories = useRef({ createMic, createRecorder });
  useEffect(() => {
    factories.current = { createMic, createRecorder };
  });

  /**
   * La dirección de la toma que se está oyendo, para poder soltarla.
   *
   * Un blob de audio retenido es memoria que no vuelve, y aquí sale uno por cada
   * vez que se pulsa grabar. La referencia existe porque quien la suelta no es
   * quien la crea: se crea al parar y se suelta al empezar la siguiente, al
   * descartarla o al irse de la pantalla.
   */
  const urlRef = useRef<string | null>(null);

  function soltarToma(): void {
    if (urlRef.current !== null) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  // Al salir de la pantalla se cierra el micro. Sin esto, cambiar de pantalla en
  // medio de una toma dejaría el piloto del navegador encendido.
  useEffect(() => {
    return () => {
      void micRef.current?.stop();
      micRef.current = null;
      recorderRef.current = null;
      if (urlRef.current !== null) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  // El contador de la toma. Va aquí y no dentro del grabador porque es lo que se
  // mira mientras grabas, y el grabador solo sabe el total al parar. Arranca de
  // cero en `start`, no aquí: poner el estado dentro del efecto es un render de
  // más por cada toma.
  const grabando = fase === 'recording';
  useEffect(() => {
    if (!grabando) {
      return;
    }
    const desde = Date.now();
    const tic = setInterval(() => setSegundos(Math.floor((Date.now() - desde) / 1000)), 500);
    return () => {
      clearInterval(tic);
    };
  }, [grabando]);

  async function start(): Promise<void> {
    setMessage(null);
    soltarToma();
    setToma(null);
    setSegundos(0);
    setFase('preparing');

    const mic = factories.current.createMic?.() ?? new BrowserMicInput();
    micRef.current = mic;
    await mic.start();

    if (mic.state !== 'running' || mic.stream === null) {
      setMessage(mic.errorMessage ?? 'No se ha podido abrir el micrófono.');
      setFase('idle');
      return;
    }

    const recorder = factories.current.createRecorder?.() ?? new StreamRecorder();
    recorderRef.current = recorder;
    await recorder.start({ audio: mic.stream });

    if (recorder.state !== 'recording') {
      setMessage(recorder.errorMessage ?? 'No se ha podido empezar a grabar.');
      await mic.stop();
      setFase('idle');
      return;
    }

    setFase('recording');
  }

  async function stop(): Promise<void> {
    const recorder = recorderRef.current;
    if (recorder === null) {
      return;
    }

    const result = await recorder.stop();
    await micRef.current?.stop();

    const url = URL.createObjectURL(result.blob);
    urlRef.current = url;
    setToma({ recording: result, url });
    setFase('done');
  }

  function download(): void {
    if (toma === null) {
      return;
    }
    const link = document.createElement('a');
    link.href = toma.url;
    link.download = toma.recording.filename;
    link.click();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void (grabando ? stop() : start())}
          disabled={fase === 'preparing'}
          aria-pressed={grabando}
          aria-label={grabando ? 'Parar la grabación' : 'Grabar lo que tocas'}
          className={`size-tap inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
            grabando
              ? 'border-oxblood-bright bg-oxblood/40'
              : 'border-border bg-surface hover:border-oxblood-bright'
          }`}
        >
          <span data-senal className="text-oxblood-bright">
            {grabando ? <IconoParar /> : <IconoPunto />}
          </span>
        </button>

        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-text text-sm font-medium">
            {grabando
              ? 'Grabando'
              : fase === 'preparing'
                ? 'Pidiendo el micrófono…'
                : fase === 'done'
                  ? 'Tu toma'
                  : 'Grabar lo que tocas'}
          </span>
          <span className="text-text-muted text-xs">
            {grabando ? (
              <span className="font-mono tabular-nums">{reloj(segundos)}</span>
            ) : fase === 'done' && toma !== null ? (
              <span className="font-mono tabular-nums">
                {reloj(Math.round(toma.recording.durationMs / 1000))} · se queda en tu equipo
              </span>
            ) : (
              'Solo el sonido, y no sale de tu equipo'
            )}
          </span>
        </div>

        {fase === 'done' && toma !== null && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="quiet" onClick={download} className="px-3 text-sm">
              <IconoDescargar />
              <span className="ml-2">Descargar</span>
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                soltarToma();
                setToma(null);
                setFase('idle');
              }}
              aria-label="Descartar la toma"
              title="Descartar la toma"
              className="px-3"
            >
              <IconoPapelera />
            </Button>
          </div>
        )}
      </div>

      {/* El reproductor del navegador, sin envolver: sabe buscar dentro de la
          toma, cambiar la velocidad y decir cuánto dura, y nada de eso lo íbamos
          a hacer mejor a mano. */}
      {fase === 'done' && toma !== null && (
        <audio controls src={toma.url} className="w-full" aria-label="Lo que acabas de tocar" />
      )}

      <Aviso mensaje={message} anuncio="urgente" />
    </div>
  );
}
