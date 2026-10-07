// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ContarVueltas } from './ContarVueltas';

/**
 * El permiso para contar las vueltas: por defecto no, y decir que no borra.
 */

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
});

describe('contar las vueltas', () => {
  it('por defecto no, y no hay nada guardado', () => {
    render(<ContarVueltas />);

    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.length).toBe(0);
  });

  it('decir que sí guarda el número, y que no lo borra', async () => {
    render(<ContarVueltas />);

    await userEvent.click(screen.getByRole('button', { name: 'Sí, contadlas' }));
    expect(screen.getByRole('button', { name: 'Sí, contadlas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.length).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(localStorage.length).toBe(0);
  });

  it('con Do Not Track no se ofrece: ya está dicho', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    render(<ContarVueltas />);

    expect(screen.getByText(/se respeta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument();
  });
});

describe('pintado en el servidor', () => {
  it('dice que no, porque allí no hay navegador al que preguntar', () => {
    localStorage.setItem('caos-ordenado:contar-vueltas', 'algo');
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });

    const html = renderToString(<ContarVueltas />);

    expect(html).toContain('Sí, contadlas');
    expect(html).toMatch(/aria-pressed="true"[^>]*>No</);
  });
});
