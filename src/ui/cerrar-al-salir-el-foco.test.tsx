// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { cerrarAlSalirElFoco } from './cerrar-al-salir-el-foco';

/**
 * Un panel abierto, con la API del `popover` fingida: jsdom no la trae.
 */
function pintar() {
  render(
    <>
      <button type="button" popoverTarget="panel">
        Abrir
      </button>
      <div id="panel" data-testid="panel" onBlur={cerrarAlSalirElFoco}>
        <button type="button">Dentro</button>
        <button type="button">Otro de dentro</button>
      </div>
      <button type="button">Fuera</button>
    </>,
  );
  const panel = screen.getByTestId('panel');
  const cerrar = vi.fn();
  Object.assign(panel, { hidePopover: cerrar });
  return { cerrar };
}

describe('un popover que se cierra al salir el foco', () => {
  /**
   * Con el velo puesto parece modal, y el tabulador salía por detrás hasta los
   * controles tapados.
   */
  it('se cierra cuando el foco se va fuera', () => {
    const { cerrar } = pintar();

    fireEvent.blur(screen.getByRole('button', { name: 'Dentro' }), {
      relatedTarget: screen.getByRole('button', { name: 'Fuera' }),
    });

    expect(cerrar).toHaveBeenCalled();
  });

  it('no se cierra al moverse por dentro', () => {
    const { cerrar } = pintar();

    fireEvent.blur(screen.getByRole('button', { name: 'Dentro' }), {
      relatedTarget: screen.getByRole('button', { name: 'Otro de dentro' }),
    });

    expect(cerrar).not.toHaveBeenCalled();
  });

  /**
   * Ni al ir a su propio botón: pulsarlo con el panel abierto quita el foco
   * antes del clic, y cerrarlo aquí haría que el clic lo volviera a abrir.
   */
  it('no se cierra al volver a su boton, que ya lo cierra el clic', () => {
    const { cerrar } = pintar();

    fireEvent.blur(screen.getByRole('button', { name: 'Dentro' }), {
      relatedTarget: screen.getByRole('button', { name: 'Abrir' }),
    });

    expect(cerrar).not.toHaveBeenCalled();
  });

  // Pulsar en algo de dentro que no se enfoca, o cambiar de ventana, deja el
  // foco sin destino, y eso no es irse.
  it('sin destino no se cierra', () => {
    const { cerrar } = pintar();

    fireEvent.blur(screen.getByRole('button', { name: 'Dentro' }), { relatedTarget: null });

    expect(cerrar).not.toHaveBeenCalled();
  });

  // Sin la API —jsdom, o un navegador viejo— no revienta.
  it('sin la API del popover no hace nada', () => {
    render(
      <>
        <div data-testid="panel" onBlur={cerrarAlSalirElFoco}>
          <button type="button">Dentro</button>
        </div>
        <button type="button">Fuera</button>
      </>,
    );

    expect(() =>
      fireEvent.blur(screen.getByRole('button', { name: 'Dentro' }), {
        relatedTarget: screen.getByRole('button', { name: 'Fuera' }),
      }),
    ).not.toThrow();
  });
});
