import { beforeEach, describe, expect, it } from 'vitest';

import { usePedidoDeIdeas } from './pedido-de-ideas';

/**
 * «Pídeme una idea», dicho desde el lienzo.
 *
 * Lo que importa aquí es **que se consuma al leerla**: si la bandera se quedara
 * puesta, cada vez que se volviera a abrir el panel de ideas se gastaría otra
 * petición del cupo sin que nadie lo hubiera pedido.
 */
beforeEach(() => {
  usePedidoDeIdeas.setState({ pendiente: false });
});

describe('el pedido de ideas', () => {
  it('sin pedir nada, no hay nada que recoger', () => {
    expect(usePedidoDeIdeas.getState().acciones.consumir()).toBe(false);
  });

  it('pedido una vez, se recoge una vez', () => {
    usePedidoDeIdeas.getState().acciones.pedirProgresion();

    expect(usePedidoDeIdeas.getState().acciones.consumir()).toBe(true);
    // Y la segunda ya no: abrir el panel otra vez no gasta cupo.
    expect(usePedidoDeIdeas.getState().acciones.consumir()).toBe(false);
  });

  it('pedirlo dos veces seguidas sigue siendo un pedido', () => {
    usePedidoDeIdeas.getState().acciones.pedirProgresion();
    usePedidoDeIdeas.getState().acciones.pedirProgresion();

    expect(usePedidoDeIdeas.getState().acciones.consumir()).toBe(true);
    expect(usePedidoDeIdeas.getState().acciones.consumir()).toBe(false);
  });
});
