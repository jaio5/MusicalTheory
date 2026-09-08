/**
 * Grabación de sesión: **el sonido de lo que tocas**, guardado en un fichero que
 * se descarga aquí mismo.
 *
 * No hay subida a ningún servidor, ni siquiera opcional: ver docs/RECORDING.md.
 *
 * Antes esto grababa vídeo con la cámara y los datos detectados quemados encima,
 * lo que obligaba a componer a mano en un canvas. Se quitó: lo que hace falta
 * volver a oír es la toma, y el vídeo pedía trípode y un permiso caro para algo
 * que se usaba una vez ([adr/0023](../../docs/adr/0023-grabar-solo-el-sonido.md)).
 */

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopping' | 'unsupported' | 'error';

export interface RecordingOptions {
  /** El flujo del micrófono. Es lo único que se graba. */
  readonly audio: MediaStream;
}

export interface Recording {
  readonly blob: Blob;
  /** Tipo real que ha elegido el navegador: no todos aceptan lo mismo. */
  readonly mimeType: string;
  readonly durationMs: number;
  /** Nombre sugerido para la descarga. */
  readonly filename: string;
}

export interface SessionRecorder {
  readonly state: RecorderState;
  readonly errorMessage: string | null;

  start(options: RecordingOptions): Promise<void>;
  pause(): void;
  resume(): void;
  /** Cierra la grabación y devuelve el fichero listo para descargar. */
  stop(): Promise<Recording>;
  subscribe(listener: (state: RecorderState) => void): () => void;
}

// Quien lo implementa es `stream-recorder.ts`, sobre MediaRecorder y el flujo
// del micro, negociando el contenedor por navegador. Ver docs/RECORDING.md.
