// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { A4_FREQUENCY, midiToFrequency, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { FretboardPanel } from './FretboardPanel';

describe('Panel del mástil', () => {
  it('pide una tonalidad mientras no haya ninguna', () => {
    render(<FretboardPanel />);
    expect(screen.getByText(/toca unos compases o elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña la escala de la tonalidad fijada', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<FretboardPanel />);

    expect(await screen.findByText(/pentatónica menor de A/i)).toBeInTheDocument();
    // La pentatónica menor de A: A, C, D, E, G.
    expect(screen.getByText('A · C · D · E · G')).toBeInTheDocument();
  });

  it('cambia de escala al elegir otra', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<FretboardPanel />);

    // La escala se elige en la barra de herramientas, no dentro del panel: el
    // mástil solo pinta la que esté puesta.
    await act(async () => {
      useSessionStore.getState().actions.setScale('blues');
    });

    expect(await screen.findByText('A · C · D · Eb · E · G')).toBeInTheDocument();
  });

  it('describe el mástil para quien no lo ve', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<FretboardPanel />);

    expect(
      await screen.findByRole('img', { name: /mástil de 15 trastes.*pentatónica menor.*A/i }),
    ).toBeInTheDocument();
  });

  it('no enciende ninguna nota si no hay señal', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    actions.setPitch(midiToFrequency(45), 0.99, 0);
    actions.setPitch(null);

    render(<FretboardPanel />);

    // Con la señal caída, la nota deja de estar encendida aunque siga siendo
    // la última leída.
    expect(useSessionStore.getState().hasSignal).toBe(false);
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });

  it('acumula lo tocado y acaba proponiendo una tonalidad', () => {
    const { actions } = useSessionStore.getState();
    // Un rato en A menor, con instantes separados para que el histograma
    // llegue a recalcularse.
    const sequence = [45, 48, 52, 45, 55, 52, 50, 48, 45, 52, 45];
    sequence.forEach((midi, index) => {
      actions.setPitch(midiToFrequency(midi), 0.99, index * 300);
    });

    render(<FretboardPanel />);

    expect(useSessionStore.getState().keyCandidates.length).toBeGreaterThan(0);
    expect(screen.queryByText(/toca unos compases o elige/i)).not.toBeInTheDocument();
  });

  it('el diapasón por sí solo no rompe nada', () => {
    useSessionStore.getState().actions.setPitch(A4_FREQUENCY, 0.99, 0);
    render(<FretboardPanel />);

    // Una nota suelta no basta para saber la tonalidad, y el mástil lo dice en
    // vez de pintar una escala inventada.
    expect(screen.getByText(/toca unos compases/i)).toBeInTheDocument();
  });
});
