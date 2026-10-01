// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LevelMeter, REFRESCO_DEL_NUMERO_MS } from './LevelMeter';

/**
 * El medidor en pantalla.
 *
 * La barra sigue al nivel en cada lectura y el número no: se reescribe cuatro
 * veces por segundo. A veinte, cambiar el texto recolocaba la página entre 17 y
 * 39 ms de cada segundo, y un número que salta veinte veces no se lee.
 */
describe('el medidor de nivel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('la barra se escala, no se ensancha', () => {
    const { container } = render(<LevelMeter rms={0.1} />);
    const barra = container.querySelector<HTMLElement>('[role="meter"] > div');

    expect(barra?.style.width).toBe('');
    expect(barra?.style.transform).toMatch(/^scaleX\(0\.66/);
    expect(barra).toHaveClass('origin-left');
  });

  it('el número y el valor del lector van a cuatro por segundo, y acaban en el último', () => {
    const { rerender } = render(<LevelMeter rms={0.001} />);
    const medidor = screen.getByRole('meter');
    expect(screen.getByText('-60 dB')).toBeInTheDocument();

    rerender(<LevelMeter rms={0.01} />);
    act(() => vi.advanceTimersByTime(REFRESCO_DEL_NUMERO_MS));
    expect(screen.getByText('-40 dB')).toBeInTheDocument();

    // Un chorro de lecturas dentro del mismo tramo no reescribe nada...
    rerender(<LevelMeter rms={0.1} />);
    act(() => vi.advanceTimersByTime(REFRESCO_DEL_NUMERO_MS / 5));
    rerender(<LevelMeter rms={1} />);
    act(() => vi.advanceTimersByTime(REFRESCO_DEL_NUMERO_MS / 5));
    expect(screen.getByText('-40 dB')).toBeInTheDocument();
    expect(medidor).toHaveAttribute('aria-valuenow', '33');

    // ...y al cumplirse el tramo se escribe el último, no el primero.
    act(() => vi.advanceTimersByTime(REFRESCO_DEL_NUMERO_MS));
    expect(screen.getByText('0 dB')).toBeInTheDocument();
    expect(medidor).toHaveAttribute('aria-valuenow', '100');
  });
});
