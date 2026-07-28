// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { ChordFocus } from './PathPanel';

const AM = {
  symbol: 'Am',
  label: 'i',
  root: 9,
  notes: [9, 0, 4],
  why: 'El primer grado.',
} as const;

const G = {
  symbol: 'G',
  label: 'bVII',
  root: 7,
  notes: [7, 11, 2],
  why: 'Baja un tono.',
} as const;

function pinAMinor(): void {
  useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
}

describe('ChordFocus', () => {
  it('pide una tonalidad antes que nada', () => {
    render(<ChordFocus path={[]} onTrim={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByText(/elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña las formas de una en una, no apiladas', () => {
    pinAMinor();
    render(<ChordFocus path={[AM]} onTrim={vi.fn()} onClear={vi.fn()} />);

    const shapes = screen.getByRole('list', { name: /formas de hacer el acorde/i });
    expect(shapes.children.length).toBeGreaterThan(1);
    expect(screen.getByText(/forma 1 de/i)).toBeInTheDocument();
  });

  it('no deja retroceder desde la primera forma y avanza a la siguiente', () => {
    pinAMinor();
    render(<ChordFocus path={[AM]} onTrim={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Forma anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Forma siguiente' }));

    expect(screen.getByText(/forma 2 de/i)).toBeInTheDocument();
  });

  it('recorta la progresión al pulsar un acorde anterior', () => {
    pinAMinor();
    const onTrim = vi.fn();
    render(<ChordFocus path={[AM, G]} onTrim={onTrim} onClear={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Am' }));

    expect(onTrim).toHaveBeenCalledWith(0);
  });

  it('se puede plegar cuando estorba', () => {
    pinAMinor();
    const onCollapse = vi.fn();
    render(<ChordFocus path={[AM]} onTrim={vi.fn()} onClear={vi.fn()} onCollapse={onCollapse} />);

    fireEvent.click(screen.getByRole('button', { name: 'Plegar el acorde' }));

    expect(onCollapse).toHaveBeenCalledOnce();
  });
});
