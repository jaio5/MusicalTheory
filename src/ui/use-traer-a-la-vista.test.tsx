// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTraerALaVista } from './use-traer-a-la-vista';

function Tira({ ancho, visible }: { readonly ancho: number; readonly visible: number }) {
  const traer = useTraerALaVista<HTMLDivElement>();
  return (
    <div
      data-testid="tira"
      onFocus={traer}
      tabIndex={-1}
      ref={(nodo) => {
        if (nodo !== null) {
          Object.defineProperty(nodo, 'scrollWidth', { value: ancho, configurable: true });
          Object.defineProperty(nodo, 'clientWidth', { value: visible, configurable: true });
        }
      }}
    >
      <button type="button">Clic</button>
      <button type="button">Tempo</button>
    </div>
  );
}

const traido = vi.fn();

beforeEach(() => {
  traido.mockReset();
  // jsdom no trae `scrollIntoView`.
  Element.prototype.scrollIntoView = traido;
});

/**
 * Lo que recibe el foco en una tira que se desplaza **se trae entero**: el
 * navegador solo desplaza lo justo para que asome, y a 390 «Tempo» enseñaba 13
 * de sus 82 píxeles.
 */
describe('traer a la vista lo enfocado en una tira', () => {
  it('lo trae lo justo, en los dos ejes, cuando la tira se desplaza', () => {
    render(<Tira ancho={600} visible={390} />);

    fireEvent.focus(screen.getByRole('button', { name: 'Tempo' }));

    expect(traido).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });

  // En ancho caben enteras: pedirlo ahí movería la página en vertical para nada.
  it('si la tira cabe, no mueve nada', () => {
    render(<Tira ancho={390} visible={390} />);

    fireEvent.focus(screen.getByRole('button', { name: 'Tempo' }));

    expect(traido).not.toHaveBeenCalled();
  });

  it('la tira misma no se trae: solo lo que hay dentro', () => {
    render(<Tira ancho={600} visible={390} />);

    fireEvent.focus(screen.getByTestId('tira'));

    expect(traido).not.toHaveBeenCalled();
  });
});
