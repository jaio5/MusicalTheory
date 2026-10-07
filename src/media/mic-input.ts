/**
 * Acceso al micrófono **para grabar un fichero**, que no es lo mismo que
 * escuchar.
 *
 * `audio/` ya abre el micro para analizar lo que suena: mide el tono, saca el
 * croma y no guarda nada. Esto abre otro flujo con otro propósito —quedarse con
 * la toma— y por eso vive aquí y no allí: el permiso se pide cuando se decide
 * grabar, y quien solo viene a mirar acordes no lo ve nunca.
 *
 * La grabación **es de audio y solo de audio**. Hubo una fase con cámara —te
 * veías detrás de la interfaz mientras tocabas— y se quitó entera: pedía trípode,
 * pantalla grande y un permiso caro para algo que casi nadie usaba, mientras que
 * lo que se quiere volver a oír es lo que has tocado. Ver
 * [adr/0023](../../docs/adr/0023-grabar-solo-el-sonido.md).
 */

export type MicState = 'idle' | 'requesting' | 'running' | 'denied' | 'unsupported' | 'error';

export interface MicOptions {
  readonly deviceId?: string;
}

export interface MicInput {
  readonly state: MicState;
  /** El flujo del micrófono, o null si no está abierto. Nunca sale del equipo. */
  readonly stream: MediaStream | null;
  /** Qué ha pasado y qué hacer, en español, o null si no hay error. */
  readonly errorMessage: string | null;

  start(options?: MicOptions): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (state: MicState) => void): () => void;
}

// Quien lo implementa es `browser-mic-input.ts`, sobre
// navigator.mediaDevices.getUserMedia({ audio: ... }). Ver docs/RECORDING.md.
