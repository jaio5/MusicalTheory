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
   */
  readTimeDomain(target: Float32Array): boolean;

  /** Avisa de cada cambio de estado. Devuelve la función para desuscribirse. */
  subscribe(listener: (state: AudioInputState) => void): () => void;
}

// TODO (fase 1): implementar WebAudioInput sobre getUserMedia + AnalyserNode,
// con echoCancellation, noiseSuppression y autoGainControl desactivados.
// Ver docs/AUDIO-PITCH.md.
