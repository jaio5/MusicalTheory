// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

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

describe('mientras el micro está abierto', () => {
  /**
   * La afinación se pliega en cuanto se empieza a escuchar: se elige una vez, y
   * abierta se lleva media pantalla que es justo la que hace falta para ver la
   * aguja. Parada vuelve a estar delante, que es cuando se cambia.
   */
  it('la afinacion se pliega, y parada esta delante', () => {
    useSessionStore.getState().actions.setListening('listening');
    const { unmount } = render(<TuneScreen />);

    expect(screen.getByRole('group')).toBeInTheDocument();

    unmount();
    useSessionStore.getState().actions.reset();
    render(<TuneScreen />);

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  /**
   * **Escuchando se queda arriba**, y parada se centra
   * ([adr/0061](../../../docs/adr/0061-el-afinador-no-se-mueve-mientras-escucha.md)).
   * Centrado, cada cosa que crecía dentro movía la nota entera: es lo que medía
   * entre 0,19 y 0,31 de CLS.
   */
  it('escuchando no se centra, para que la nota no se mueva sola', () => {
    useSessionStore.getState().actions.setListening('listening');
    const { container, unmount } = render(<TuneScreen />);
    expect(container.querySelector('.my-auto')).toBeNull();

    unmount();
    useSessionStore.getState().actions.reset();
    const parada = render(<TuneScreen />);
    expect(parada.container.querySelector('.my-auto')).not.toBeNull();
    parada.unmount();

    // Y se recoloca al pedir el micro, no al tenerlo: lo que se mueve pasado el
    // medio segundo del clic cuenta como salto aunque lo haya pedido quien pulsa.
    useSessionStore.getState().actions.setListening('requesting');
    const pidiendo = render(<TuneScreen />);
    expect(pidiendo.container.querySelector('.my-auto')).toBeNull();
  });
});
