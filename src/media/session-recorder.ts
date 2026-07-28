/**
 * Grabación de sesión: vídeo de la cámara con los datos detectados quemados
 * encima, más el audio de la entrada.
 *
 * El resultado se descarga en local. No hay subida a ningún servidor, ni
 * siquiera opcional: ver docs/RECORDING.md.
 */

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopping' | 'unsupported' | 'error';

/**
 * Lo que se pinta encima del vídeo en cada fotograma. Son símbolos ya
 * resueltos: el compositor no sabe de teoría musical ni de audio.
 */
export interface OverlayFrame {
  readonly noteName: string | null;
  readonly cents: number | null;
  readonly keyName: string | null;
  readonly chordSymbol: string | null;
  readonly elapsedMs: number;
}

export interface RecordingOptions {
  readonly video: MediaStream;
  readonly audio?: MediaStream;
  /** Se consulta una vez por fotograma compuesto. */
  readonly overlay: () => OverlayFrame;
  readonly frameRate?: number;
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

// TODO (fase 6): implementar CanvasSessionRecorder — componer cámara y overlay
// en un canvas, sacar el flujo con captureStream() y grabarlo con MediaRecorder
// negociando el códec por navegador. Ver docs/RECORDING.md.
