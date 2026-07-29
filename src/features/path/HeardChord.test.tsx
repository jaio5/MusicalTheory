// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { HeardChord } from './HeardChord';

function escuchando(): void {
  useSessionStore.getState().actions.setListening('listening');
}

/** Deja de reconocer acorde, como cuando sueltas las cuerdas. */
function silencio(): void {
  useSessionStore.getState().actions.setHeardChord(null);
}

const AM = { symbol: 'Am', root: 9 as const, notes: [9, 0, 4] as const, score: 0.93, at: 0 };
const F = { symbol: 'F', root: 5 as const, notes: [5, 9, 0] as const, score: 0.88, at: 1 };

describe('El acorde que suena', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  it('no dice nada si no se escucha y no ha sonado nada todavía', () => {
    const { container } = render(<HeardChord />);

    expect(container).toBeEmptyDOMElement();
  });

  it('pide un acorde entero mientras no reconoce ninguno', () => {
    escuchando();
    render(<HeardChord />);

    expect(screen.getByText(/toca un acorde entero/i)).toBeInTheDocument();
  });

  it('enseña el acorde con sus notas y cómo se hace', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('A · C · E')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /formas de hacer am/i })).toBeInTheDocument();
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

/**
 * Lo que suena se apaga al soltar las cuerdas, y antes se llevaba por delante
 * lo que acababas de tocar. Con las dos manos en la guitarra no da tiempo a
 * llegar al botón, así que el último se queda.
 */
describe('El último acorde tocado se mantiene', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  it('sigue en pantalla cuando dejas de tocarlo', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    silencio();
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /formas de hacer am/i })).toBeInTheDocument();
  });

  it('todavía se puede meter en el camino después de soltarlo', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    silencio();
    render(<HeardChord />);

    fireEvent.click(screen.getByRole('button', { name: /meterlo en el camino/i }));

    expect(useSessionStore.getState().path.at(-1)?.symbol).toBe('Am');
  });

  it('el rótulo distingue lo que suena de lo que sonó', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    const sonando = render(<HeardChord />);
    expect(screen.getByText('Suena')).toBeInTheDocument();
    sonando.unmount();

    silencio();
    render(<HeardChord />);
    expect(screen.getByText('Último')).toBeInTheDocument();
  });

  it('se queda con el último, no con el primero', () => {
    escuchando();
    const { actions } = useSessionStore.getState();
    actions.setHeardChord(AM);
    actions.setHeardChord(F);
    silencio();
    render(<HeardChord />);

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.queryByText('Am')).not.toBeInTheDocument();
  });

  it('aguanta aunque se deje de escuchar del todo', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    silencio();
    useSessionStore.getState().actions.setListening('idle');
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
  });
});
