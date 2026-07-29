// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { HeardChord } from './HeardChord';

function escuchando(): void {
  useSessionStore.getState().actions.setListening('listening');
}

const AM = { symbol: 'Am', root: 9 as const, notes: [9, 0, 4] as const, score: 0.93, at: 0 };

describe('El acorde que suena', () => {
  it('no dice nada si no se está escuchando', () => {
    useSessionStore.getState().actions.setHeardChord(AM);
    const { container } = render(<HeardChord />);

    expect(container).toBeEmptyDOMElement();
  });

  it('pide un acorde entero mientras no reconoce ninguno', () => {
    escuchando();
    render(<HeardChord />);

    expect(screen.getByText(/toca un acorde entero/i)).toBeInTheDocument();
  });

  it('enseña el acorde con sus notas', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('A · C · E')).toBeInTheDocument();
  });

  it('no lo mete solo en el camino: lo propone', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);

    expect(useSessionStore.getState().path).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: /meterlo en el camino/i }));

    expect(useSessionStore.getState().path.at(-1)?.symbol).toBe('Am');
  });

  it('no ofrece meter otra vez el acorde en el que ya estás', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);
    fireEvent.click(screen.getByRole('button', { name: /meterlo en el camino/i }));

    expect(screen.queryByRole('button', { name: /meterlo en el camino/i })).not.toBeInTheDocument();
  });
});
