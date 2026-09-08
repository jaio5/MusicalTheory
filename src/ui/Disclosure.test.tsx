// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Disclosure } from './Disclosure';

/**
 * El desplegable que abre un trozo de pantalla.
 *
 * Lo que se prueba es el tope, que existe por un fallo concreto y difícil de
 * ver: en las pantallas de taller esta barra es `shrink-0` y vive encima de una
 * caja que crece. Con la rueda de quintas abierta en un teléfono medía
 * seiscientos trece píxeles de ochocientos, así que a lo que crece le tocaban
 * cero y **no había forma de desplazarse hasta ello**: no parecía un fallo de la
 * rueda, parecía que la aplicación se había quedado en blanco.
 */
describe('el desplegable', () => {
  it('sin tope, lo que se abre va tal cual', () => {
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto>
        <p>La rueda</p>
      </Disclosure>,
    );

    expect(container.querySelector('.overflow-y-auto')).toBeNull();
    expect(screen.getByText('La rueda')).toBeInTheDocument();
  });

  it('con tope, lo que se abre se desplaza por dentro y no se lo lleva todo', () => {
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto tope>
        <p>La rueda</p>
      </Disclosure>,
    );

    const caja = container.querySelector('.overflow-y-auto');
    expect(caja, 'falta la caja que pone el tope').not.toBeNull();
    expect(caja!.className).toMatch(/max-h-/);
    expect(caja!).toContainElement(screen.getByText('La rueda'));
  });

  it('sigue siendo un details de verdad: se abre sin JavaScript', () => {
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto>
        <p>La rueda</p>
      </Disclosure>,
    );

    expect(container.querySelector('details')).toHaveAttribute('open');
  });
});
