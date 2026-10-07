/**
 * Guardar el sonido crudo para poder estudiarlo al parar.
 *
 * Hasta ahora de una sesión solo quedaban los acordes que el motor iba diciendo
 * en vivo, y eso arrastra sus errores: el motor decide con cuatro décimas de
 * contexto, sin poder mirar hacia delante y con una ventana corta a la fuerza.
 * Lo que se apuntaba era su lectura, no lo que sonó.
 *
 * Con las muestras guardadas se puede volver a mirar con calma
 * (`offline-chords.ts`): ventana cuatro veces más larga, el ruido de la sala
 * medido en la propia grabación y la secuencia entera elegida de una vez.
 *
 * **Esto no abre la puerta a subir audio.** Las muestras se quedan en memoria,
 * se analizan aquí y lo que sale son símbolos. La regla 4 de la arquitectura
 * sigue en pie y no hay ni una línea de subida, igual que en `media/`.
 *
 * Es un puerto aparte y no dos métodos más en `AudioInput` a propósito: no toda
 * entrada sabe grabar —los dobles de los tests no—, y meterlo en la interfaz
 * grande obligaría a que todos fingieran saber hacerlo.
 */

export interface Recording {
  /** Las muestras, en un solo canal. */
  readonly samples: Float32Array<ArrayBuffer>;
  readonly sampleRate: number;
}

export interface AudioRecorder {
  /** Empieza a guardar. Falso si el navegador no sabe o la entrada está parada. */
  startRecording(): boolean;
  /** Para y devuelve lo guardado. Nulo si no había nada o falló. */
  stopRecording(): Promise<Recording | null>;
}

/** Si esta entrada sabe además guardar el sonido. */
export function canRecord(input: unknown): input is AudioRecorder {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as AudioRecorder).startRecording === 'function' &&
    typeof (input as AudioRecorder).stopRecording === 'function'
  );
}

/**
 * Lo más que se guarda, en segundos.
 *
 * Tres minutos. No es una regla musical: a 48 kHz son 34 MB de números en
 * memoria, y el análisis tarda algo más de un segundo por cada dos minutos. Un
 * trozo para componer son treinta segundos; esto es el tope por si alguien deja
 * el botón puesto y se va a comer.
 */
export const MAX_RECORDING_SECONDS = 180;
