// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PitchClass } from '@core/music';
import { useSessionStore, type PathChord } from '@state/session-store';

import { CurrentChord, NextChords, Voicings } from './PathPanel';

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

describe('Por dónde empezar', () => {
  function startIn(tonic: PitchClass, mode: 'major' | 'minor'): void {
    const { actions } = useSessionStore.getState();
    actions.clearPath();
    actions.pinKey({ tonic, mode });
  }

  it('lo primero que propone son los tres tonales, no un disminuido', () => {
    startIn(0, 'major');
    render(<NextChords />);

    const options = screen.getAllByRole('button');
    const first = options.slice(0, 3).map((button) => button.getAttribute('aria-label'));
    expect(first).toEqual(['C, I', 'F, IV', 'G, V']);
  });

  it('dice qué papel hace cada acorde', () => {
    startIn(0, 'major');
    render(<NextChords />);

    // El nombre entero, no la inicial: la letra sola no enseña nada.
    expect(screen.getAllByText('Dominante').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Subdominante').length).toBeGreaterThan(0);
  });

  it('explica por qué un acorde puede sustituir a otro', () => {
    startIn(0, 'major');
    render(<NextChords />);

    // El vi y el iii sustituyen los dos al I, así que hay más de uno.
    expect(screen.getAllByText(/Vale por I\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/relativo menor/i).length).toBeGreaterThan(0);
  });

  it('traduce las letras del papel ahí mismo', () => {
    startIn(0, 'major');
    render(<NextChords />);

    expect(screen.getByText('reposo')).toBeInTheDocument();
    expect(screen.getByText('salida')).toBeInTheDocument();
    expect(screen.getByText('tensión')).toBeInTheDocument();
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
