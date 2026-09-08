/**
 * El grabador: `MediaRecorder` sobre el flujo del micro, y poco más.
 *
 * La versión anterior componía cámara y overlay en un canvas —vídeo oculto →
 * canvas → `captureStream` → `MediaRecorder`— y eran doscientas líneas de
 * fontanería con un temporizador a treinta fotogramas por segundo. Grabando solo
 * el sonido, el navegador ya sabe hacerlo entero: se le da el flujo y se recogen
 * los trozos.
 *
 * Nada de esto sube a ningún sitio: el resultado es un Blob que descarga el
 * propio navegador.
 */

import { EstadoObservable, type Oyente } from '@core/estado-observable';
import { pickFormat, recordingFilename, type RecordingFormat } from './recording-format';
import type {
  Recording,
  RecorderState,
  RecordingOptions,
  SessionRecorder,
} from './session-recorder';

/**
 * Cada cuánto se cierra un trozo, en milisegundos.
 *
 * Trocear evita retener una sesión larga entera en un solo Blob, y de paso deja
 * que el contador de tiempo se apoye en algo real.
 */
const CHUNK_MS = 1000;

export class StreamRecorder implements SessionRecorder {
  #errorMessage: string | null = null;
  readonly #estado = new EstadoObservable<RecorderState>('idle');

  #recorder: MediaRecorder | null = null;
  #chunks: Blob[] = [];
  #format: RecordingFormat | null = null;

  /** Duración real grabada, sin contar lo que se pasa en pausa. */
  #elapsedMs = 0;
  #resumedAt: number | null = null;

  get state(): RecorderState {
    return this.#estado.valor;
  }

  get errorMessage(): string | null {
    return this.#errorMessage;
  }

  async start(options: RecordingOptions): Promise<void> {
    if (typeof MediaRecorder === 'undefined') {
      this.#errorMessage = 'Este navegador no puede grabar sonido. Prueba con Chrome o Firefox.';
      this.#estado.cambiarA('unsupported');
      return;
    }

    const format = pickFormat((mimeType) => MediaRecorder.isTypeSupported(mimeType));
    if (format === null) {
      this.#errorMessage =
        'Este navegador no admite ninguno de los formatos de sonido que usamos. Prueba con otro.';
      this.#estado.cambiarA('unsupported');
      return;
    }
    this.#format = format;

    this.#chunks = [];
    const recorder = new MediaRecorder(options.audio, { mimeType: format.mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.#chunks.push(event.data);
      }
    };
    recorder.start(CHUNK_MS);
    this.#recorder = recorder;

    // La duración se mide con el reloj y no contando trozos: si el hilo se
    // atasca, `ondataavailable` se retrasa y el conteo mentiría.
    this.#elapsedMs = 0;
    this.#resumedAt = performance.now();

    this.#errorMessage = null;
    this.#estado.cambiarA('recording');
  }

  pause(): void {
    if (this.#recorder?.state === 'recording') {
      this.#recorder.pause();
      this.#acumular();
      this.#estado.cambiarA('paused');
    }
  }

  resume(): void {
    if (this.#recorder?.state === 'paused') {
      this.#recorder.resume();
      this.#resumedAt = performance.now();
      this.#estado.cambiarA('recording');
    }
  }

  async stop(): Promise<Recording> {
    const recorder = this.#recorder;
    const format = this.#format;
    if (recorder === null || format === null) {
      throw new Error('No hay ninguna grabación en marcha.');
    }

    this.#acumular();
    this.#estado.cambiarA('stopping');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.#chunks, { type: format.mimeType }));
      recorder.stop();
    });

    const durationMs = this.#elapsedMs;
    this.#cleanUp();
    this.#estado.cambiarA('idle');

    return {
      blob,
      mimeType: format.mimeType,
      durationMs,
      filename: recordingFilename(format, new Date()),
    };
  }

  subscribe(listener: Oyente<RecorderState>): () => void {
    return this.#estado.suscribir(listener);
  }

  /** Suma al total lo que se lleva grabado desde la última vez que arrancó. */
  #acumular(): void {
    if (this.#resumedAt !== null) {
      this.#elapsedMs += performance.now() - this.#resumedAt;
      this.#resumedAt = null;
    }
  }

  #cleanUp(): void {
    this.#recorder = null;
    this.#chunks = [];
    this.#resumedAt = null;
  }
}
