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
  type DegreeSymbol,
  type PitchReading,
  type ScaleId,
  type StyleId,
} from '@core/music';
import type { TuningId } from '@core/instrument';

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type ScreenId,
  type WorkspacePreferences,
} from './workspace';

/** Qué está haciendo la aplicación con la escucha, en términos de interfaz. */
export type ListeningState =
  'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'error';

/** Un acorde del camino, ya listo para enseñar. */
export interface PathChord {
  readonly symbol: string;
  /** El grado, o de dónde sale: «bVII», «V7/vi». */
  readonly label: string;
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
  readonly why: string;
}

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

/**
 * Cuántas notas del historial se guardan. Suficiente para ver por dónde va la
 * frase sin convertir el panel en un muro de texto.
 */
export const NOTE_HISTORY_LIMIT = 24;

/**
 * Cuánto tiene que cambiar la nota para contarla como una nueva en el
 * historial. Sin esto, sostener una nota metería veinte entradas por segundo.
 */
export const NOTE_REPEAT_MS = 250;

export interface PlayedNote {
  readonly pitchClass: PitchClass;
  readonly midi: number;
  readonly at: number;
}

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
  setPitch(frequency: number | null, clarity?: number, at?: number, rms?: number): void;
  /** Nivel de entrada aunque no haya nota reconocible, para el medidor. */
  setLevel(rms: number): void;
  /** Fija una tonalidad a mano y deja de seguir la detección. */
  pinKey(key: SessionKey): void;
  /** Vuelve a hacer caso a lo que se detecta. */
  followDetection(): void;
  setScale(scaleId: ScaleId): void;
  setStyle(styleId: StyleId): void;
  /** Cambia de pantalla y lo recuerda para la próxima vez. */
  setScreen(screen: ScreenId): void;
  setTuning(tuningId: TuningId): void;
  /** Recupera del equipo lo que había configurado. */
  loadWorkspace(): void;
  /** Añade un acorde al final del camino. */
  pushChord(chord: PathChord): void;
  /** Corta el camino justo después del acorde que se pulsa. */
  trimPath(index: number): void;
  clearPath(): void;
  /** Marca qué grado está sonando, para sugerir a dónde ir desde ahí. */
  setCurrentDegree(degree: DegreeSymbol | null): void;
  clearHistory(): void;
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
  /** Nivel de la señal que entra, de 0 a 1. Sirve para ajustar los umbrales. */
  readonly level: number;
  /** Reparto de notas tocadas, con decaimiento. Alimenta la detección. */
  readonly histogram: PitchHistogram;
  /** Las tres tonalidades que mejor explican lo tocado, de mejor a peor. */
  readonly keyCandidates: readonly KeyCandidate[];
  /** Instante del último cálculo de tonalidad, para no repetirlo de más. */
  readonly keyComputedAt: number;
  /** Tonalidad elegida a mano, o null si manda la detección. */
  readonly pinnedKey: SessionKey | null;
  readonly scaleId: ScaleId;
  readonly styleId: StyleId;
  /** En qué pantalla estás. */
  readonly screen: ScreenId;
  /** La afinación con la que se compara lo que suena. */
  readonly tuningId: TuningId;
  /** Las últimas notas tocadas, de la más antigua a la más reciente. */
  readonly noteHistory: readonly PlayedNote[];
  /** Grado que el usuario dice estar tocando, o null. */
  readonly currentDegree: DegreeSymbol | null;
  /** La progresión que se está armando, del primero al último. */
  readonly path: readonly PathChord[];
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
  level: 0,
  histogram: createPitchHistogram(),
  keyCandidates: [],
  keyComputedAt: 0,
  pinnedKey: null,
  scaleId: 'minorPentatonic',
  styleId: DEFAULT_PREFERENCES.styleId,
  screen: DEFAULT_PREFERENCES.screen,
  tuningId: DEFAULT_PREFERENCES.tuningId,
  noteHistory: [],
  currentDegree: null,
  path: [],
} as const satisfies Omit<SessionState, 'actions'>;

/**
 * Guarda la configuración cada vez que cambia. Es lo único que sale del estado
 * hacia el equipo, y va aquí y no en cada acción para que ninguna se olvide.
 */
function remember(state: SessionState, patch: Partial<WorkspacePreferences>): void {
  savePreferences({
    screen: state.screen,
    styleId: state.styleId,
    scaleId: state.scaleId,
    tuningId: state.tuningId,
    ...patch,
  });
}

export const useSessionStore = create<SessionState>()((set) => ({
  ...EMPTY,
  actions: {
    setListening: (listening, message = null) => set({ listening, message }),

    setPitch: (frequency, clarity = 0, at = 0, rms) =>
      set((state) => {
        if (frequency === null) {
          return { hasSignal: false, clarity: 0 };
        }

        const reading = describePitch(frequency);
        const histogram = addPitchClass(state.histogram, reading.pitchClass, at);
        const stale = at - state.keyComputedAt >= KEY_REFRESH_MS;

        // Una nota entra en el historial si es distinta de la última, o si la
        // misma vuelve a sonar tras una pausa: sostenerla no cuenta veinte
        // veces.
        const last = state.noteHistory.at(-1);
        const isNew =
          last === undefined || last.midi !== reading.midi || at - last.at >= NOTE_REPEAT_MS;
        const noteHistory = isNew
          ? [
              ...state.noteHistory,
              { pitchClass: reading.pitchClass, midi: reading.midi, at },
            ].slice(-NOTE_HISTORY_LIMIT)
          : state.noteHistory;

        return {
          reading,
          readingAt: at,
          hasSignal: true,
          clarity,
          ...(rms === undefined ? {} : { level: rms }),
          histogram,
          noteHistory,
          ...(stale ? { keyCandidates: detectKey(histogram, 3), keyComputedAt: at } : {}),
        };
      }),

    setLevel: (level) => set({ level }),
    pinKey: (pinnedKey) => set({ pinnedKey }),
    followDetection: () => set({ pinnedKey: null }),
    setScale: (scaleId) =>
      set((state) => {
        remember(state, { scaleId });
        return { scaleId };
      }),

    setStyle: (styleId) =>
      set((state) => {
        remember(state, { styleId });
        return { styleId };
      }),

    setScreen: (screen) =>
      set((state) => {
        remember(state, { screen });
        return { screen };
      }),

    setTuning: (tuningId) =>
      set((state) => {
        remember(state, { tuningId });
        return { tuningId };
      }),

    loadWorkspace: () => {
      const preferences = loadPreferences();
      set({
        screen: preferences.screen,
        styleId: preferences.styleId,
        scaleId: preferences.scaleId,
        tuningId: preferences.tuningId,
      });
    },
    pushChord: (chord) => set((state) => ({ path: [...state.path, chord] })),
    trimPath: (index) => set((state) => ({ path: state.path.slice(0, index + 1) })),
    clearPath: () => set({ path: [] }),
    setCurrentDegree: (currentDegree) => set({ currentDegree }),
    clearHistory: () =>
      set({
        noteHistory: [],
        histogram: createPitchHistogram(),
        keyCandidates: [],
        keyComputedAt: 0,
      }),
    reset: () => set({ ...EMPTY, histogram: createPitchHistogram(), noteHistory: [], path: [] }),
  },
}));

export const selectListening = (state: SessionState): ListeningState => state.listening;
export const selectMessage = (state: SessionState): string | null => state.message;
export const selectReading = (state: SessionState): PitchReading | null => state.reading;
export const selectReadingAt = (state: SessionState): number => state.readingAt;
export const selectHasSignal = (state: SessionState): boolean => state.hasSignal;
export const selectClarity = (state: SessionState): number => state.clarity;
export const selectLevel = (state: SessionState): number => state.level;
export const selectScaleId = (state: SessionState): ScaleId => state.scaleId;
export const selectStyleId = (state: SessionState): StyleId => state.styleId;
export const selectScreen = (state: SessionState): ScreenId => state.screen;
export const selectNoteHistory = (state: SessionState): readonly PlayedNote[] => state.noteHistory;
export const selectActions = (state: SessionState): SessionActions => state.actions;

/**
 * La tonalidad que manda: la fijada a mano si la hay, y si no la mejor
 * candidata. Devuelve referencias que ya existen en el estado, así que se
 * puede usar como selector sin provocar renders de más.
 */
export const selectActiveKey = (state: SessionState): SessionKey | null =>
  state.pinnedKey ?? state.keyCandidates[0] ?? null;
