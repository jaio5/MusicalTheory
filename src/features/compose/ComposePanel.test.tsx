// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { midiToFrequency, pitchClassFromName } from '@core/music';
import { NOTE_REPEAT_MS, useSessionStore } from '@state/session-store';

import { ComposePanel } from './ComposePanel';

const A = pitchClassFromName('A');

async function play(midi: number, at: number) {
  await act(async () => {
    useSessionStore.getState().actions.setPitch(midiToFrequency(midi), 0.99, at);
  });
}

describe('Panel de componer', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  afterEach(cleanup);

  it('pide una tonalidad antes de proponer nada', () => {
    render(<ComposePanel />);
    expect(screen.getByText(/toca unos compases o elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña los siete acordes de la tonalidad', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    for (const symbol of ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']) {
      expect(await screen.findByRole('button', { name: new RegExp(`^${symbol}`) })).toBeInTheDocument();
    }
  });

  it('arma los acordes con una escala de siete notas aunque el mástil use la pentatónica', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setScale('minorPentatonic');

    render(<ComposePanel />);

    // Sobre cinco notas no se pueden apilar terceras: cae a la menor natural.
    expect(screen.getByRole('button', { name: /^Am/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dm/ })).toBeInTheDocument();
  });

  it('sugiere a dónde ir desde el acorde que se está tocando', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    await userEvent.click(screen.getByRole('button', { name: /^Am/ }));

    expect(await screen.findByText(/desde Am, lo habitual/i)).toBeInTheDocument();
    // Lo más habitual en menor es bajar al VII, que en La menor es Sol, y va
    // con el porqué al lado.
    expect(screen.getByRole('button', { name: 'G' })).toBeInTheDocument();
    expect(screen.getByText('El descenso por tonos del rock menor.')).toBeInTheDocument();
  });

  it('deja encadenar: al pulsar una sugerencia pasa a ser el acorde actual', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    await userEvent.click(screen.getByRole('button', { name: /^Am/ }));
    const suggestion = await screen.findByRole('button', { name: 'G' });
    await userEvent.click(suggestion);

    expect(await screen.findByText(/desde G, lo habitual/i)).toBeInTheDocument();
  });

  it('marca el acorde seleccionado y deja soltarlo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    const am = screen.getByRole('button', { name: /^Am/ });
    await userEvent.click(am);
    expect(am).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(am);
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/lo habitual/i)).not.toBeInTheDocument();
  });

  it('enseña las progresiones resueltas a acordes reales', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    // El descenso menor en La: Am, G, F, G.
    expect(await screen.findByText('Am · G · F · G')).toBeInTheDocument();
  });

  it('guarda el historial de notas tocadas', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    await play(45, 0);
    await play(48, 400);
    await play(52, 800);

    const history = await screen.findByText('La · Do · Mi');
    expect(history).toBeInTheDocument();
  });

  it('sostener una nota no la mete veinte veces en el historial', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    await play(45, 0);
    await play(45, 50);
    await play(45, 100);

    expect(useSessionStore.getState().noteHistory).toHaveLength(1);
  });

  it('la misma nota vuelve a contar si se toca otra vez tras una pausa', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    await play(45, 0);
    await play(45, NOTE_REPEAT_MS + 50);

    expect(useSessionStore.getState().noteHistory).toHaveLength(2);
  });

  it('permite empezar el historial de cero', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    await play(45, 0);
    await userEvent.click(screen.getByRole('button', { name: /empezar de cero/i }));

    expect(await screen.findByText(/todavía no ha sonado nada/i)).toBeInTheDocument();
    expect(useSessionStore.getState().noteHistory).toHaveLength(0);
  });

  it('el historial no crece sin fin', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    for (let index = 0; index < 40; index += 1) {
      await play(45 + (index % 12), index * 400);
    }

    expect(useSessionStore.getState().noteHistory.length).toBeLessThanOrEqual(24);
  });

  it('cada acorde lleva su grado en romanos', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(<ComposePanel />);

    const am = await screen.findByRole('button', { name: /^Am/ });
    expect(within(am).getByText('i')).toBeInTheDocument();
  });
});
