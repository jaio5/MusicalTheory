// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { CuerdasDeLaAfinacion, TuningPicker } from './TuningPicker';

/** Las dos piezas, como las monta la pantalla de afinar. */
function Afinacion() {
  return (
    <>
      <TuningPicker />
      <CuerdasDeLaAfinacion />
    </>
  );
}

/** Una lectura de esa nota, con señal, y el micro abierto. */
function suena(midi: number, cents: number): void {
  act(() => {
    useSessionStore.setState({
      listening: 'listening',
      hasSignal: true,
      reading: { frequency: 110, midi, pitchClass: 9, name: 'A', octave: 2, cents },
    });
  });
}

afterEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('Elegir afinación', () => {
  it('arranca en estándar y enseña sus seis cuerdas', () => {
    render(<Afinacion />);

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

  // Seis cajas con relieve pasaban por botones y no hacían nada; seis letras
  // sueltas dejaban la columna medio vacía. Cada cuerda es una pieza **hundida**
  // —un hueco no se pulsa— y ninguna es un botón.
  it('las cuerdas son piezas hundidas, no cajas con pinta de botón', () => {
    render(<Afinacion />);

    const cuerdas = screen.getByRole('list', { name: /cuerdas de la afinación/i });
    for (const cuerda of within(cuerdas).getAllByRole('listitem')) {
      expect(cuerda).toHaveClass('hueco');
      expect(cuerda.className).not.toMatch(/superficie|border/);
    }
    expect(within(cuerdas).queryByRole('button')).not.toBeInTheDocument();
  });

  it('la cuerda que suena se enciende, y se dice', () => {
    render(<Afinacion />);
    const cuerdas = screen.getByRole('list', { name: /cuerdas de la afinación/i });
    const quinta = within(cuerdas).getByText('A').closest('li')!;
    expect(quinta).not.toHaveClass('piloto');

    suena(45, 3);

    expect(quinta).toHaveClass('piloto', 'text-brass-bright');
    expect(quinta).toHaveAttribute('aria-current', 'true');
    expect(within(quinta).getByText(', sonando')).toBeInTheDocument();
    for (const otra of within(cuerdas)
      .getAllByRole('listitem')
      .filter((li) => li !== quinta)) {
      expect(otra).not.toHaveClass('piloto');
    }
  });

  // Con el micro cerrado no suena nada, aunque quede una lectura de antes.
  it('con el micro cerrado ninguna se enciende', () => {
    act(() => {
      useSessionStore.setState({
        listening: 'idle',
        hasSignal: true,
        reading: { frequency: 110, midi: 45, pitchClass: 9, name: 'A', octave: 2, cents: 3 },
      });
    });
    render(<Afinacion />);

    const cuerdas = screen.getByRole('list', { name: /cuerdas de la afinación/i });
    expect(within(cuerdas).queryByText(', sonando')).not.toBeInTheDocument();
  });

  /**
   * Mientras se afina se ve cuáles van ya: cada cuerda recuerda cómo sonó la
   * última vez, medido contra ella y no contra la nota más cercana.
   */
  it('cada cuerda recuerda si quedó afinada, alta o baja', () => {
    render(<Afinacion />);
    const cuerdas = screen.getByRole('list', { name: /cuerdas de la afinación/i });
    const [sexta, quinta, cuarta] = within(cuerdas).getAllByRole('listitem');

    suena(45, 2);
    // Un semitono por encima de la sexta, y uno por debajo de la cuarta con
    // los cents a cero: «afinada» como nota, y baja como cuerda.
    suena(41, 0);
    suena(49, 30);
    act(() => useSessionStore.setState({ hasSignal: false }));

    expect(quinta).toHaveTextContent(/afinada/);
    expect(sexta).toHaveTextContent(/alta/);
    expect(cuarta).toHaveTextContent(/baja/);
    expect(cuerdas.querySelectorAll('.piloto')).toHaveLength(0);
  });

  it('otra afinación empieza sin marcas', () => {
    render(<Afinacion />);
    suena(45, 0);
    const cuerdas = screen.getByRole('list', { name: /cuerdas de la afinación/i });
    expect(cuerdas).toHaveTextContent(/afinada/);
    act(() => useSessionStore.setState({ hasSignal: false }));

    act(() => useSessionStore.getState().actions.setTuning('dropD'));

    expect(cuerdas).not.toHaveTextContent(/afinada/);
  });
});
