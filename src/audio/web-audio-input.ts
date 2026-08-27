/**
 * Entrada de audio sobre Web Audio.
 *
 * Es el único sitio del proyecto que llama a getUserMedia y que construye un
 * AudioContext. Todo lo demás habla con la interfaz AudioInput.
 */

import { MAX_RECORDING_SECONDS, type AudioRecorder, type Recording } from './recorder';
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

export class WebAudioInput implements AudioInput, AudioRecorder {
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
  /** La grabación en curso, si la hay. */
  #grabadora: MediaRecorder | null = null;
  #trozos: Blob[] = [];
  /** El reloj del tope de duración. Se apaga al parar, o quedaría suelto. */
  #relojDelTope: ReturnType<typeof setTimeout> | null = null;

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

  /**
   * Empieza a guardar el sonido crudo.
   *
   * Con `MediaRecorder` y no leyendo bloques del analizador, que es lo que
   * parecía más directo y no vale: el analizador contesta *el último bloque*, y
   * leerlo cada tanto deja huecos y repeticiones. Un espectro calculado sobre una
   * señal con costuras se llena de faldas que no existen. `MediaRecorder` da el
   * flujo entero y seguido, que es lo único que sirve para volver a analizarlo.
   *
   * Es además lo que ya usa `media/session-recorder.ts` para grabar la sesión en
   * vídeo, así que no entra una pieza nueva en el proyecto.
   */
  startRecording(): boolean {
    if (this.#stream === null || typeof MediaRecorder === 'undefined') {
      return false;
    }
    this.stopRecordingSilently();

    try {
      this.#trozos = [];
      const grabadora = new MediaRecorder(this.#stream);
      grabadora.addEventListener('dataavailable', (evento) => {
        if (evento.data.size > 0) {
          this.#trozos.push(evento.data);
        }
      });
      grabadora.start();
      this.#grabadora = grabadora;

      // El tope no es una regla musical: son 34 MB de memoria por cada tres
      // minutos a 48 kHz. Se para sola por si alguien deja el botón puesto.
      //
      // **El reloj para esta grabadora y solo esta.** Estuvo leyendo
      // `this.#grabadora` al disparar, que es la de entonces y no la de ahora:
      // grabar diez segundos, parar, y volver a grabar dejaba un reloj vivo que
      // a los tres minutos del primero cortaba la segunda grabación por la
      // mitad, sin motivo visible. Se cierra sobre la suya y se apaga al parar.
      this.#relojDelTope = setTimeout(() => {
        if (grabadora.state !== 'inactive') {
          grabadora.stop();
        }
      }, MAX_RECORDING_SECONDS * 1000);
      return true;
    } catch {
      this.#grabadora = null;
      return false;
    }
  }

  async stopRecording(): Promise<Recording | null> {
    const grabadora = this.#grabadora;
    const context = this.#context;
    this.#grabadora = null;
    this.#apagarReloj();
    if (grabadora === null || context === null) {
      return null;
    }

    if (grabadora.state !== 'inactive') {
      await new Promise<void>((listo) => {
        grabadora.addEventListener('stop', () => listo(), { once: true });
        grabadora.stop();
      });
    }

    const trozos = this.#trozos;
    this.#trozos = [];
    if (trozos.length === 0) {
      return null;
    }

    try {
      const datos = await new Blob(trozos).arrayBuffer();
      const decodificado = await context.decodeAudioData(datos);
      // Un solo canal: el micro de una guitarra es mono, y si viniera estéreo
      // los dos canales dicen lo mismo para lo que hace falta aquí.
      const samples = decodificado.getChannelData(0);
      return {
        samples: samples as Float32Array<ArrayBuffer>,
        sampleRate: decodificado.sampleRate,
      };
    } catch {
      // Un formato que el propio navegador no sabe decodificar, o el contexto
      // cerrado mientras tanto. No se enseña error: lo que se pierde es la
      // mejora, y los acordes que el motor oyó en vivo siguen ahí.
      return null;
    }
  }

  /** Corta una grabación anterior sin esperar a nada. */
  private stopRecordingSilently(): void {
    if (this.#grabadora !== null && this.#grabadora.state !== 'inactive') {
      this.#grabadora.stop();
    }
    this.#grabadora = null;
    this.#trozos = [];
    this.#apagarReloj();
  }

  #apagarReloj(): void {
    if (this.#relojDelTope !== null) {
      clearTimeout(this.#relojDelTope);
      this.#relojDelTope = null;
    }
  }

  async stop(): Promise<void> {
    this.stopRecordingSilently();
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
