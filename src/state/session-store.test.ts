// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  A4_FREQUENCY,
  captureProgression,
  pitchClassFromName,
  RETARDO_DEL_ACORDE_MS,
  type PitchClass,
} from '@core/music';

import {
  clasesDeLaMascara,
  NIVEL_QUE_SUENA,
  selectActiveKey,
  selectClasesOidas,
  selectEscala,
  selectTonalidadParaAprender,
  TONALIDAD_DE_PARTIDA,
  useSessionStore,
} from './session-store';
import { loadPreferences } from './workspace';

describe('store de sesión', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  it('arranca sin escuchar y sin nota', () => {
    const state = useSessionStore.getState();
    expect(state.listening).toBe('idle');
    expect(state.reading).toBeNull();
    expect(state.message).toBeNull();
  });

  it('guarda el estado de escucha con su mensaje', () => {
    useSessionStore.getState().actions.setListening('denied', 'Has denegado el micrófono.');

    const state = useSessionStore.getState();
    expect(state.listening).toBe('denied');
    expect(state.message).toBe('Has denegado el micrófono.');
  });

  it('limpia el mensaje cuando el nuevo estado no trae ninguno', () => {
    const { actions } = useSessionStore.getState();
    actions.setListening('error', 'Algo ha fallado.');
    actions.setListening('listening');

    expect(useSessionStore.getState().message).toBeNull();
  });

  it('interpreta la frecuencia como nota antes de guardarla', () => {
    useSessionStore.getState().actions.setPitch(A4_FREQUENCY, 0.98);

    const state = useSessionStore.getState();
    expect(state.reading).toMatchObject({ name: 'A', octave: 4 });
    expect(state.reading?.cents).toBeCloseTo(0, 6);
    expect(state.clarity).toBeCloseTo(0.98, 6);
  });

  it('conserva la última nota cuando deja de haber señal', () => {
    const { actions } = useSessionStore.getState();
    actions.setPitch(A4_FREQUENCY, 0.98);
    actions.setPitch(null);

    const state = useSessionStore.getState();
    // La lectura sobrevive para que el afinador se apague en vez de
    // desaparecer; lo que se apaga es hasSignal.
    expect(state.reading).toMatchObject({ name: 'A' });
    expect(state.hasSignal).toBe(false);
    expect(state.clarity).toBe(0);
  });

  it('marca que hay señal mientras suena', () => {
    useSessionStore.getState().actions.setPitch(A4_FREQUENCY, 0.98);
    expect(useSessionStore.getState().hasSignal).toBe(true);
  });

  it('reset deja el store como al principio', () => {
    const { actions } = useSessionStore.getState();
    actions.setPitch(A4_FREQUENCY, 0.98);
    actions.setListening('listening');
    actions.reset();

    expect(useSessionStore.getState()).toMatchObject({
      listening: 'idle',
      reading: null,
      hasSignal: false,
      clarity: 0,
    });
  });

  it('mantiene la identidad de las acciones para no provocar renders', () => {
    const before = useSessionStore.getState().actions;
    useSessionStore.getState().actions.setPitch(A4_FREQUENCY);

    expect(useSessionStore.getState().actions).toBe(before);
  });
});

describe('lo que se olvida', () => {
  /**
   * Olvidar lo tocado borra el historial de notas y lo que se dedujo de él: la
   * tonalidad que se estaba detectando sale de ese histograma, así que dejarla
   * puesta sería seguir diciendo «creo que estás en La menor» sobre nada.
   */
  it('borrar el historial borra tambien lo que se dedujo de el', () => {
    const { actions } = useSessionStore.getState();
    actions.setPitch(440, 0.9, 1000);
    actions.setPitch(329.6, 0.9, 2000);
    expect(useSessionStore.getState().noteHistory.length).toBeGreaterThan(0);

    actions.clearHistory();

    const estado = useSessionStore.getState();
    expect(estado.noteHistory).toEqual([]);
    expect(estado.keyCandidates).toEqual([]);
    expect(estado.histogram.weights.every((peso) => peso === 0)).toBe(true);
  });

  /**
   * Y al apuntar un acorde oído se guardan también sus candidatos: sin ellos, lo
   * apuntado no sabe de qué dudó y no se puede ofrecer una corrección.
   */
  it('lo apuntado se lleva los candidatos que tambien cabian', () => {
    const { actions } = useSessionStore.getState();
    actions.startCapture(0);

    actions.setHeardChord({
      symbol: 'C',
      root: 0 as never,
      notes: [0, 4, 7] as never,
      at: 100,
      score: 0.9,
      margin: 0.05,
      alternatives: [{ symbol: 'Am', root: 9 as never, notes: [9, 0, 4] as never, score: 0.85 }],
    });

    const [apuntado] = useSessionStore.getState().captured;
    expect(apuntado?.margin).toBe(0.05);
    expect(apuntado?.alternatives).toEqual([{ root: 9, notes: [9, 0, 4] }]);
  });
});

describe('la tonalidad que manda', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  /**
   * `detectKey` devuelve candidatas nuevas cada medio segundo. Si el selector
   * las devolviera tal cual, cada recálculo repintaría a todos los suscritos
   * aunque siguieras en la misma tonalidad.
   */
  it('recalcular la misma tonalidad devuelve el mismo objeto', () => {
    const { actions } = useSessionStore.getState();
    // Un La sostenido: la tonalidad no se mueve, pero se recalcula dos veces.
    actions.setPitch(440, 0.9, 1000);
    const antes = useSessionStore.getState();
    const primera = selectActiveKey(antes);
    actions.setPitch(440, 0.9, 1600);
    const despues = useSessionStore.getState();

    expect(despues.keyCandidates).not.toBe(antes.keyCandidates);
    expect(despues.keyCandidates[0]).not.toBe(antes.keyCandidates[0]);
    expect(primera).not.toBeNull();
    expect(selectActiveKey(despues)).toBe(primera);
  });

  it('solo trae tonica y modo, aunque la candidata traiga mas', () => {
    useSessionStore.getState().actions.setPitch(440, 0.9, 1000);
    const clave = selectActiveKey(useSessionStore.getState());

    expect(Object.keys(clave ?? {}).sort()).toEqual(['mode', 'tonic']);
    expect(Object.isFrozen(clave)).toBe(true);
  });

  it('la fijada a mano manda, y es la misma que la detectada si coinciden', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: 9, mode: 'minor' });
    const fijada = selectActiveKey(useSessionStore.getState());

    expect(fijada).toEqual({ tonic: 9, mode: 'minor' });
    actions.pinKey({ tonic: 9, mode: 'minor' });
    expect(selectActiveKey(useSessionStore.getState())).toBe(fijada);
  });

  it('sin fijada ni detectada no hay tonalidad', () => {
    expect(selectActiveKey(useSessionStore.getState())).toBeNull();
  });
});

/**
 * El acorde que ya sonaba al empezar a apuntar.
 *
 * El croma solo avisa cuando el acorde cambia. Quien rasguea durante la cuenta
 * ya tiene el acorde puesto al llegar el compás uno, así que ese no volvía a
 * decirse y no se apuntaba: con un WAV de C G Am F empezado dos pulsos antes de
 * «¡Ahora!», la toma escribía «G Am F».
 */
describe('el acorde que ya sonaba al empezar', () => {
  /** A 100, como el WAV con el que se midió: un pulso son 600 ms. */
  const PULSO = 600;
  /** Dónde cae el compás uno. */
  const COMPAS_UNO = 10_000;
  const EN_DO = { tonic: 0 as PitchClass, mode: 'major' as const, bpm: 100, beatsPerBar: 4 };

  const ACORDES = {
    C: { root: 0, notes: [0, 4, 7] },
    G: { root: 7, notes: [7, 11, 2] },
    Am: { root: 9, notes: [9, 0, 4] },
    F: { root: 5, notes: [5, 9, 0] },
  } as const;

  /** El croma diciendo un acorde que empezó a sonar en `empezo`. */
  function dice(symbol: keyof typeof ACORDES, empezo: number, margin = 0.4): void {
    useSessionStore.getState().actions.setHeardChord({
      symbol,
      root: ACORDES[symbol].root as PitchClass,
      notes: ACORDES[symbol].notes as unknown as PitchClass[],
      score: 0.95,
      margin,
      alternatives: [],
      // Lo dice cuando lo dice: lo que tarda el motor después de que suene.
      at: empezo + RETARDO_DEL_ACORDE_MS,
    });
  }

  /** Lo que escribiría la toma, contra la rejilla del compás uno. */
  function loEscrito(): string[] {
    const estado = useSessionStore.getState();
    return captureProgression(estado.captured, {
      ...EN_DO,
      endedAt: estado.captureEndedAt,
      startedAt: estado.captureStartedAt,
    }).steps.map((paso) => `${paso.degree}:${paso.beats}`);
  }

  /** G, Am y F, un compás cada uno detrás del primero, y parar. */
  function sigueConGAmF(): void {
    dice('G', COMPAS_UNO + 4 * PULSO);
    dice('Am', COMPAS_UNO + 8 * PULSO);
    dice('F', COMPAS_UNO + 12 * PULSO);
    useSessionStore.getState().actions.stopCapture(COMPAS_UNO + 16 * PULSO);
  }

  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  it('rasgueado dos pulsos antes del compás uno, entra como el primero y en el compás uno', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);
    dice('C', COMPAS_UNO - 2 * PULSO);

    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });

    const [primero] = useSessionStore.getState().captured;
    expect(primero).toMatchObject({ root: 0, notes: [0, 4, 7], margin: 0.4 });
    // Descontado lo que tarda el motor, que la rejilla descuenta a todos, cae
    // justo en el compás uno: ni antes ni después.
    expect(primero!.at - RETARDO_DEL_ACORDE_MS).toBe(COMPAS_UNO);

    sigueConGAmF();
    expect(loEscrito()).toEqual(['I:4', 'V:4', 'vi:4', 'IV:4']);
  });

  it('sin pedirlo se apunta como antes, y el primero se pierde', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);
    dice('C', COMPAS_UNO - 2 * PULSO);

    actions.startCapture(COMPAS_UNO);

    expect(useSessionStore.getState().captured).toEqual([]);
    sigueConGAmF();
    // El compás vacío de delante no se escribe: la canción empieza en el G, que
    // es el fallo que se medía.
    expect(loEscrito()).toEqual(['V:4', 'vi:4', 'IV:4']);
  });

  it('sin acorde sonando no se inventa nada', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);

    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });

    expect(useSessionStore.getState().captured).toEqual([]);
    expect(useSessionStore.getState().primeroYaSonaba).toBe(false);
  });

  it('el que dejó de oírse tampoco: el croma lo dijo, pero ya no suena nada', () => {
    const { actions } = useSessionStore.getState();
    dice('C', COMPAS_UNO - 8 * PULSO);
    // En silencio el croma sostiene el acorde; el nivel es lo que sabe que calló.
    actions.setLevel(NIVEL_QUE_SUENA / 2);

    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });

    expect(useSessionStore.getState().captured).toEqual([]);
  });

  it('el mismo acorde dicho otra vez no se duplica, y se queda con la peor duda', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);
    dice('C', COMPAS_UNO - 2 * PULSO);
    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });

    // Un hueco y el mismo Do otra vez, justo después del compás uno.
    actions.setHeardChord(null);
    dice('C', COMPAS_UNO + PULSO, 0.1);

    const { captured } = useSessionStore.getState();
    expect(captured).toHaveLength(1);
    expect(captured[0]!.at - RETARDO_DEL_ACORDE_MS).toBe(COMPAS_UNO);
    expect(captured[0]!.margin).toBe(0.1);

    sigueConGAmF();
    expect(loEscrito()).toEqual(['I:4', 'V:4', 'vi:4', 'IV:4']);
  });

  it('si se cambia de acorde antes del compás uno, el que sonaba sobra', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);
    dice('Am', COMPAS_UNO - 4 * PULSO);
    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });

    // El Do, rasgueado en el último pulso de la cuenta: lo dice antes de que el
    // La menor llegue a su sitio.
    dice('C', COMPAS_UNO - PULSO / 2);

    expect(useSessionStore.getState().captured.map((acorde) => acorde.root)).toEqual([0]);
    sigueConGAmF();
    expect(loEscrito()).toEqual(['I:4', 'V:4', 'vi:4', 'IV:4']);
  });

  it('pasado el primero, lo que llega se apunta como siempre, aunque se repita', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);
    dice('C', COMPAS_UNO - 2 * PULSO);
    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });
    dice('G', COMPAS_UNO + 4 * PULSO);
    dice('G', COMPAS_UNO + 6 * PULSO);

    expect(useSessionStore.getState().captured.map((acorde) => acorde.root)).toEqual([0, 7, 7]);
  });

  it('vaciar o sustituir lo apuntado quita la marca del que ya sonaba', () => {
    const { actions } = useSessionStore.getState();
    actions.setLevel(0.05);
    dice('C', COMPAS_UNO - 2 * PULSO);
    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });
    expect(useSessionStore.getState().primeroYaSonaba).toBe(true);

    actions.replaceCapture(useSessionStore.getState().captured);
    expect(useSessionStore.getState().primeroYaSonaba).toBe(false);

    actions.startCapture(COMPAS_UNO, { conElQueSuena: true });
    actions.clearCapture();
    expect(useSessionStore.getState().primeroYaSonaba).toBe(false);
  });
});

/**
 * **La escala sigue a la tonalidad mientras nadie elija otra.** Era la pentatónica
 * menor para todo el mundo, y en Do mayor enseñaba Mib y Sib a quien aprendía las
 * notas de Do (adr/0109).
 */
describe('la escala que manda', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.getState().actions.reset();
    useSessionStore.setState({ scaleId: null, pinnedKey: null });
  });

  it('sin elegir, la de la tonalidad: mayor en mayor y menor natural en menor', () => {
    const { actions } = useSessionStore.getState();
    expect(selectEscala(useSessionStore.getState())).toBe('major');

    actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    expect(selectEscala(useSessionStore.getState())).toBe('naturalMinor');

    actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    expect(selectEscala(useSessionStore.getState())).toBe('major');
  });

  it('elegida a mano, manda la elegida aunque cambie la tonalidad', () => {
    const { actions } = useSessionStore.getState();
    actions.setScale('blues');
    actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    expect(selectEscala(useSessionStore.getState())).toBe('blues');
  });

  // Se guarda nula, no la que sale ahora: si se guardara, dejaría de seguir a la
  // tonalidad en la siguiente visita sin que nadie la hubiera tocado.
  it('fijar la tonalidad no guarda una escala que nadie eligió', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('G'), mode: 'major' });

    expect(loadPreferences().scaleId).toBeNull();
  });
});

/** Aprender no espera a que se elija tonalidad: va en Do mayor (adr/0109). */
describe('la tonalidad para aprender', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({ pinnedKey: null, keyCandidates: [] });
  });

  it('sin ninguna, Do mayor, y sin fijarla', () => {
    const tonalidad = selectTonalidadParaAprender(useSessionStore.getState());

    expect(tonalidad).toBe(TONALIDAD_DE_PARTIDA);
    expect(tonalidad).toEqual({ tonic: 0, mode: 'major' });
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });

  it('con una elegida, la elegida', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('E'), mode: 'minor' });

    expect(selectTonalidadParaAprender(useSessionStore.getState())).toEqual({
      tonic: pitchClassFromName('E'),
      mode: 'minor',
    });
  });
});

/**
 * Qué clases han sonado, en un número: lo que miran las propuestas de lo tocado
 * es cuáles, no cuántas veces ni en qué orden.
 */
describe('las clases oidas', () => {
  it('cada clase es un bit, y repetirla no cambia el numero', () => {
    const { actions } = useSessionStore.getState();
    actions.reset();
    expect(selectClasesOidas(useSessionStore.getState())).toBe(0);

    actions.setPitch(440, 0.99, 0); // A
    const conLa = selectClasesOidas(useSessionStore.getState());
    actions.setPitch(220, 0.99, 1000); // A otra vez
    expect(selectClasesOidas(useSessionStore.getState())).toBe(conLa);

    actions.setPitch(261.63, 0.99, 2000); // C
    expect(clasesDeLaMascara(selectClasesOidas(useSessionStore.getState()))).toEqual([0, 9]);
  });
});
