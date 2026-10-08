// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

    expect(caja.className).toMatch(/max-h-\[max\(\d+rem,calc\(100dvh-\d+rem\)\)\]/);
    expect(caja.className).toContain('overflow-y-auto');
  });

  /**
   * **Con suelo.** Restar un número fijo a la pantalla daba cero en una ventana
   * baja: a 320×256 —un 1280×1024 al 400 %— el panel medía cero píxeles con la
   * rueda abierta dentro. Con `max()` nunca baja de nueve rem, y lo que no quepa
   * se alcanza desplazando el marco, que por debajo de 500 px de alto se deja.
   */
  it('en una ventana muy baja no se queda en cero: tiene suelo, a los dos lados de md', () => {
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto flotante>
        <p>La rueda</p>
      </Disclosure>,
    );

    const clases = container.querySelector('details > div')!.className.split(' ');
    expect(clases).toContain('max-h-[max(9rem,calc(100dvh-22rem))]');
    expect(clases).toContain('barra-arriba:max-lg:max-h-[max(9rem,calc(100dvh-14rem))]');
    expect(clases).toContain('lg:max-h-[max(9rem,calc(100dvh-12rem))]');
  });

  /**
   * Y entre 640 y 767 descuenta menos: el tope de abajo cuenta con más marco del
   * que hay ahí. A 700×600 el panel se quedaba en 248 px con 373 libres, y los
   * cuatro atajos de salida salían cortados por el borde. Medido: el panel
   * empieza en el píxel 222 en componer —cabecera con los mandos en dos filas—
   * y en el 162 en la unidad, y la navegación de abajo mide 65.
   */
  it('desde sm descuenta el marco que hay de verdad entre 640 y 767', () => {
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto flotante>
        <p>La rueda</p>
      </Disclosure>,
    );

    const clases = container.querySelector('details > div')!.className.split(' ');
    expect(clases).toContain('sm:max-h-[max(9rem,calc(100dvh-18.5rem))]');
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

/**
 * Lo que flota tapa lo de debajo, y de eso se sale con Escape, como de un
 * diálogo. El foco vuelve al rótulo: quedarse en una casilla de la rueda sería
 * quedarse en algo que ya no se ve.
 */
describe('salir de lo que flota', () => {
  function flotando() {
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto flotante>
        <button type="button">Do mayor</button>
      </Disclosure>,
    );
    return container.querySelector('details')!;
  }

  it('Escape lo cierra y devuelve el foco al rotulo', () => {
    const detalles = flotando();
    screen.getByRole('button', { name: 'Do mayor' }).focus();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Do mayor' }), { key: 'Escape' });

    expect(detalles.open).toBe(false);
    expect(detalles.querySelector('summary')).toHaveFocus();
  });

  it('otra tecla no lo cierra', () => {
    const detalles = flotando();

    fireEvent.keyDown(detalles, { key: 'Enter' });

    expect(detalles.open).toBe(true);
  });

  it('cerrado, Escape no hace nada ni se queda con la tecla', () => {
    const detalles = flotando();
    detalles.open = false;
    const fuera = vi.fn();
    document.addEventListener('keydown', fuera);

    fireEvent.keyDown(detalles, { key: 'Escape' });

    document.removeEventListener('keydown', fuera);
    expect(fuera).toHaveBeenCalled();
  });

  // Sin flotar no lleva manejador: lo usan componentes de servidor.
  it('sin flotar, Escape no lo toca', () => {
    const { container } = render(
      <Disclosure summary="Pregunta" abierto>
        <p>Respuesta</p>
      </Disclosure>,
    );
    const detalles = container.querySelector('details')!;

    fireEvent.keyDown(detalles, { key: 'Escape' });

    expect(detalles.open).toBe(true);
  });

  it('al abrirse entra con una animación breve, solo para quien acepta movimiento', () => {
    const { container, rerender } = render(
      <Disclosure summary="Tonalidad" abierto flotante>
        <p>La rueda</p>
      </Disclosure>,
    );
    expect(container.querySelector('details > div')).toHaveClass('motion-safe:animate-desplegar');
    expect(container.querySelector('details')).not.toHaveClass('desplegable');

    // El que empuja anima por `::details-content`, que engancha por esta clase.
    rerender(
      <Disclosure summary="Tonalidad" abierto>
        <p>La rueda</p>
      </Disclosure>,
    );
    expect(container.querySelector('details')).toHaveClass('desplegable');
  });

  it('avisa de si está abierto: al montar con el de salida y al cambiar', () => {
    const avisar = vi.fn();
    const { container } = render(
      <Disclosure summary="Tonalidad" abierto onAbrirse={avisar}>
        <p>La rueda</p>
      </Disclosure>,
    );
    expect(avisar).toHaveBeenLastCalledWith(true);

    const detalles = container.querySelector('details')!;
    detalles.open = false;
    fireEvent(detalles, new Event('toggle'));
    expect(avisar).toHaveBeenLastCalledWith(false);
  });

  it('el tono grande es el de las preguntas de la portada', () => {
    const { container } = render(
      <Disclosure summary="¿Hace falta cuenta?" tone="grande">
        <p>No.</p>
      </Disclosure>,
    );
    expect(container.querySelector('summary')).toHaveClass('text-fluid-subtitle');
    expect(container.querySelector('svg')).toHaveClass('size-4');
  });
});
