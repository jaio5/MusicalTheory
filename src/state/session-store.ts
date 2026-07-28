/**
 * Estado de sesión: lo que está pasando ahora mismo mientras alguien toca.
 *
 * Esta capa solo conoce el dominio. No importa nada de audio/ a propósito: el
 * estado de la interfaz no es el estado del dispositivo, y quien traduce uno en
 * otro es el feature. Así el store se puede probar sin navegador y sin motor.
 */

import { create } from 'zustand';

import {
  addPitchClass,
  createPitchHistogram,
  describePitch,
  detectKey,
  type KeyCandidate,
  type KeyMode,
  type PitchClass,
  type PitchHistogram,
  type PitchReading,
  type ScaleId,
} from '@core/music';

/** Qué está haciendo la aplicación con la escucha, en términos de interfaz. */
export type ListeningState =
  'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'error';

export interface SessionKey {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
}

/**
 * Cada cuánto se recalcula la tonalidad. El motor entrega veinte lecturas por
 * segundo, y correlacionar con los veinticuatro perfiles en cada una no aporta
 * nada: la tonalidad no cambia en cincuenta milisegundos, y recalcularla haría
 * repintar la rueda constantemente.
 */
export const KEY_REFRESH_MS = 500;

export interface SessionActions {
  /** Cambia el estado de escucha y, si hay algo que contar, el mensaje. */
  setListening(state: ListeningState, message?: string | null): void;
  /**
   * Registra la nota que suena, o null cuando deja de haber señal. Al perder
   * la señal se conserva la última nota: lo que cambia es `hasSignal`, no la
   * lectura. Así la interfaz puede apagarla en vez de hacerla desaparecer.
   *
   * El instante llega desde el motor porque el dominio no lee el reloj.
   */
  setPitch(frequency: number | null, clarity?: number, at?: number): void;
  /** Fija una tonalidad a mano y deja de seguir la detección. */
  pinKey(key: SessionKey): void;
  /** Vuelve a hacer caso a lo que se detecta. */
  followDetection(): void;
  setScale(scaleId: ScaleId): void;
  reset(): void;
}

export interface SessionState {
  readonly listening: ListeningState;
  /** Qué ha pasado y qué hacer. En español y ya listo para enseñar. */
  readonly message: string | null;
  /** La última nota detectada. Sobrevive al silencio. */
  readonly reading: PitchReading | null;
  /** Instante de esa lectura. Lo necesita quien mida cuánto se sostiene. */
  readonly readingAt: number;
  /** Si esa nota está sonando ahora mismo. */
  readonly hasSignal: boolean;
  readonly clarity: number;
  /** Reparto de notas tocadas, con decaimiento. Alimenta la detección. */
  readonly histogram: PitchHistogram;
  /** Las tres tonalidades que mejor explican lo tocado, de mejor a peor. */
  readonly keyCandidates: readonly KeyCandidate[];
  /** Instante del último cálculo de tonalidad, para no repetirlo de más. */
  readonly keyComputedAt: number;
  /** Tonalidad elegida a mano, o null si manda la detección. */
  readonly pinnedKey: SessionKey | null;
  readonly scaleId: ScaleId;
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
  readingAt: 0,
  hasSignal: false,
  clarity: 0,
  histogram: createPitchHistogram(),
  keyCandidates: [],
  keyComputedAt: 0,
  pinnedKey: null,
  scaleId: 'minorPentatonic',
} as const satisfies Omit<SessionState, 'actions'>;

export const useSessionStore = create<SessionState>()((set) => ({
  ...EMPTY,
  actions: {
    setListening: (listening, message = null) => set({ listening, message }),

    setPitch: (frequency, clarity = 0, at = 0) =>
      set((state) => {
        if (frequency === null) {
          return { hasSignal: false, clarity: 0 };
        }

        const reading = describePitch(frequency);
        const histogram = addPitchClass(state.histogram, reading.pitchClass, at);
        const stale = at - state.keyComputedAt >= KEY_REFRESH_MS;

        return {
          reading,
          readingAt: at,
          hasSignal: true,
          clarity,
          histogram,
          ...(stale ? { keyCandidates: detectKey(histogram, 3), keyComputedAt: at } : {}),
        };
      }),

    pinKey: (pinnedKey) => set({ pinnedKey }),
    followDetection: () => set({ pinnedKey: null }),
    setScale: (scaleId) => set({ scaleId }),
    reset: () => set({ ...EMPTY, histogram: createPitchHistogram() }),
  },
}));

export const selectListening = (state: SessionState): ListeningState => state.listening;
export const selectMessage = (state: SessionState): string | null => state.message;
export const selectReading = (state: SessionState): PitchReading | null => state.reading;
export const selectReadingAt = (state: SessionState): number => state.readingAt;
export const selectHasSignal = (state: SessionState): boolean => state.hasSignal;
export const selectClarity = (state: SessionState): number => state.clarity;
export const selectScaleId = (state: SessionState): ScaleId => state.scaleId;
export const selectActions = (state: SessionState): SessionActions => state.actions;

/**
 * La tonalidad que manda: la fijada a mano si la hay, y si no la mejor
 * candidata. Devuelve referencias que ya existen en el estado, así que se
 * puede usar como selector sin provocar renders de más.
 */
export const selectActiveKey = (state: SessionState): SessionKey | null =>
  state.pinnedKey ?? state.keyCandidates[0] ?? null;
