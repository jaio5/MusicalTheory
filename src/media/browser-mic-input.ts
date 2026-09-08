/**
 * El micrófono del navegador, abierto para grabar.
 *
 * Pide cancelación de eco y supresión de ruido **apagadas**: están pensadas para
 * una llamada, y con una guitarra delante se comen los armónicos y bajan el
 * volumen en cuanto una nota se sostiene. Lo que se quiere aquí es la señal tal
 * cual entra.
 */

import type { MicInput, MicOptions, MicState } from './mic-input';
import { EstadoObservable, type Oyente } from '@core/estado-observable';

export class BrowserMicInput implements MicInput {
  #stream: MediaStream | null = null;
  #errorMessage: string | null = null;
  readonly #estado = new EstadoObservable<MicState>('idle');

  get state(): MicState {
    return this.#estado.valor;
  }

  get stream(): MediaStream | null {
    return this.#stream;
  }

  get errorMessage(): string | null {
    return this.#errorMessage;
  }

  async start(options: MicOptions = {}): Promise<void> {
    if (this.#estado.valor === 'running' || this.#estado.valor === 'requesting') {
      return;
    }

    if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined) {
      this.#errorMessage =
        'Este navegador no puede usar el micrófono. Prueba con Chrome, Edge o Firefox actualizados.';
      this.#estado.cambiarA('unsupported');
      return;
    }

    this.#errorMessage = null;
    this.#estado.cambiarA('requesting');

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(options.deviceId === undefined ? {} : { deviceId: { exact: options.deviceId } }),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.#estado.cambiarA('running');
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      const denegado = name === 'NotAllowedError' || name === 'SecurityError';
      this.#errorMessage = denegado
        ? 'Has denegado el micrófono. Puedes darle permiso otra vez desde el icono de la barra de direcciones.'
        : 'No se ha podido abrir el micrófono. Comprueba que no lo esté usando otra aplicación.';
      this.#estado.cambiarA(denegado ? 'denied' : 'error');
    }
  }

  async stop(): Promise<void> {
    for (const track of this.#stream?.getTracks() ?? []) {
      track.stop();
    }
    this.#stream = null;
    if (this.#estado.valor === 'running' || this.#estado.valor === 'requesting') {
      this.#estado.cambiarA('idle');
    }
  }

  subscribe(listener: Oyente<MicState>): () => void {
    return this.#estado.suscribir(listener);
  }
}
