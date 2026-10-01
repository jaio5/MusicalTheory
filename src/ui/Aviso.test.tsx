// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Aviso } from './Aviso';

describe('Aviso', () => {
  /**
   * La región va montada antes que el mensaje: un lector anuncia lo que entra en
   * una región que ya estaba, y una que nace con el texto dentro no se lee en
   * todos. Vacía, eso sí, no ocupa sitio.
   */
  it('sin mensaje deja la región puesta, vacía y fuera del flujo', () => {
    const { container } = render(<Aviso mensaje={null} />);

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveClass('empty:sr-only');
  });

  // El `&&` de quien lo usa deja `false`, no nulo: si eso se pintara como texto,
  // todas las formas llevarían un «false» debajo del botón.
  it('con un false, que es lo que deja un `&&`, igual de vacía', () => {
    const { container } = render(<Aviso mensaje={false} anuncio="urgente" />);
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(container.childElementCount).toBe(1);
  });

  it('el mensaje entra en la región que ya estaba, no en otra nueva', () => {
    const { rerender } = render(<Aviso mensaje={null} />);
    const antes = document.querySelector('[aria-live="polite"]');

    rerender(<Aviso mensaje="No hemos podido guardar." />);

    expect(screen.getByText('No hemos podido guardar.')).toBe(antes);
  });

  // Sin anuncio no hay región que preparar, y una caja vacía sería ruido.
  it('sin anuncio y sin mensaje no pinta nada', () => {
    const { container } = render(<Aviso mensaje={null} anuncio="ninguno" />);
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
