/**
 * Cámara del navegador. Es el único sitio que pide vídeo.
 *
 * El permiso se pide solo cuando el usuario decide grabarse: se puede tocar sin
 * cámara, y la app entera funciona sin tocar esto.
 */

import type { CameraInput, CameraOptions, CameraState } from './camera-input';

type StateListener = (state: CameraState) => void;

export class BrowserCameraInput implements CameraInput {
  #state: CameraState = 'idle';
  #stream: MediaStream | null = null;
  #errorMessage: string | null = null;
  readonly #listeners = new Set<StateListener>();

  get state(): CameraState {
    return this.#state;
  }

  get stream(): MediaStream | null {
    return this.#stream;
  }

  get errorMessage(): string | null {
    return this.#errorMessage;
  }

  async start(options: CameraOptions = {}): Promise<void> {
    if (this.#state === 'running' || this.#state === 'requesting') {
      return;
    }

    if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined) {
      this.#errorMessage =
        'Este navegador no puede usar la cámara. Prueba con Chrome, Edge o Firefox actualizados.';
      this.#setState('unsupported');
      return;
    }

    this.#errorMessage = null;
    this.#setState('requesting');

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(options.deviceId === undefined ? {} : { deviceId: { exact: options.deviceId } }),
          width: { ideal: options.width ?? 1280 },
          height: { ideal: options.height ?? 720 },
          frameRate: { ideal: options.frameRate ?? 30 },
        },
        audio: false,
      });
      this.#setState('running');
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      this.#errorMessage =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Has denegado el acceso a la cámara. Puedes grabarte volviendo a darle permiso desde el icono de la barra de direcciones.'
          : 'No se ha podido abrir la cámara. Comprueba que no la esté usando otra aplicación.';
      this.#setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }

  async stop(): Promise<void> {
    for (const track of this.#stream?.getTracks() ?? []) {
      track.stop();
    }
    this.#stream = null;
    if (this.#state === 'running' || this.#state === 'requesting') {
      this.#setState('idle');
    }
  }

  async listDevices(): Promise<MediaDeviceInfo[]> {
    if (
      typeof navigator === 'undefined' ||
      navigator.mediaDevices?.enumerateDevices === undefined
    ) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #setState(state: CameraState): void {
    if (this.#state === state) {
      return;
    }
    this.#state = state;
    for (const listener of this.#listeners) {
      listener(state);
    }
  }
}
