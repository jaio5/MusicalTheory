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
