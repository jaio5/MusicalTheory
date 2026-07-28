// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSessionStore, type PathChord } from '@state/session-store';

import { CurrentChord, Voicings } from './PathPanel';

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

describe('El acorde actual', () => {
  it('pide una tonalidad antes que nada', () => {
    render(<CurrentChord />);

    expect(screen.getByText(/elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña el acorde, sus notas y por qué está ahí', () => {
    play(AM);
    render(<CurrentChord />);

    // Sale dos veces: en grande arriba y como último paso de la progresión.
    expect(screen.getAllByText('Am')).toHaveLength(2);
    expect(screen.getByText('A · C · E')).toBeInTheDocument();
    expect(screen.getByText('El primer grado.')).toBeInTheDocument();
  });

  it('recorta la progresión al pulsar un acorde anterior', () => {
    play(AM, G);
    render(<CurrentChord />);

    fireEvent.click(screen.getByRole('button', { name: 'Am' }));

    expect(useSessionStore.getState().path).toEqual([AM]);
  });

  it('deja limpiar la progresión entera', () => {
    play(AM, G);
    render(<CurrentChord />);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar la progresión' }));

    expect(useSessionStore.getState().path).toEqual([]);
  });
});

describe('Formas del acorde', () => {
  it('enseña varias maneras de hacerlo a lo largo del mástil', () => {
    play(AM);
    render(<Voicings />);

    const shapes = screen.getByRole('list', { name: /formas de hacer am/i });
    expect(shapes.children.length).toBeGreaterThan(1);
  });

  it('sin acorde elegido no enseña nada', () => {
    render(<Voicings />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
