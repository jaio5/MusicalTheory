/**
 * Entrada de audio sobre Web Audio.
 *
 * Es el único sitio del proyecto que llama a getUserMedia y que construye un
 * AudioContext. Todo lo demás habla con la interfaz AudioInput.
 */

import type {
  AudioInput,
  AudioInputError,
  AudioInputOptions,
  AudioInputState,
} from './audio-input';

/** Ventana de análisis por defecto. El porqué está en docs/AUDIO-PITCH.md. */
export const DEFAULT_FRAME_SIZE = 2048;

/**
 * Ventana del espectro. A 48 kHz son 5,9 Hz por casilla, que es lo que hace
 * falta para no confundir dos notas vecinas en las cuerdas graves.
 */
export const DEFAULT_SPECTRUM_SIZE = 8192;

type StateListener = (state: AudioInputState) => void;

export class WebAudioInput implements AudioInput {
  readonly frameSize: number;
  readonly spectrumSize: number;

  readonly #deviceId: string | undefined;
  readonly #listeners = new Set<StateListener>();

  #state: AudioInputState = 'idle';
  #error: AudioInputError | null = null;
  #context: AudioContext | null = null;
  #stream: MediaStream | null = null;
  #analyser: AnalyserNode | null = null;
  #spectrumAnalyser: AnalyserNode | null = null;
  /** Lo que hay que soltar al parar: el vigilante del contexto. */
  #soltarVigilancia: (() => void) | null = null;

  constructor(options: AudioInputOptions = {}) {
    this.frameSize = options.frameSize ?? DEFAULT_FRAME_SIZE;
    this.spectrumSize = options.spectrumSize ?? DEFAULT_SPECTRUM_SIZE;
    this.#deviceId = options.deviceId;
  }

  get state(): AudioInputState {
    return this.#state;
  }

  get error(): AudioInputError | null {
    return this.#error;
  }

  /** No se conoce hasta arrancar: la decide el navegador, no nosotros. */
  get sampleRate(): number {
    return this.#context?.sampleRate ?? 0;
  }

  async start(): Promise<void> {
    if (this.#state === 'running' || this.#state === 'requesting') {
      return;
    }

    if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined) {
      this.#fail({
        state: 'unsupported',
        message:
          'Este navegador no puede capturar audio. Prueba con Chrome, Edge o Firefox actualizados.',
      });
      return;
    }

    this.#error = null;
    this.#setState('requesting');

    try {
      // Las tres opciones desactivadas están pensadas para videollamadas y
      // estropean el análisis. El razonamiento, en docs/AUDIO-PITCH.md.
      this.#stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(this.#deviceId === undefined ? {} : { deviceId: { exact: this.#deviceId } }),
        },
        video: false,
      });
    } catch (cause) {
      this.#fail(describeCaptureError(cause));
      return;
    }

    try {
      this.#context = new AudioContext();
      // Chrome puede entregar el contexto suspendido aunque la llamada venga de
      // un gesto del usuario.
      if (this.#context.state === 'suspended') {
        await this.#context.resume();
      }

      this.#analyser = this.#context.createAnalyser();
      this.#analyser.fftSize = this.frameSize;
      // El análisis es en el dominio del tiempo: cualquier suavizado entre
      // bloques solo emborronaría el ataque de la nota.
      this.#analyser.smoothingTimeConstant = 0;

      // El segundo analizador es solo para el espectro, con ventana larga: el
      // tono quiere responder rápido y el acorde quiere ver fino, y no hay una
      // ventana que haga las dos cosas.
      this.#spectrumAnalyser = this.#context.createAnalyser();
      this.#spectrumAnalyser.fftSize = this.spectrumSize;
      this.#spectrumAnalyser.smoothingTimeConstant = 0.2;

      // La entrada no se conecta a los altavoces a propósito: con el ampli
      // abierto sería un acople inmediato.
      const source = this.#context.createMediaStreamSource(this.#stream);
      source.connect(this.#analyser);
      source.connect(this.#spectrumAnalyser);

      this.#vigilarContexto(this.#context);
    } catch {
      await this.stop();
      this.#fail({
        state: 'error',
        message:
          'No se ha podido abrir la entrada de audio. Comprueba que ninguna otra aplicación la esté usando en exclusiva y vuelve a intentarlo.',
      });
      return;
    }

    this.#setState('running');
  }

  /**
   * Mantiene el contexto despierto mientras dure la escucha.
   *
   * **Reanudarlo una vez al crearlo no basta**, y esto es un fallo que llegó a
   * notarse tocando: el sistema suspende el contexto solo —al bloquear la
   * pantalla, al cambiar de dispositivo de sonido, al entrar en reposo— y
   * entonces `getFloatTimeDomainData` sigue contestando, pero escribe ceros. El
   * motor no detecta nada, la pantalla sigue diciendo «escuchando» y no se oye
   * nada: había que parar y volver a arrancar, que es lo que crea un contexto
   * nuevo.
   *
   * Se vigila por dos caminos porque avisan en momentos distintos:
   * `statechange` salta en cuanto el contexto cambia, y `visibilitychange` es el
   * que hace falta cuando el navegador lo suspendió al perder la pestaña de
   * vista y no vuelve solo al recuperarla.
   */
  #vigilarContexto(context: AudioContext): void {
    const despertar = () => {
      // Solo mientras se supone que estamos escuchando: si ya se paró, dejarlo
      // dormido es lo correcto.
      if (this.#context !== context || this.#state !== 'running') {
        return;
      }
      if (context.state !== 'suspended') {
        return;
      }
      void context.resume().catch(() => {
        // No se ha podido despertar. Decirlo, porque lo peor que puede hacer
        // esta pantalla es seguir diciendo que escucha mientras no oye nada.
        this.#fail({
          state: 'error',
          message:
            'El sonido se ha quedado dormido y no hemos podido despertarlo. Para la escucha y vuelve a arrancarla.',
        });
      });
    };

    context.addEventListener('statechange', despertar);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', despertar);
    }

    this.#soltarVigilancia = () => {
      context.removeEventListener('statechange', despertar);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', despertar);
      }
    };
  }

  async stop(): Promise<void> {
    this.#soltarVigilancia?.();
    this.#soltarVigilancia = null;
    this.#analyser = null;
    this.#spectrumAnalyser = null;

    for (const track of this.#stream?.getTracks() ?? []) {
      track.stop();
    }
    this.#stream = null;

    const context = this.#context;
    this.#context = null;
    if (context !== null && context.state !== 'closed') {
      await context.close();
    }

    if (this.#state === 'running' || this.#state === 'requesting') {
      this.#setState('idle');
    }
  }

  /**
   * Si el contexto está despierto de verdad.
   *
   * Se comprueba antes de leer porque un contexto suspendido **no falla**:
   * escribe ceros en el buffer y devuelve como si nada. Eso llega al motor como
   * silencio, y silencio es indistinguible de no estar tocando. Devolviendo
   * `false` el motor sabe que no hay dato, que no es lo mismo.
   */
  get #despierto(): boolean {
    return this.#state === 'running' && this.#context?.state === 'running';
  }

  readTimeDomain(target: Float32Array<ArrayBuffer>): boolean {
    if (this.#analyser === null || !this.#despierto) {
      return false;
    }
    this.#analyser.getFloatTimeDomainData(target);
    return true;
  }

  readSpectrum(target: Float32Array<ArrayBuffer>): boolean {
    if (this.#spectrumAnalyser === null || !this.#despierto) {
      return false;
    }
    this.#spectrumAnalyser.getFloatFrequencyData(target);
    return true;
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #fail(error: AudioInputError): void {
    this.#error = error;
    this.#setState(error.state);
  }

  #setState(state: AudioInputState): void {
    if (this.#state === state) {
      return;
    }
    this.#state = state;
    for (const listener of this.#listeners) {
      listener(state);
    }
  }
}

/**
 * Traduce el error del navegador a algo que se le pueda enseñar a una persona:
 * qué ha pasado y qué hacer.
 */
function describeCaptureError(cause: unknown): AudioInputError {
  const name = cause instanceof Error ? cause.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        state: 'denied',
        message:
          'Has denegado el acceso al micrófono. Vuelve a darle permiso desde el icono de la barra de direcciones y prueba otra vez.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        state: 'error',
        message:
          'No se ha encontrado ninguna entrada de audio. Conecta la tarjeta de sonido y vuelve a intentarlo.',
      };
    case 'NotReadableError':
      return {
        state: 'error',
        message: 'Otra aplicación está usando la entrada de audio. Ciérrala y vuelve a intentarlo.',
      };
    default:
      return {
        state: 'error',
        message: 'No se ha podido abrir el micrófono. Revisa los permisos del navegador.',
      };
  }
}

/**
 * Las entradas de audio disponibles.
 *
 * Los nombres solo llegan después de conceder el permiso: antes, el navegador
 * los deja en blanco para no delatar qué hardware hay conectado. Por eso el
 * selector solo tiene sentido una vez arrancada la escucha.
 */
export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === 'undefined' || navigator.mediaDevices?.enumerateDevices === undefined) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}
