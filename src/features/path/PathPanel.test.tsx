// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSessionStore, type PathChord } from '@state/session-store';

import { ChordFocus } from './PathPanel';

const AM: PathChord = {
  symbol: 'Am',
  label: 'i',
  root: 9,
  notes: [9, 0, 4],
  why: 'El primer grado.',
};

const G: PathChord = {
  symbol: 'G',
  label: 'bVII',
  root: 7,
  notes: [7, 11, 2],
  why: 'Baja un tono.',
};

function play(...chords: readonly PathChord[]): void {
  const { actions } = useSessionStore.getState();
  actions.pinKey({ tonic: 9, mode: 'minor' });
  for (const chord of chords) {
    actions.pushChord(chord);
  }
}

describe('ChordFocus', () => {
  it('pide una tonalidad antes que nada', () => {
    render(<ChordFocus />);

    expect(screen.getByText(/elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña las formas de una en una, no apiladas', () => {
    play(AM);
    render(<ChordFocus />);

    const shapes = screen.getByRole('list', { name: /formas de hacer el acorde/i });
    expect(shapes.children.length).toBeGreaterThan(1);
    expect(screen.getByText(/forma 1 de/i)).toBeInTheDocument();
  });

  it('no deja retroceder desde la primera forma y avanza a la siguiente', () => {
    play(AM);
    render(<ChordFocus />);

    expect(screen.getByRole('button', { name: 'Forma anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Forma siguiente' }));

    expect(screen.getByText(/forma 2 de/i)).toBeInTheDocument();
  });

  it('recorta la progresión al pulsar un acorde anterior', () => {
    play(AM, G);
    render(<ChordFocus />);

    fireEvent.click(screen.getByRole('button', { name: 'Am' }));

    expect(useSessionStore.getState().path).toEqual([AM]);
  });

  it('deja limpiar la progresión entera', () => {
    play(AM, G);
    render(<ChordFocus />);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar la progresión' }));

    expect(useSessionStore.getState().path).toEqual([]);
  });
});
