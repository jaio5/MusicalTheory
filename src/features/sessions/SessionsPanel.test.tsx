// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { midiToFrequency, pitchClassFromName } from '@core/music';
import { MemorySessionStorage } from '@state/session-storage';
import { useSessionStore } from '@state/session-store';

import { SessionsPanel } from './SessionsPanel';

const A = pitchClassFromName('A');
const SAVED_AT = new Date(2026, 6, 28, 19, 5).getTime();

describe('Panel de sesiones', () => {
  let storage: MemorySessionStorage;

  beforeEach(() => {
    storage = new MemorySessionStorage();
  });

  function renderPanel() {
    render(<SessionsPanel createStorage={() => storage} now={() => SAVED_AT} />);
  }

  it('avisa de que no sube nada y de qué guarda', () => {
    renderPanel();
    expect(screen.getByText(/se guardan en tu navegador/i)).toBeInTheDocument();
    expect(screen.getByText(/sin cuenta ni servidor/i)).toBeInTheDocument();
  });

  it('empieza sin nada guardado', async () => {
    renderPanel();
    expect(await screen.findByText(/todavía no has guardado ninguna/i)).toBeInTheDocument();
  });

  it('guarda la sesión con su tonalidad y sus notas', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setPitch(midiToFrequency(45), 0.99, 0);
    actions.setPitch(midiToFrequency(48), 0.99, 500);

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /guardar esta sesión/i }));

    expect(await screen.findByText(/28\/07 19:05 · 2 notas/)).toBeInTheDocument();
    expect(screen.getByText(/La menor/)).toBeInTheDocument();

    const stored = await storage.list();
    expect(stored[0]!.notes).toEqual(['A', 'C']);
    // Lo que se guarda son símbolos, no audio.
    expect(JSON.stringify(stored[0])).not.toContain('frequency');
  });

  it('retomar una sesión devuelve su tonalidad y su escala', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setScale('blues');

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /guardar esta sesión/i }));

    // Se cambia todo y luego se retoma.
    actions.setScale('major');
    actions.followDetection();

    await userEvent.click(await screen.findByRole('button', { name: /retomar/i }));

    const state = useSessionStore.getState();
    expect(state.scaleId).toBe('blues');
    expect(state.pinnedKey).toEqual({ tonic: A, mode: 'minor' });
  });

  it('borra una sesión', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /guardar esta sesión/i }));
    await userEvent.click(await screen.findByRole('button', { name: /borrar/i }));

    expect(await screen.findByText(/todavía no has guardado ninguna/i)).toBeInTheDocument();
    expect(await storage.list()).toHaveLength(0);
  });

  it('explica qué pasa si el navegador no deja guardar', async () => {
    const broken = new MemorySessionStorage();
    broken.save = async () => {
      throw new Error('modo privado');
    };

    render(<SessionsPanel createStorage={() => broken} now={() => SAVED_AT} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar esta sesión/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/modo privado/i);
  });
});
