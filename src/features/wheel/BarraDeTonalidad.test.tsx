// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarraDeTonalidad } from './BarraDeTonalidad';

/**
 * La barra se usa de dos maneras: la unidad le pone su marco con `className`, y
 * componer la deja con el suyo. Las dos se prueban aquí porque las pantallas que
 * la montan ya no las recorren las dos, y quitar una rama por no verla rompería
 * la otra pantalla.
 */
describe('BarraDeTonalidad', () => {
  it('lleva el marco que le pone la pantalla', () => {
    const { container } = render(<BarraDeTonalidad className="marco-de-la-unidad" />);

    expect(container.querySelector('.marco-de-la-unidad')).not.toBeNull();
  });

  it('sin marco propio se pinta igual, y sin tonalidad lo dice', () => {
    render(<BarraDeTonalidad />);

    expect(screen.getByText('sin elegir')).toBeInTheDocument();
  });
});
