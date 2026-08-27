// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Buscar un acorde a mano', () => {
  it('lo añade al camino con su nombre y sus notas', async () => {
    // Es la puerta para lo que el dominio no propone: un acorde prestado, uno
    // que has oído en un disco. Entra al camino igual que uno sugerido.
    const usuario = userEvent.setup();
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
    render(<NextChords />);

    await usuario.type(screen.getByRole('combobox'), 'F');
    await usuario.keyboard('{Enter}');

    expect(useSessionStore.getState().path.at(-1)?.symbol).toBe('F');
  });
});

describe('Los colores de la forma', () => {
  it('un acorde con notas de fuera se marca distinto', () => {
    // El color va al lado de lo que significa: preguntarse qué era el ámbar y no
    // tenerlo delante es perder el hilo de lo que tocas.
    useSessionStore.getState().actions.reset();
    play(AM);
    render(<NextChords />);

    // La leyenda de los tres colores está en la pantalla, para poder leerla sin
    // salir de ella.
    expect(screen.getByText(/entra/i)).toBeInTheDocument();
  });
});

describe('Un acorde que no cabe en el mástil', () => {
  it('se dice, en vez de dejar el hueco vacío', () => {
    // Pasa con acordes de cinco notas muy abiertos: no hay forma con la
    // fundamental al bajo dentro de cuatro trastes.
    useSessionStore.getState().actions.reset();
    // Siete notas cromáticas seguidas: no hay forma con la fundamental al bajo
    // que quepa en cuatro trastes.
    play({
      symbol: 'Xraro',
      label: 'raro',
      root: 0,
      notes: [0, 1, 2, 3, 4, 5, 6] as PitchClass[],
      why: 'x',
    });

    render(<Voicings />);

    expect(screen.getByText(/No cabe en cuatro trastes/)).toBeInTheDocument();
  });
});
