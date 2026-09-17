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
  clampBpm,
  createPitchHistogram,
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  describePitch,
  detectKey,
  type CapturedChord,
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
  type WorkspacePreferences,
} from './workspace';

/** Qué está haciendo la aplicación con la escucha, en términos de interfaz. */
export type ListeningState =
  'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'error';

/** El acorde que se está oyendo, con lo que hace falta para enseñarlo. */
export interface HeardChord {
  readonly symbol: string;
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
  /** Cuánto se parece, de 0 a 1. */
  readonly score: number;
  /**
   * Cuánto se despega del siguiente candidato, de 0 a 1.
   *
   * Es lo que dice si había duda, y no la puntuación: un 0,90 con el segundo en
   * 0,89 es un empate que el motor resolvió casi a cara o cruz, y un 0,85 con el
   * segundo en 0,60 es una certeza. De aquí sale si un acorde apuntado hay que
   * preguntarlo o darlo por bueno.
   */
  readonly margin: number;
  /** Lo que también pudo ser, de más a menos parecido. */
  readonly alternatives: readonly HeardAlternative[];
  readonly at: number;
}

/** Un candidato que no ganó, con lo justo para poder elegirlo al corregir. */
export interface HeardAlternative {
  readonly symbol: string;
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
  readonly score: number;
}

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
  /**
   * Lo limpia que llegó la señal, de 0 a 1.
   *
   * Viaja con la nota por lo mismo que el margen viaja con el acorde: al pasar
   * un punteo a la partitura hay que poder decir de cuáles no se estaba seguro.
   * Se calculaba en cada análisis y se quedaba en el estado sin llegar a nada.
   */
  readonly clarity: number;
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
  setTuning(tuningId: TuningId): void;
  /** Recupera del equipo lo que había configurado. */
  loadWorkspace(): void;
  /** Deja constancia del acorde que se está oyendo, o de que no se oye ninguno. */
  setHeardChord(chord: HeardChord | null): void;
  /** Añade un acorde al final del camino. */
  pushChord(chord: PathChord): void;
  /** Corta el camino justo después del acorde que se pulsa. */
  trimPath(index: number): void;
  clearPath(): void;
  /** Marca qué grado está sonando, para sugerir a dónde ir desde ahí. */
  setCurrentDegree(degree: DegreeSymbol | null): void;
  /** El tempo con el que se mide lo que se graba. Lo pone el metrónomo. */
  setTempo(bpm: number, beatsPerBar: number): void;
  /**
   * Empieza a apuntar los acordes que se oigan, con su instante.
   *
   * Apuntar y no grabar: lo que se guarda son símbolos y milisegundos, nunca
   * sonido. El instante entra por parámetro, como en todo lo demás.
   */
  startCapture(at: number): void;
  /** Deja de apuntar. Lo apuntado se queda para poder usarlo. */
  stopCapture(at: number): void;
  /** Tira lo apuntado. */
  clearCapture(): void;
  /**
   * Cambia los acordes oídos en vivo por los del análisis de la grabación.
   *
   * No se llama `setCapture` a propósito: lo que hace es **sustituir una lectura
   * peor por una mejor del mismo trozo**, no grabar otra cosa. Los instantes
   * siguen siendo los de la grabación, así que `captureStartedAt` y
   * `captureEndedAt` no se tocan.
   */
  replaceCapture(chords: readonly CapturedChord[]): void;
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
  /** La afinación con la que se compara lo que suena. */
  readonly tuningId: TuningId;
  /** Las últimas notas tocadas, de la más antigua a la más reciente. */
  readonly noteHistory: readonly PlayedNote[];
  /** Grado que el usuario dice estar tocando, o null. */
  readonly currentDegree: DegreeSymbol | null;
  /** La progresión que se está armando, del primero al último. */
  readonly path: readonly PathChord[];
  /** Lo que se reconoce ahora mismo por el micro, o null si ya no suena. */
  readonly heardChord: HeardChord | null;
  /**
   * El último acorde que se reconoció, aunque haya dejado de sonar.
   *
   * Existe porque `heardChord` se apaga en cuanto sueltas las cuerdas, y con él
   * desaparecía de la pantalla lo que acababas de tocar. Para meterlo en el
   * camino había que tocarlo y darle al botón antes de que se apagara, que con
   * la guitarra en las manos no se puede.
   */
  readonly lastHeardChord: HeardChord | null;
  /**
   * El tempo, que vivía dentro del metrónomo y por eso no lo veía nadie más.
   *
   * Sube aquí porque lo necesitan dos cosas que no se conocen entre sí —el
   * metrónomo lo pone y la captura lo usa para medir cuánto dura cada acorde— y
   * un feature no importa de otro. De paso deja de perderse al cambiar de
   * pantalla.
   */
  readonly bpm: number;
  readonly beatsPerBar: number;
  /** Si se está apuntando lo que se toca. */
  readonly capturing: boolean;
  /** Los acordes apuntados, con su instante. Símbolos, no sonido. */
  readonly captured: readonly CapturedChord[];
  /** Cuándo se empezó y cuándo se paró, para medir el último acorde. */
  readonly captureStartedAt: number;
  readonly captureEndedAt: number;
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
  tuningId: DEFAULT_PREFERENCES.tuningId,
  noteHistory: [],
  currentDegree: null,
  path: [],
  heardChord: null,
  lastHeardChord: null,
  bpm: DEFAULT_BPM,
  beatsPerBar: DEFAULT_BEATS_PER_BAR,
  capturing: false,
  captured: [],
  captureStartedAt: 0,
  captureEndedAt: 0,
} as const satisfies Omit<SessionState, 'actions'>;

/**
 * Guarda la configuración cada vez que cambia. Es lo único que sale del estado
 * hacia el equipo, y va aquí y no en cada acción para que ninguna se olvide.
 */
function remember(state: SessionState, patch: Partial<WorkspacePreferences>): void {
  // Se parte de lo guardado y no de un objeto escrito aquí a mano: esta función
  // sabe de tonalidad, estilo, escala y afinación, y las preferencias tienen
  // además el reparto del banco de trabajo, que este almacén no lleva. Sin
  // partir de lo que hay, cambiar de escala borraba el reparto de alguien.
  savePreferences({
    ...loadPreferences(),
    styleId: state.styleId,
    scaleId: state.scaleId,
    tuningId: state.tuningId,
    pinnedKey: state.pinnedKey,
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
              { pitchClass: reading.pitchClass, midi: reading.midi, at, clarity },
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
    /**
     * La tonalidad **se recuerda**, como el estilo y la escala.
     *
     * No lo hacía, y era la que más falta hacía: sin ella no hay acordes que
     * proponer, ni escala que enseñar, ni preguntas que generar, así que las
     * cinco pantallas volvían a pedirla en cada recarga. La aplicación se
     * acordaba de que te gusta el rock y se olvidaba de en qué estabas tocando.
     */
    pinKey: (pinnedKey) =>
      set((state) => {
        remember(state, { pinnedKey });
        return { pinnedKey };
      }),

    // Volver a la detección también se recuerda: es una decisión, no un olvido.
    followDetection: () =>
      set((state) => {
        remember(state, { pinnedKey: null });
        return { pinnedKey: null };
      }),
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

    setTuning: (tuningId) =>
      set((state) => {
        remember(state, { tuningId });
        return { tuningId };
      }),

    loadWorkspace: () => {
      const preferences = loadPreferences();
      set({
        styleId: preferences.styleId,
        scaleId: preferences.scaleId,
        tuningId: preferences.tuningId,
        pinnedKey: preferences.pinnedKey,
      });
    },
    // El vivo se apaga al soltar las cuerdas; el último se queda. Así lo que
    // acabas de tocar sigue en pantalla y da tiempo a meterlo en el camino.
    setHeardChord: (heardChord) =>
      set((state) => ({
        heardChord,
        lastHeardChord: heardChord ?? state.lastHeardChord,
        // Mientras se apunta, cada acorde que llega entra en la lista con su
        // instante. El silencio no se apunta: lo que mide cuánto dura un acorde
        // es cuándo empieza el siguiente, y un hueco de nulos no aporta nada
        // que `captureProgression` no sepa deducir.
        captured:
          state.capturing && heardChord !== null
            ? [
                ...state.captured,
                {
                  root: heardChord.root,
                  notes: heardChord.notes,
                  at: heardChord.at,
                  // La confianza y los candidatos viajan con el acorde. Se
                  // quedaban aquí, y sin ellos lo apuntado no sabe de qué dudó.
                  score: heardChord.score,
                  margin: heardChord.margin,
                  alternatives: heardChord.alternatives.map((otra) => ({
                    root: otra.root,
                    notes: otra.notes,
                  })),
                },
              ]
            : state.captured,
      })),
    pushChord: (chord) => set((state) => ({ path: [...state.path, chord] })),
    trimPath: (index) => set((state) => ({ path: state.path.slice(0, index + 1) })),
    clearPath: () => set({ path: [] }),
    setCurrentDegree: (currentDegree) => set({ currentDegree }),
    setTempo: (bpm, beatsPerBar) => set({ bpm: clampBpm(bpm), beatsPerBar }),
    startCapture: (at) =>
      set({ capturing: true, captured: [], captureStartedAt: at, captureEndedAt: 0 }),
    stopCapture: (at) => set({ capturing: false, captureEndedAt: at }),
    clearCapture: () => set({ captured: [], captureStartedAt: 0, captureEndedAt: 0 }),
    replaceCapture: (chords) => set({ captured: [...chords] }),
    clearHistory: () =>
      set({
        noteHistory: [],
        histogram: createPitchHistogram(),
        keyCandidates: [],
        keyComputedAt: 0,
      }),
    reset: () =>
      set({
        ...EMPTY,
        histogram: createPitchHistogram(),
        noteHistory: [],
        path: [],
        heardChord: null,
        lastHeardChord: null,
      }),
  },
}));

/**
 * Solo quedan dos selectores con nombre, y no es un olvido.
 *
 * Hubo doce, uno por campo, y diez murieron sin que nadie los borrara: el
 * patrón que se impuso es el selector en línea —`useSessionStore((state) =>
 * state.scaleId)`—, que se lee donde se usa y no obliga a ir a buscar qué
 * devuelve. Están en sesenta y un sitios.
 *
 * Los dos que quedan **no se pueden escribir en línea**: `selectActions` porque
 * devuelve el objeto que no se reemplaza nunca, y `selectActiveKey` porque
 * calcula algo —la elegida a mano o la detectada— y escribirlo en cada
 * componente sería tener la regla en veintiún sitios.
 */
export const selectActions = (state: SessionState): SessionActions => state.actions;

/**
 * La tonalidad que manda: la fijada a mano si la hay, y si no la mejor
 * candidata. Devuelve referencias que ya existen en el estado, así que se
 * puede usar como selector sin provocar renders de más.
 */
export const selectActiveKey = (state: SessionState): SessionKey | null =>
  state.pinnedKey ?? state.keyCandidates[0] ?? null;
