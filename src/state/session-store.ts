/**
 * Estado de sesión: lo que está pasando ahora mismo mientras alguien toca.
 *
 * Esta capa solo conoce el dominio. No importa nada de audio/ a propósito: el
 * estado de la interfaz no es el estado del dispositivo, y quien traduce uno en
 * otro es el feature. Así el store se puede probar sin navegador y sin motor.
 */

import { create } from 'zustand';

import { describePitch, type PitchReading } from '@core/music';

/** Qué está haciendo la aplicación con la escucha, en términos de interfaz. */
export type ListeningState =
  'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'error';

export interface SessionActions {
  /** Cambia el estado de escucha y, si hay algo que contar, el mensaje. */
  setListening(state: ListeningState, message?: string | null): void;
  /** Registra la nota que suena, o null cuando deja de haber señal. */
  setPitch(frequency: number | null, clarity?: number): void;
  reset(): void;
}

export interface SessionState {
  readonly listening: ListeningState;
  /** Qué ha pasado y qué hacer. En español y ya listo para enseñar. */
  readonly message: string | null;
  readonly reading: PitchReading | null;
  readonly clarity: number;
  /**
   * Las acciones viven en un objeto propio que no se reemplaza nunca, para que
   * suscribirse a ellas no provoque renders. Es el equivalente a inyectar un
   * servicio: lo que cambia son los datos, no la forma de tocarlos.
   */
  readonly actions: SessionActions;
}

const EMPTY = {
  listening: 'idle',
  message: null,
  reading: null,
  clarity: 0,
} as const satisfies Omit<SessionState, 'actions'>;

export const useSessionStore = create<SessionState>()((set) => ({
  ...EMPTY,
  actions: {
    setListening: (listening, message = null) => set({ listening, message }),
    setPitch: (frequency, clarity = 0) =>
      set(
        frequency === null
          ? { reading: null, clarity: 0 }
          : { reading: describePitch(frequency), clarity },
      ),
    reset: () => set(EMPTY),
  },
}));

export const selectListening = (state: SessionState): ListeningState => state.listening;
export const selectMessage = (state: SessionState): string | null => state.message;
export const selectReading = (state: SessionState): PitchReading | null => state.reading;
export const selectClarity = (state: SessionState): number => state.clarity;
export const selectActions = (state: SessionState): SessionActions => state.actions;
