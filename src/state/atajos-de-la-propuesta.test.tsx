// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_ARRANGEMENT } from '@core/music';

import { useArrangementStore } from './arrangement-store';
import { usePropuestaStore } from './propuesta';

import { useAtajosDeLaPropuesta } from './atajos-de-la-propuesta';

/**
 * Las teclas de lo que el copiloto propone.
 *
 * `Tab` acepta lo propuesto y `Escape` lo descarta, que es el gesto de cualquier
 * autocompletado; con `Mayúsculas`, un acorde en vez de todos. Lo que hay que
 * probar no es que la tecla llame a la acción: es **que no salte cuando se está
 * escribiendo** —en el buscador de acordes, `Tab` sigue saltando al campo
 * siguiente— y que no haya nada que hacer cuando no hay propuesta.
 */
function Lienzo() {
  useAtajosDeLaPropuesta();
  return <input aria-label="buscar" />;
}

function proponer(): string {
  const acciones = useArrangementStore.getState().actions;
  const parte = acciones.addPart('Estrofa');
  usePropuestaStore.getState().acciones.proponer(parte, ['IV', 'V'], 'Una idea');
  return parte;
}

function acordes(): number {
  return useArrangementStore.getState().arrangement.parts[0]?.blocks.length ?? 0;
}

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
  usePropuestaStore.setState({ propuesta: null });
});

describe('las teclas de lo propuesto', () => {
  it('Tab lo acepta entero', async () => {
    proponer();
    render(<Lienzo />);

    await userEvent.keyboard('{Tab}');

    expect(acordes()).toBe(2);
    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });

  // Con Mayúsculas, uno: al revés sería pedir cuatro pulsaciones para lo que
  // casi siempre se quiere entero.
  it('con Mayusculas acepta uno solo', async () => {
    proponer();
    render(<Lienzo />);

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');

    expect(acordes()).toBe(1);
  });

  it('Escape lo descarta sin escribir nada', async () => {
    proponer();
    render(<Lienzo />);

    await userEvent.keyboard('{Escape}');

    expect(acordes()).toBe(0);
    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });

  /**
   * Y en un campo de texto no: en el buscador de acordes, `Tab` tiene que seguir
   * saltando al campo siguiente. Es la trampa de un atajo sin modificador.
   */
  it('escribiendo, las teclas son del campo', async () => {
    proponer();
    render(<Lienzo />);
    screen.getByLabelText('buscar').focus();

    await userEvent.keyboard('{Escape}');

    expect(usePropuestaStore.getState().propuesta).not.toBeNull();
  });

  // Y con un modificador puesto, tampoco: eso es otro atajo del navegador.
  it('con Control puesto, tampoco', () => {
    proponer();
    render(<Lienzo />);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true, bubbles: true }),
      );
    });

    expect(usePropuestaStore.getState().propuesta).not.toBeNull();
  });

  // Y cualquier otra tecla no hace nada.
  it('otra tecla cualquiera no hace nada', async () => {
    proponer();
    render(<Lienzo />);

    await userEvent.keyboard('a');

    expect(usePropuestaStore.getState().propuesta).not.toBeNull();
    expect(acordes()).toBe(0);
  });

  /**
   * Y sin nada enfocado el evento llega con el documento de destino, que no es
   * un elemento: ahí no se está escribiendo, así que la tecla es del atajo.
   */
  it('sin nada enfocado, la tecla es del atajo', () => {
    proponer();
    render(<Lienzo />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });

  // Sin propuesta no hay nada que aceptar, y `Tab` vuelve a ser `Tab`.
  it('sin propuesta, Tab no se toca', async () => {
    render(<Lienzo />);

    await userEvent.keyboard('{Tab}');

    expect(screen.getByLabelText('buscar')).toHaveFocus();
  });
});
