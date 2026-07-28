'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { keyName, noteName } from '@core/music';
import { BrowserCameraInput } from '@media/browser-camera-input';
import type { CameraInput } from '@media/camera-input';
import { CanvasSessionRecorder } from '@media/canvas-session-recorder';
import { playQuietly } from '@media/play-quietly';
import type { Recording, SessionRecorder } from '@media/session-recorder';
import { selectActiveKey, useSessionStore } from '@state/session-store';

export interface RecordStageProps {
  readonly children: ReactNode;
  readonly createCamera?: () => CameraInput;
  readonly createRecorder?: () => SessionRecorder;
}

type Phase = 'idle' | 'preparing' | 'recording' | 'done';

/**
 * Grabarte tocando sin dejar de ver lo que estás haciendo.
 *
 * Al grabar, la cámara se pone detrás de todo y la interfaz se queda en
 * contorno y letra: sigues viendo el acorde y a dónde puedes ir, y en el vídeo
 * se te ve a ti. Los datos se queman aparte en el fichero, así que lo que se
 * graba no depende de cómo esté la pantalla.
 *
 * El vídeo no sale del equipo. Se descarga y ya.
 */
export function RecordStage({ children, createCamera, createRecorder }: RecordStageProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);

  const cameraRef = useRef<CameraInput | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const startedAtRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const factories = useRef({ createCamera, createRecorder });
  useEffect(() => {
    factories.current = { createCamera, createRecorder };
  });

  // Al salir de la pantalla se cierra la cámara. Sin esto, cambiar de pantalla
  // en medio de una grabación dejaría el piloto encendido.
  useEffect(() => {
    return () => {
      void cameraRef.current?.stop();
      cameraRef.current = null;
      recorderRef.current = null;
    };
  }, []);

  async function start(): Promise<void> {
    setMessage(null);
    setRecording(null);
    setPhase('preparing');

    const camera = factories.current.createCamera?.() ?? new BrowserCameraInput();
    cameraRef.current = camera;
    await camera.start();

    if (camera.state !== 'running' || camera.stream === null) {
      setMessage(camera.errorMessage ?? 'No se ha podido abrir la cámara.');
      setPhase('idle');
      return;
    }

    if (videoRef.current !== null) {
      videoRef.current.srcObject = camera.stream;
      await playQuietly(videoRef.current);
    }

    const recorder = factories.current.createRecorder?.() ?? new CanvasSessionRecorder();
    recorderRef.current = recorder;
    startedAtRef.current = performance.now();

    await recorder.start({
      video: camera.stream,
      // El overlay se pide fotograma a fotograma: así lleva siempre el último
      // dato sin que el grabador conozca el store.
      overlay: () => {
        const state = useSessionStore.getState();
        const key = selectActiveKey(state);
        return {
          noteName:
            state.hasSignal && state.reading !== null
              ? `${noteName(state.reading.pitchClass)}${state.reading.octave}`
              : null,
          cents: state.hasSignal ? (state.reading?.cents ?? null) : null,
          keyName: key === null ? null : keyName(key.tonic, key.mode),
          chordSymbol: state.path.at(-1)?.symbol ?? null,
          elapsedMs: performance.now() - startedAtRef.current,
        };
      },
    });

    if (recorder.state !== 'recording') {
      setMessage(recorder.errorMessage ?? 'No se ha podido empezar a grabar.');
      await camera.stop();
      setPhase('idle');
      return;
    }

    setPhase('recording');
  }

  async function stop(): Promise<void> {
    const recorder = recorderRef.current;
    if (recorder === null) {
      return;
    }

    const result = await recorder.stop();
    await cameraRef.current?.stop();
    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }

    setRecording(result);
    setPhase('done');
  }

  function download(): void {
    if (recording === null) {
      return;
    }
    // La URL se libera en cuanto se ha usado: un objeto grande retenido es
    // memoria que no vuelve.
    const url = URL.createObjectURL(recording.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = recording.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const live = phase === 'recording';

  // La marca va en el body y no en este div porque lo que tapaba la cámara eran
  // los fondos de los ancestros —el de la página y el del cuerpo—, y una clase
  // aquí abajo no llega a ellos.
  useEffect(() => {
    if (!live) {
      return;
    }
    document.body.classList.add('grabando');
    return () => {
      document.body.classList.remove('grabando');
    };
  }, [live]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Por debajo de toda la interfaz y por encima del lienzo de la página:
          ahí es donde el -z-10 deja el vídeo, y de ahí sale la sensación de
          estar tocando delante de la pantalla. */}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className={`fixed inset-0 -z-10 h-full w-full object-cover ${live ? '' : 'hidden'}`}
      />

      {/* Un velo encima de la cámara. Sin él hay que pelear el contraste letra a
          letra contra lo que sea que tengas detrás —una ventana, una pared
          blanca— y nunca sale bien. Con él se te sigue viendo y se lee todo. */}
      {live && <div aria-hidden="true" data-velo className="fixed inset-0 -z-10 bg-black/55" />}

      <div className="border-border flex shrink-0 items-center gap-3 border-b px-3 py-1.5">
        <button
          type="button"
          onClick={() => void (live ? stop() : start())}
          disabled={phase === 'preparing'}
          aria-pressed={live}
          aria-label={live ? 'Parar la grabación' : 'Grabarte tocando'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
            live ? 'border-oxblood-bright' : 'border-border hover:border-oxblood-bright'
          } disabled:opacity-50`}
        >
          <span
            aria-hidden="true"
            data-senal
            className={`bg-oxblood-bright block ${live ? 'h-2.5 w-2.5 rounded-sm' : 'h-4 w-4 rounded-full'}`}
          />
        </button>

        <span className="text-text-muted text-xs">
          {live
            ? 'Grabando. Te ves detrás; el vídeo se queda en tu equipo.'
            : phase === 'preparing'
              ? 'Pidiendo la cámara'
              : 'Grabarte tocando'}
        </span>

        {recording !== null && phase === 'done' && (
          <button
            type="button"
            onClick={download}
            className="border-border text-text-muted hover:text-text ml-auto border px-2 py-1 text-xs"
          >
            Descargar el vídeo
          </button>
        )}
      </div>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright shrink-0 px-3 py-1 text-sm">
          {message}
        </p>
      )}

      <div className="min-h-0 grow overflow-hidden">{children}</div>
    </div>
  );
}
