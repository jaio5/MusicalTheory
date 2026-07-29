/**
 * Captura de audio del micro o de la tarjeta de sonido.
 *
 * La interfaz existe para que features/ no vea nunca un AudioContext ni un
 * getUserMedia. Un componente pide un AudioInput, lo arranca y lee bloques;
 * quién lo implementa y cómo es asunto de esta capa.
 */

export type AudioInputState =
  'idle' | 'requesting' | 'running' | 'denied' | 'unsupported' | 'error';

export interface AudioInputOptions {
  /**
   * Identificador del dispositivo de entrada. Sin él se usa el que tenga el
   * sistema por defecto, que con tarjeta externa suele ser el correcto.
   */
  readonly deviceId?: string;
  /**
   * Tamaño del bloque de análisis en muestras. Potencia de dos.
   * Ver docs/AUDIO-PITCH.md para por qué 2048 a 48 kHz.
   */
  readonly frameSize?: number;
  /**
   * Muestras de la ventana para el espectro. Potencia de dos y más grande que
   * el bloque: separar dos notas a un semitono en la sexta cuerda pide
   * resolución en frecuencia, y eso solo se compra con ventana larga.
   */
  readonly spectrumSize?: number;
}

export interface AudioInputError {
  readonly state: Extract<AudioInputState, 'denied' | 'unsupported' | 'error'>;
  /** Qué ha pasado y qué hacer, en una frase y en español. */
  readonly message: string;
}

export interface AudioInput {
  readonly state: AudioInputState;
  /** Frecuencia de muestreo real del contexto, conocida solo tras arrancar. */
  readonly sampleRate: number;
  readonly frameSize: number;
  /** Muestras de la ventana del espectro. El array a leer tiene la mitad. */
  readonly spectrumSize: number;
  /** El último error, o null si no lo hay. */
  readonly error: AudioInputError | null;

  /**
   * Pide permiso y abre la entrada. La frase que se enseña al usuario antes de
   * llamar a esto vive en la interfaz, no aquí: esta capa no escribe textos.
   */
  start(): Promise<void>;

  /** Cierra la entrada y suelta el dispositivo. Idempotente. */
  stop(): Promise<void>;

  /**
   * Copia el último bloque en el dominio del tiempo sobre `target`.
   * Devuelve false si todavía no hay datos o la entrada está parada.
   *
   * El buffer se declara sobre ArrayBuffer y no sobre ArrayBufferLike porque
   * las APIs de Web Audio no aceptan memoria compartida.
   */
  readTimeDomain(target: Float32Array<ArrayBuffer>): boolean;

  /**
   * Copia el espectro del último bloque en decibelios sobre `target`, que ha de
   * tener la mitad de muestras que el bloque. Devuelve false si no hay datos.
   *
   * La FFT ya la calcula el analizador para su uso interno, así que leerla no
   * cuesta nada: es lo que permite reconocer acordes sin un segundo análisis.
   */
  readSpectrum(target: Float32Array<ArrayBuffer>): boolean;

  /** Avisa de cada cambio de estado. Devuelve la función para desuscribirse. */
  subscribe(listener: (state: AudioInputState) => void): () => void;
}

// TODO (fase 1): implementar WebAudioInput sobre getUserMedia + AnalyserNode,
// con echoCancellation, noiseSuppression y autoGainControl desactivados.
// Ver docs/AUDIO-PITCH.md.
