// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChordDiagram } from './ChordDiagram';

/**
 * La letra de un diagrama se lee a un metro, también dentro de un SVG: el
 * lienzo mide 107 y se pinta entre 148 y 152 px, así que cada unidad del
 * `viewBox` sale a 1,38 px como poco. Con 9 y 8 unidades y un suelo de 132 la
 * digitación salía a 9,9 px, por debajo de los 12 que pide `docs/ESTILO.md`.
 */
describe('el diagrama de un acorde', () => {
  it('ninguna letra baja de 12 px en pantalla', () => {
    render(<ChordDiagram frets={[null, 3, 2, 0, 1, 0]} position={0} label="C" />);
    const svg = screen.getByRole('img', { name: 'C: x32010' });

    const ancho = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    const suelo = Number(/min-w-\[(\d+)px\]/.exec(svg.getAttribute('class')!)![1]);
    for (const texto of svg.querySelectorAll('text')) {
      const unidades = Number(/text-\[(\d+)px\]/.exec(texto.getAttribute('class')!)![1]);
      expect((unidades * suelo) / ancho).toBeGreaterThanOrEqual(12);
    }
  });

  it('numera la ventana cuando el acorde está arriba del mástil', () => {
    render(<ChordDiagram frets={[5, 7, 7, 6, 5, 5]} position={5} label="A" />);
    const svg = screen.getByRole('img', { name: 'A: 577655' });

    expect([...svg.querySelectorAll('text')].map((t) => t.textContent)).toContain('5');
  });
});
