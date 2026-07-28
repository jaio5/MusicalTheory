// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { TheoryLessons } from './TheoryLessons';

function inKeyOfC(): void {
  useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
}

describe('Lecciones de teoría', () => {
  it('pide una tonalidad antes de explicar nada', () => {
    render(<TheoryLessons />);

    expect(screen.getByText(/elige una tonalidad/i)).toBeInTheDocument();
  });

  it('explica con los acordes de tu tonalidad, no con los de un libro', () => {
    inKeyOfC();
    render(<TheoryLessons />);

    expect(screen.getByText(/C, Dm, Em, F, G, Am/)).toBeInTheDocument();
  });

  it('dice por qué al contestar bien', () => {
    inKeyOfC();
    render(<TheoryLessons />);

    const question = screen.getByText(/¿Cuál es el V grado/i).closest('fieldset')!;
    fireEvent.click(within(question).getByRole('button', { name: 'G' }));

    expect(within(question).getByText(/El V se cuenta cinco grados/i)).toBeInTheDocument();
  });

  it('al fallar dice cuál era y por qué', () => {
    inKeyOfC();
    render(<TheoryLessons />);

    const question = screen.getByText(/¿Cuál es el V grado/i).closest('fieldset')!;
    fireEvent.click(within(question).getByRole('button', { name: 'F' }));

    expect(within(question).getByText(/Era G\./)).toBeInTheDocument();
  });

  it('cambia de lección y empieza de cero', () => {
    inKeyOfC();
    render(<TheoryLessons />);

    const question = screen.getByText(/¿Cuál es el V grado/i).closest('fieldset')!;
    fireEvent.click(within(question).getByRole('button', { name: 'G' }));
    expect(screen.getByText('1 de 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'La rueda de quintas' }));

    expect(screen.getByText('0 de 3')).toBeInTheDocument();
    expect(screen.getByText(/¿Cuál es la relativa/i)).toBeInTheDocument();
  });

  it('avisa de qué lección se está leyendo, para que el profesor lo sepa', () => {
    inKeyOfC();
    const topics: string[] = [];
    render(<TheoryLessons onTopic={(title) => topics.push(title)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Prestados y dominantes' }));

    expect(topics).toEqual(['Prestados y dominantes']);
  });
});
