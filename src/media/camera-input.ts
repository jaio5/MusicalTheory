/**
 * Acceso a la cámara para la grabación opcional de sesión.
 *
 * Separado de AudioInput a propósito: se puede tocar sin cámara, y el permiso
 * de vídeo se pide solo cuando el usuario decide grabarse.
 */

export type CameraState = 'idle' | 'requesting' | 'running' | 'denied' | 'unsupported' | 'error';

export interface CameraOptions {
  readonly deviceId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly frameRate?: number;
}

export interface CameraInput {
  readonly state: CameraState;
  /** El flujo de vídeo, o null si no está arrancada. Nunca sale del equipo. */
  readonly stream: MediaStream | null;
  /** Qué ha pasado y qué hacer, en español, o null si no hay error. */
  readonly errorMessage: string | null;

  start(options?: CameraOptions): Promise<void>;
  stop(): Promise<void>;
  listDevices(): Promise<MediaDeviceInfo[]>;
  subscribe(listener: (state: CameraState) => void): () => void;
}

// TODO (fase 6): implementar BrowserCameraInput sobre
// navigator.mediaDevices.getUserMedia({ video: ... }).
// Ver docs/RECORDING.md.
