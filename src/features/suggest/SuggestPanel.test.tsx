// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { midiToFrequency, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { SuggestPanel } from './SuggestPanel';

const A = pitchClassFromName('A');

describe('Panel de sugerencias', () => {
  it('pide una tonalidad antes de proponer nada', () => {
    render(<SuggestPanel />);
    expect(
      screen.getByText(/elige una tonalidad arriba o toca unos compases/i),
    ).toBeInTheDocument();
  });

  it('propone acordes del estilo elegido, con su etiqueta', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setStyle('rock');

    render(<SuggestPanel />);

    expect(await screen.findByText('Am')).toBeInTheDocument();
    expect(screen.getByText('A5')).toBeInTheDocument();
    expect(screen.getAllByText('de la tonalidad').length).toBeGreaterThan(0);
  });

  it('cambia lo que propone al cambiar de estilo', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'major' });

    const { rerender } = render(<SuggestPanel />);
    actions.setStyle('blues');
    rerender(<SuggestPanel />);

    expect(await screen.findByText('A7')).toBeInTheDocument();
  });

  it('deja quedarse solo con los raros', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setStyle('rock');

    render(<SuggestPanel />);
    await userEvent.click(screen.getByRole('checkbox', { name: /solo los raros/i }));

    // Am es el primer grado: no tiene nada de raro.
    expect(screen.queryByText('Am')).not.toBeInTheDocument();
  });

  it('enseña las pautas del estilo', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setStyle('metal');

    render(<SuggestPanel />);

    expect(await screen.findByText(/qué se puede hacer en metal/i)).toBeInTheDocument();
    expect(screen.getByText(/El bII pegado a la tónica/i)).toBeInTheDocument();
  });

  it('marca los acordes que encajan con lo que se está tocando', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    // Re, Fa# y La: no es diatónico de A menor, pero es lo que suena.
    actions.setPitch(midiToFrequency(50), 0.99, 0);
    actions.setPitch(midiToFrequency(54), 0.99, 400);
    actions.setPitch(midiToFrequency(57), 0.99, 800);

    render(<SuggestPanel />);

    expect(await screen.findByText('D')).toBeInTheDocument();
    expect(screen.getAllByTitle(/encaja con lo que estás tocando/i).length).toBeGreaterThan(0);
  });
});
