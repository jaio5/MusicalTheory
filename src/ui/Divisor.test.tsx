// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Divisor } from './Divisor';

/**
 * El divisor que reparte el banco de trabajo.
 *
 * Con el teclado ya se probaba desde `ComposeScreen`; con el puntero, que es
 * como se usa de verdad, no lo probaba nadie. Lo que se fija aquí es la
 * aritmética del arrastre: que lo movido se cuente en **rem** y no en píxeles,
 * que el sentido invierta donde toca, y que no se salga de los topes.
 *
 * jsdom no implementa la captura de puntero, así que los dos métodos se ponen a
 * mano: sin ellos, el primer `pointerdown` revienta y no se prueba nada.
 */
function pintar(props: Partial<Parameters<typeof Divisor>[0]> = {}) {
  const onCambio = vi.fn();
  const onDevolver = vi.fn();
  render(
    <Divisor
      orientacion="vertical"
      valor={20}
      min={10}
      max={30}
      etiqueta="Ancho de la tonalidad"
      onCambio={onCambio}
      onDevolver={onDevolver}
      {...props}
    />,
  );
  const barra = screen.getByRole('separator');
  Object.assign(barra, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
  return { barra, onCambio, onDevolver };
}

/** Un rem son dieciséis píxeles salvo que alguien haya tocado el navegador. */
beforeEach(() => {
  document.documentElement.style.fontSize = '16px';
});

describe('El divisor, con el teclado', () => {
  // Un mando que solo se arrastra no lo puede usar quien no arrastra.
  it('las flechas mueven un rem, y respetan el sentido', () => {
    const { barra, onCambio } = pintar();

    fireEvent.keyDown(barra, { key: 'ArrowRight' });
    expect(onCambio).toHaveBeenLastCalledWith(21);

    fireEvent.keyDown(barra, { key: 'ArrowLeft' });
    expect(onCambio).toHaveBeenLastCalledWith(19);
  });

  it('en horizontal son arriba y abajo', () => {
    const { barra, onCambio } = pintar({ orientacion: 'horizontal', sentido: -1 });

    fireEvent.keyDown(barra, { key: 'ArrowDown' });
    expect(onCambio).toHaveBeenLastCalledWith(19);

    fireEvent.keyDown(barra, { key: 'ArrowUp' });
    expect(onCambio).toHaveBeenLastCalledWith(21);
  });

  it('y tampoco se pasan de los topes', () => {
    const { barra, onCambio } = pintar({ valor: 30 });

    fireEvent.keyDown(barra, { key: 'ArrowRight' });

    expect(onCambio).toHaveBeenLastCalledWith(30);
  });

  it('Inicio devuelve la medida de fabrica', () => {
    const { barra, onDevolver } = pintar();

    fireEvent.keyDown(barra, { key: 'Home' });

    expect(onDevolver).toHaveBeenCalled();
  });

  // Cualquier otra tecla sigue su camino: aquí no se secuestra el tabulador.
  it('las demas teclas pasan de largo', () => {
    const { barra, onCambio, onDevolver } = pintar();

    fireEvent.keyDown(barra, { key: 'Tab' });

    expect(onCambio).not.toHaveBeenCalled();
    expect(onDevolver).not.toHaveBeenCalled();
  });

  it('dice cuanto mide, para quien no lo ve', () => {
    const { barra } = pintar();

    expect(barra).toHaveAttribute('aria-valuenow', '20');
    expect(barra).toHaveAttribute('aria-valuemin', '10');
    expect(barra).toHaveAttribute('aria-valuemax', '30');
    expect(barra).toHaveAttribute('aria-orientation', 'vertical');
  });
});

describe('El divisor, con el puntero', () => {
  it('arrastrar a la derecha ensancha, contado en rem', () => {
    const { barra, onCambio } = pintar();

    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(barra, { clientX: 148, pointerId: 1 });

    // 48 px son tres rem: 20 + 3.
    expect(onCambio).toHaveBeenCalledWith(23);
  });

  // La columna de la derecha y el área de abajo crecen al revés.
  it('con el sentido invertido, al reves', () => {
    const { barra, onCambio } = pintar({ sentido: -1 });

    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(barra, { clientX: 148, pointerId: 1 });

    expect(onCambio).toHaveBeenCalledWith(17);
  });

  it('en horizontal manda el eje vertical', () => {
    const { barra, onCambio } = pintar({ orientacion: 'horizontal' });

    fireEvent.pointerDown(barra, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(barra, { clientY: 132, pointerId: 1 });

    expect(onCambio).toHaveBeenCalledWith(22);
  });

  it('no se pasa de los topes por mucho que se arrastre', () => {
    const { barra, onCambio } = pintar();

    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(barra, { clientX: 1000, pointerId: 1 });
    expect(onCambio).toHaveBeenLastCalledWith(30);

    fireEvent.pointerMove(barra, { clientX: -1000, pointerId: 1 });
    expect(onCambio).toHaveBeenLastCalledWith(10);
  });

  // Mover el puntero por encima sin haberlo agarrado no reparte nada.
  it('sin agarrar antes, moverse no hace nada', () => {
    const { barra, onCambio } = pintar();

    fireEvent.pointerMove(barra, { clientX: 300, pointerId: 1 });

    expect(onCambio).not.toHaveBeenCalled();
  });

  it('al soltar se deja de arrastrar', () => {
    const { barra, onCambio } = pintar();
    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(barra, { clientX: 100, pointerId: 1 });

    fireEvent.pointerMove(barra, { clientX: 300, pointerId: 1 });

    expect(onCambio).not.toHaveBeenCalled();
  });

  // Y si el sistema se queda el gesto, igual: si no, el divisor se queda pegado.
  it('y si el sistema se lleva el gesto, tambien', () => {
    const { barra, onCambio } = pintar();
    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerCancel(barra, { clientX: 100, pointerId: 1 });

    fireEvent.pointerMove(barra, { clientX: 300, pointerId: 1 });

    expect(onCambio).not.toHaveBeenCalled();
  });

  /**
   * El rem de verdad y no dieciséis a secas: quien haya subido el tamaño de
   * letra del navegador arrastraría a otra velocidad que la que ve moverse.
   */
  it('cuenta con el tamaño de letra que haya puesto', () => {
    document.documentElement.style.fontSize = '24px';
    const { barra, onCambio } = pintar();

    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(barra, { clientX: 148, pointerId: 1 });

    // 48 px son dos rem cuando el rem son 24.
    expect(onCambio).toHaveBeenCalledWith(22);
  });

  // Un tamaño que no se puede leer no puede dejar el arrastre en infinito.
  it('y si no se puede leer, da igual: dieciseis', () => {
    document.documentElement.style.fontSize = '';
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((...args) => ({
      ...original(...(args as [Element])),
      fontSize: 'lo que sea',
    }));
    const { barra, onCambio } = pintar();

    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(barra, { clientX: 132, pointerId: 1 });

    expect(onCambio).toHaveBeenCalledWith(22);
    vi.restoreAllMocks();
  });

  /**
   * Y sin `document` —el servidor— se da por hecho que un rem son dieciséis.
   *
   * Este componente se pinta también en el servidor, donde no hay hoja de
   * estilos que consultar. Nunca se arrastra allí, pero la función se evalúa, y
   * un `getComputedStyle` sin `document` revienta la página entera.
   */
  it('en el servidor no pregunta por el tamaño de letra', () => {
    const { barra, onCambio } = pintar();
    fireEvent.pointerDown(barra, { clientX: 100, pointerId: 1 });

    vi.stubGlobal('document', undefined);
    try {
      fireEvent.pointerMove(barra, { clientX: 132, pointerId: 1 });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(onCambio).toHaveBeenLastCalledWith(22);
  });

  it('el doble clic devuelve la medida de fabrica', () => {
    const { barra, onDevolver } = pintar();

    fireEvent.doubleClick(barra);

    expect(onDevolver).toHaveBeenCalled();
  });
});
