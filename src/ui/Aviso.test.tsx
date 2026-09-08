// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Aviso } from './Aviso';

describe('Aviso', () => {
  it('no pinta nada sin mensaje', () => {
    const { container } = render(<Aviso mensaje={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  // El `&&` de quien lo usa deja `false`, no nulo: si eso pintara una caja
  // vacía, todas las formas llevarían un hueco de más debajo del botón.
  it('tampoco con un false, que es lo que deja un `&&`', () => {
    const { container } = render(<Aviso mensaje={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('un error se anuncia con calma, que es lo que se supone', () => {
    render(<Aviso mensaje="No hemos podido guardar." />);

    const aviso = screen.getByText('No hemos podido guardar.');
    expect(aviso).toHaveAttribute('aria-live', 'polite');
    expect(aviso).toHaveClass('text-oxblood-bright');
  });

  it('lo que salió bien va en verde', () => {
    render(<Aviso mensaje="Guardado." tono="hecho" />);

    expect(screen.getByText('Guardado.')).toHaveClass('text-tube-bright');
  });

  it('lo urgente corta al lector de pantalla', () => {
    render(<Aviso mensaje="La cuenta no se ha borrado." anuncio="urgente" />);

    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('La cuenta no se ha borrado.');
    expect(aviso).not.toHaveAttribute('aria-live');
  });

  // Dentro de una caja que ya anuncia, anunciar otra vez es leerlo dos veces.
  it('dentro de otra región viva no anuncia nada', () => {
    render(<Aviso mensaje="Hace falta un plan." anuncio="ninguno" />);

    const aviso = screen.getByText('Hace falta un plan.');
    expect(aviso).not.toHaveAttribute('aria-live');
    expect(aviso).not.toHaveAttribute('role');
  });
});
