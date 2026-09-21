import { beforeEach, describe, expect, it } from 'vitest';

import { A4_FREQUENCY } from '@core/music';

import { useSessionStore } from './session-store';

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
