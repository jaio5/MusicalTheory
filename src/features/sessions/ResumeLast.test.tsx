// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { MemorySessionStorage, type StoredSession } from '@state/session-storage';
import { useSessionStore } from '@state/session-store';

import { ResumeLast } from './ResumeLast';

const C = pitchClassFromName('C');

const AYER: StoredSession = {
  id: '1',
  savedAt: 1000,
  key: { tonic: C, mode: 'major' },
  scaleId: 'minorPentatonic',
  notes: ['C', 'E', 'G'],
  chords: ['C', 'G'],
};

/** Un almacén con lo que se le pase dentro. */
function almacen(sessions: readonly StoredSession[]) {
  const storage = new MemorySessionStorage();
  for (const session of sessions) {
    void storage.save(session);
  }
  return () => storage;
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('la última sesión', () => {
  it('se ofrece diciendo qué había dentro, para poder decidir sin abrirla', async () => {
    render(<ResumeLast createStorage={almacen([AYER])} />);

    expect(await screen.findByText(/La última vez estabas en/)).toBeInTheDocument();
    expect(screen.getByText('C mayor')).toBeInTheDocument();
    expect(screen.getByText(/pentatónica menor/i)).toBeInTheDocument();
  });

  it('no se pone sola: pinchar es lo que la aplica', async () => {
    render(<ResumeLast createStorage={almacen([AYER])} />);
    await screen.findByText(/La última vez estabas en/);

    // Antes de pulsar, el estado sigue virgen. Entrar y encontrarte una
    // tonalidad que no has elegido hoy es peor que no encontrarte nada.
    expect(useSessionStore.getState().pinnedKey).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Seguir por ahí/ }));

    expect(useSessionStore.getState().pinnedKey).toEqual({ tonic: C, mode: 'major' });
    expect(useSessionStore.getState().scaleId).toBe('minorPentatonic');
  });

  it('desaparece al aplicarla', async () => {
    render(<ResumeLast createStorage={almacen([AYER])} />);
    await userEvent.click(await screen.findByRole('button', { name: /Seguir por ahí/ }));

    expect(screen.queryByText(/La última vez estabas en/)).not.toBeInTheDocument();
  });

  it('se puede cerrar sin aplicarla', async () => {
    render(<ResumeLast createStorage={almacen([AYER])} />);
    await userEvent.click(await screen.findByRole('button', { name: /Empezar de cero/ }));

    expect(screen.queryByText(/La última vez estabas en/)).not.toBeInTheDocument();
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });

  it('no se pinta si ya has elegido tonalidad: entonces la sesión que importa es esta', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'minor' });
    render(<ResumeLast createStorage={almacen([AYER])} />);

    expect(screen.queryByText(/La última vez estabas en/)).not.toBeInTheDocument();
  });

  it('no se pinta si ya has encadenado un acorde', async () => {
    useSessionStore.getState().actions.pushChord({
      symbol: 'C',
      label: 'I',
      root: C,
      notes: [C],
      why: 'porque sí',
    });
    render(<ResumeLast createStorage={almacen([AYER])} />);

    expect(screen.queryByText(/La última vez estabas en/)).not.toBeInTheDocument();
  });

  it('sin nada guardado no dice nada', async () => {
    render(<ResumeLast createStorage={almacen([])} />);

    expect(screen.queryByText(/La última vez estabas en/)).not.toBeInTheDocument();
  });

  it('una sesión sin tonalidad no se ofrece: no habría nada que retomar', async () => {
    render(<ResumeLast createStorage={almacen([{ ...AYER, key: null }])} />);

    expect(screen.queryByText(/La última vez estabas en/)).not.toBeInTheDocument();
  });
});
