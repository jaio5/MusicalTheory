'use client';

import { useEffect, useRef, useState } from 'react';

import { keyName, spanishNoteName } from '@core/music';
import { BrowserCameraInput } from '@media/browser-camera-input';
import type { CameraInput } from '@media/camera-input';
import { CanvasSessionRecorder } from '@media/canvas-session-recorder';
import { playQuietly } from '@media/play-quietly';
import type { Recording, SessionRecorder } from '@media/session-recorder';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

export interface RecorderPanelProps {
  readonly createCamera?: () => CameraInput;
  readonly createRecorder?: () => SessionRecorder;
}

type Phase = 'idle' | 'preparing' | 'recording' | 'done';

export function RecorderPanel({ createCamera, createRecorder }: RecorderPanelProps = {}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);

  const cameraRef = useRef<CameraInput | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const startedAtRef = useRef(0);
  const previewRef = useRef<HTMLVideoElement>(null);

  const factories = useRef({ createCamera, createRecorder });
  useEffect(() => {
    factories.current = { createCamera, createRecorder };
  });

  useEffect(() => {
    return () => {
      void cameraRef.current?.stop();
      cameraRef.current = null;
      recorderRef.current = null;
    };
  }, []);

  async function start() {
    setMessage(null);
    setPhase('preparing');

    const camera = factories.current.createCamera?.() ?? new BrowserCameraInput();
    cameraRef.current = camera;
    await camera.start();

    if (camera.state !== 'running' || camera.stream === null) {
      setMessage(camera.errorMessage ?? 'No se ha podido abrir la cámara.');
      setPhase('idle');
      return;
    }

    if (previewRef.current !== null) {
      previewRef.current.srcObject = camera.stream;
      await playQuietly(previewRef.current);
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
              ? `${spanishNoteName(state.reading.pitchClass)}${state.reading.octave}`
              : null,
          cents: state.hasSignal ? (state.reading?.cents ?? null) : null,
          keyName: key === null ? null : keyName(key.tonic, key.mode),
          chordSymbol: state.currentDegree,
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

  async function stop() {
    const recorder = recorderRef.current;
    if (recorder === null) {
      return;
    }

    const result = await recorder.stop();
    await cameraRef.current?.stop();
    if (previewRef.current !== null) {
      previewRef.current.srcObject = null;
    }

    setRecording(result);
    setPhase('done');
  }

  function download() {
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

  return (
    <section aria-labelledby="grabar" className="border-border bg-surface rounded-lg border p-6">
      <h2 id="grabar" className="font-display text-text text-2xl">
        Grabar
      </h2>
      <p className="text-text-muted mt-2 text-sm">
        Necesitamos la cámara para grabarte tocando. El vídeo se queda en tu equipo y lo descargas
        tú: no se sube a ningún servidor.
      </p>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {message}
        </p>
      )}

      <video
        ref={previewRef}
        muted
        playsInline
        aria-label="Vista previa de la cámara"
        className={`border-border mt-4 w-full max-w-sm rounded-md border ${
          phase === 'recording' ? '' : 'hidden'
        }`}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {phase === 'recording' ? (
          <Button onClick={() => void stop()}>Parar y guardar</Button>
        ) : (
          <Button disabled={phase === 'preparing'} onClick={() => void start()}>
            {phase === 'preparing' ? 'Pidiendo permiso…' : 'Grabarme tocando'}
          </Button>
        )}

        {phase === 'done' && recording !== null && (
          <Button variant="quiet" onClick={download}>
            Descargar el vídeo
          </Button>
        )}
      </div>

      {phase === 'recording' && (
        <p className="text-oxblood-bright mt-4 font-mono text-sm" aria-live="polite">
          Grabando. La nota, la tonalidad y el acorde van quemados en la imagen.
        </p>
      )}

      {phase === 'done' && recording !== null && (
        <p className="text-text-muted mt-4 text-sm" aria-live="polite">
          Listo: {Math.round(recording.durationMs / 1000)} segundos en {recording.mimeType}. Se
          guarda como <span className="text-text font-mono">{recording.filename}</span>.
        </p>
      )}
    </section>
  );
}
