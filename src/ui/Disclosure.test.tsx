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

  it('flotando, lo que se abre se saca del flujo en vez de empujar', () => {
    // Es lo que impide las dos caras del mismo fallo: que lo de abajo se quede
    // sin altura, y que la rueda salga cortada por una recta cuando la barra
    // cede. Flotando no hay nada que repartir.
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto flotante>
        <p>La rueda</p>
      </Disclosure>,
    );

    const caja = container.querySelector('details > div')!;

    expect(caja.className).toContain('absolute');
    expect(caja.className).toContain('top-full');
    // Anclado al `details`, no a la primera caja posicionada que pille encima.
    expect(container.querySelector('details')!.className).toContain('relative');
    expect(caja).toContainElement(screen.getByText('La rueda'));
  });

  it('y aun flotando se puede llegar a todo en una pantalla baja', () => {
    // El tope se descuenta de la pantalla, no es una fracción de ella: un
    // `70dvh` se salía por abajo en cuanto la cabecera envolvía en dos líneas.
    // Quien comprueba que de verdad cabe es la sonda del skill `arrancar`, que
    // recorre esta pantalla abierta en siete tamaños.
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto flotante>
        <p>La rueda</p>
      </Disclosure>,
    );

    const caja = container.querySelector('details > div')!;

    expect(caja.className).toMatch(/max-h-\[calc\(100dvh-\d+rem\)\]/);
    expect(caja.className).toContain('overflow-y-auto');
  });

  it('sin flotante no se posiciona nada, que es como lo usa la portada', () => {
    const { container } = render(
      <Disclosure summary="Preguntas" abierto>
        <p>La rueda</p>
      </Disclosure>,
    );

    expect(container.querySelector('details')!.className).not.toContain('relative');
    expect(container.querySelector('details > div')).toBeNull();
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
