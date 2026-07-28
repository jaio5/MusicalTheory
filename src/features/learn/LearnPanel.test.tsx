// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ReferenceTone } from '@audio/reference-tone';
import { midiToFrequency, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { HOLD_MS } from './exercise';
import { LearnPanel } from './LearnPanel';

class FakeTone implements ReferenceTone {
  played: number[] = [];
  async play(frequency: number): Promise<void> {
    this.played.push(frequency);
  }
  stop(): void {}
  async dispose(): Promise<void> {}
}

/**
 * Simula que suena una nota afinada en ese instante, dejando que React procese
 * la lectura antes de la siguiente. En la aplicación real llegan cada 50 ms;
 * encadenarlas sin esperar haría que se saltase estados intermedios que sí
 * ocurren de verdad.
 */
async function play(midi: number, at: number) {
  await act(async () => {
    useSessionStore.getState().actions.setPitch(midiToFrequency(midi), 0.99, at);
  });
}

describe('Panel de aprender', () => {
  let tone: FakeTone;

  beforeEach(() => {
    tone = new FakeTone();
  });

  function renderPanel() {
    render(<LearnPanel createTone={() => tone} />);
  }

  it('pide una tonalidad antes de poder practicar', () => {
    renderPanel();
    expect(screen.getByText(/elige una tonalidad o toca unos compases/i)).toBeInTheDocument();
  });

  it('propone la escala de la tonalidad activa', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();

    expect(
      await screen.findByText(/pentatónica menor de La, subiendo y bajando/i),
    ).toBeInTheDocument();
    // Cinco notas más la octava subiendo, cinco bajando.
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
  });

  it('deja oír la nota que toca', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /oír la nota/i }));

    expect(tone.played).toHaveLength(1);
    expect(tone.played[0]).toBeCloseTo(midiToFrequency(45), 1);
  });

  it('avanza cuando la nota se sostiene y no antes', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    expect(await screen.findByText(/toca La/i)).toBeInTheDocument();

    // Rozarla no basta.
    await play(45, 0);
    await play(45, HOLD_MS - 100);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    // Sostenerla sí.
    await play(45, HOLD_MS + 100);
    expect(await screen.findByText(/toca Do/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('no avanza con la nota equivocada', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    await play(47, 0);
    await play(47, HOLD_MS * 3);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('avisa al terminar la escala', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    // La pentatónica menor de La: La, Do, Re, Mi, Sol, La, y de vuelta.
    const sequence = [45, 48, 50, 52, 55, 57, 55, 52, 50, 48, 45];
    let clock = 0;
    for (const midi of sequence) {
      await play(midi, clock);
      clock += HOLD_MS + 50;
      await play(midi, clock);
      clock += 50;
    }

    expect(await screen.findByText(/escala completa/i)).toBeInTheDocument();
  });

  it('empieza de nuevo al cambiar de escala', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    await play(45, 0);
    await play(45, HOLD_MS + 100);
    expect(await screen.findByText(/toca Do/i)).toBeInTheDocument();

    await act(async () => {
      actions.setScale('blues');
    });

    expect(await screen.findByText(/pulsa «empezar»/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
