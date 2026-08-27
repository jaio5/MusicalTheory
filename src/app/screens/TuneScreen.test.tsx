// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TuneScreen } from './TuneScreen';

/**
 * Afinar y nada más.
 *
 * Aquí no hay tonalidad, ni acordes, ni sugerencias, y eso es lo que se prueba:
 * quien viene a afinar viene a eso, y cada cosa de más es una cosa que estorba.
 * Un test que mira lo que **no** está es lo único que impide que esta pantalla
 * se vuelva a llenar poco a poco.
 */

describe('La pantalla de afinar', () => {
  it('tiene la afinación y el afinador', () => {
    render(<TuneScreen />);

    expect(screen.getByRole('heading', { name: 'Afinar' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/afinaci/i).length).toBeGreaterThan(0);
  });

  it('y no tiene nada de teoría', () => {
    render(<TuneScreen />);

    const texto = document.body.textContent ?? '';

    expect(texto).not.toMatch(/tonalidad/i);
    expect(texto).not.toMatch(/acorde/i);
    expect(texto).not.toMatch(/sugerenc/i);
  });
});
