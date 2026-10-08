// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Vacio } from './Vacio';

describe('lo que se ve cuando no hay nada', () => {
  it('con todo: icono, título, texto y acción', () => {
    render(
      <Vacio
        icono={<svg data-testid="dibujo" />}
        titulo="Falta la tonalidad"
        accion={<button>Elegir</button>}
      >
        Elígela y seguimos.
      </Vacio>,
    );

    expect(screen.getByText('Falta la tonalidad')).toBeInTheDocument();
    expect(screen.getByText('Elígela y seguimos.')).toBeInTheDocument();
    expect(screen.getByTestId('dibujo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir' })).toBeInTheDocument();
  });

  it('la acción ocupa todo el ancho: en una columna centrada encogía a su contenido', () => {
    // Los cuatro botones de EmpezarPorTonalidad se quedaban en 42 px y salían
    // montados. Que el envoltorio sea `w-full` es lo que les da donde repartirse.
    render(<Vacio titulo="Falta" accion={<button>Elegir</button>} />);

    const envoltorio = screen.getByRole('button', { name: 'Elegir' }).parentElement!;
    expect(envoltorio).toHaveClass('w-full', 'justify-center', 'mt-1');
  });

  it('discreto: sin margen en la acción, y sin icono ni texto si no se dan', () => {
    const { container } = render(
      <Vacio tono="discreto" titulo="Nada" accion={<a href="https://ejemplo.test/x">Ir</a>} />,
    );

    expect(screen.getByRole('link', { name: 'Ir' }).parentElement).not.toHaveClass('mt-1');
    expect(screen.getByRole('link', { name: 'Ir' }).parentElement).toHaveClass('w-full');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('discreto con icono y texto: todo más pequeño', () => {
    const { container } = render(
      <Vacio tono="discreto" icono={<svg />} titulo="Nada">
        Aún no hay nada.
      </Vacio>,
    );

    // Más pequeño el dibujo y el título, **la explicación no**: es justo lo que
    // hay que leer, y va al cuerpo como cualquier párrafo (adr/0122).
    expect(container.querySelector('[aria-hidden]')).toHaveClass('size-11');
    expect(screen.getByText('Aún no hay nada.')).not.toHaveClass('text-sm');
    expect(screen.getByText('Nada')).toHaveClass('text-base');
  });

  it('sin acción no pinta envoltorio', () => {
    const { container } = render(<Vacio titulo="Nada" />);
    expect(container.firstElementChild!.querySelector('div')).toBeNull();
  });
});
