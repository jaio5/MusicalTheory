// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { TuningPicker } from './TuningPicker';

describe('Elegir afinación', () => {
  it('arranca en estándar y enseña sus seis cuerdas', () => {
    render(<TuningPicker />);

    const strings = screen.getByRole('list', { name: /cuerdas de la afinación/i });
    expect(
      within(strings)
        .getAllByText(/^[A-G][#b]?$/)
        .map((node) => node.textContent),
    ).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
  });

  it('cambia la afinación y lo recuerda en la sesión', () => {
    render(<TuningPicker />);

    fireEvent.change(screen.getByRole('combobox', { name: /afinación/i }), {
      target: { value: 'dropC' },
    });

    expect(useSessionStore.getState().tuningId).toBe('dropC');
  });

  it('dice para qué sirve cada una', () => {
    render(<TuningPicker />);

    fireEvent.change(screen.getByRole('combobox', { name: /afinación/i }), {
      target: { value: 'dadgad' },
    });

    expect(screen.getByText(/folk y celta/i)).toBeInTheDocument();
  });
});
