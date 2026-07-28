/**
 * Grabador de sesión: compone la cámara y el overlay en un canvas y graba el
 * resultado con MediaRecorder.
 *
 * MediaRecorder no sabe dibujar encima del vídeo, así que hay que componer a
 * mano: vídeo oculto → canvas → captureStream → MediaRecorder. El detalle está
 * en docs/RECORDING.md.
 *
 * Nada de esto sube a ningún sitio: el resultado es un Blob que descarga el
 * propio navegador.
 */

import { colors, fonts } from '@ui/tokens';

import { overlayLines } from './overlay';
import { playQuietly } from './play-quietly';
import { pickFormat, recordingFilename, type RecordingFormat } from './recording-format';
import type {
  Recording,
  RecorderState,
  RecordingOptions,
  SessionRecorder,
} from './session-recorder';

type StateListener = (state: RecorderState) => void;

const DEFAULT_FRAME_RATE = 30;

export class CanvasSessionRecorder implements SessionRecorder {
  #state: RecorderState = 'idle';
  #errorMessage: string | null = null;
  readonly #listeners = new Set<StateListener>();

  #video: HTMLVideoElement | null = null;
  #recorder: MediaRecorder | null = null;
  #frameTimer: ReturnType<typeof setInterval> | null = null;
  #chunks: Blob[] = [];
  #format: RecordingFormat | null = null;
  /** Duración real grabada, sin contar lo que se pasa en pausa. */
  #elapsedMs = 0;
  #lastTickAt: number | null = null;

  get state(): RecorderState {
    return this.#state;
  }

  get errorMessage(): string | null {
    return this.#errorMessage;
  }

  async start(options: RecordingOptions): Promise<void> {
    if (typeof MediaRecorder === 'undefined') {
      this.#errorMessage = 'Este navegador no puede grabar vídeo. Prueba con Chrome o Firefox.';
      this.#setState('unsupported');
      return;
    }

    const format = pickFormat((mimeType) => MediaRecorder.isTypeSupported(mimeType));
    if (format === null) {
      this.#errorMessage =
        'Este navegador no admite ninguno de los formatos de vídeo que usamos. Prueba con otro.';
      this.#setState('unsupported');
      return;
    }
    this.#format = format;

    const track = options.video.getVideoTracks()[0];
    const settings = track?.getSettings();
    const width = settings?.width ?? 1280;
    const height = settings?.height ?? 720;
    const frameRate = options.frameRate ?? DEFAULT_FRAME_RATE;

    const video = document.createElement('video');
    video.srcObject = options.video;
    video.muted = true;
    video.playsInline = true;
    await playQuietly(video);
    this.#video = video;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
      this.#errorMessage = 'No se ha podido preparar la composición del vídeo.';
      this.#setState('error');
      return;
    }

    this.#elapsedMs = 0;
    this.#lastTickAt = null;
    this.#frameTimer = setInterval(() => {
      // La duración se mide con el reloj, no contando fotogramas: si el hilo se
      // atasca, el temporizador se retrasa y el conteo mentiría.
      const now = performance.now();
      if (this.#state === 'recording' && this.#lastTickAt !== null) {
        this.#elapsedMs += now - this.#lastTickAt;
      }
      this.#lastTickAt = now;
      this.#drawFrame(context, canvas, video, options);
    }, 1000 / frameRate);

    const composed = canvas.captureStream(frameRate);
    for (const audioTrack of options.audio?.getAudioTracks() ?? []) {
      composed.addTrack(audioTrack);
    }

    this.#chunks = [];
    const recorder = new MediaRecorder(composed, { mimeType: format.mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.#chunks.push(event.data);
      }
    };
    // Trocear evita retener una sesión larga entera en un solo Blob.
    recorder.start(1000);
    this.#recorder = recorder;

    this.#errorMessage = null;
    this.#setState('recording');
  }

  #drawFrame(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    options: RecordingOptions,
  ): void {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frame = options.overlay();
    const layout = { width: canvas.width, height: canvas.height };

    // Un velo por abajo: sin él, el texto se pierde sobre una camisa clara.
    const veil = context.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height);
    veil.addColorStop(0, 'rgba(18,16,14,0)');
    veil.addColorStop(1, 'rgba(18,16,14,0.75)');
    context.fillStyle = veil;
    context.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);

    for (const line of overlayLines(frame, layout)) {
      context.font = `${line.fontSize}px ${line.emphasis ? fonts.display : fonts.mono}`;
      context.fillStyle = line.emphasis ? colors.brassBright : colors.text;
      context.textAlign = line.x > layout.width / 2 ? 'right' : 'left';
      context.textBaseline = 'alphabetic';
      context.fillText(line.text, line.x, line.y);
    }
  }

  pause(): void {
    if (this.#recorder?.state === 'recording') {
      this.#recorder.pause();
      this.#setState('paused');
    }
  }

  resume(): void {
    if (this.#recorder?.state === 'paused') {
      this.#recorder.resume();
      this.#setState('recording');
    }
  }

  async stop(): Promise<Recording> {
    const recorder = this.#recorder;
    const format = this.#format;
    if (recorder === null || format === null) {
      throw new Error('No hay ninguna grabación en marcha.');
    }

    this.#setState('stopping');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.#chunks, { type: format.mimeType }));
      recorder.stop();
    });

    const durationMs = this.#elapsedMs;
    this.#cleanUp();
    this.#setState('idle');

    return {
      blob,
      mimeType: format.mimeType,
      durationMs,
      filename: recordingFilename(format, new Date()),
    };
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #cleanUp(): void {
    if (this.#frameTimer !== null) {
      clearInterval(this.#frameTimer);
      this.#frameTimer = null;
    }
    this.#video?.pause();
    this.#video = null;
    this.#recorder = null;
    this.#chunks = [];
  }

  #setState(state: RecorderState): void {
    if (this.#state === state) {
      return;
    }
    this.#state = state;
    for (const listener of this.#listeners) {
      listener(state);
    }
  }
}
