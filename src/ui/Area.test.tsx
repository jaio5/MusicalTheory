// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Area } from './Area';

const medida = (sobre: Partial<NonNullable<Parameters<typeof Area>[0]['medida']>> = {}) => ({
  eje: 'ancho' as const,
  menos: vi.fn(),
  mas: vi.fn(),
  puedeMenos: true,
  puedeMas: true,
  ...sobre,
});

describe('el área del banco', () => {
  it('su cabecera mide lo que un dedo, no veintiocho píxeles', () => {
    const { container } = render(
      <Area titulo="Acorde" icono={<svg />} onPlegar={() => {}} medida={medida()}>
        <p>dentro</p>
      </Area>,
    );

    expect(container.querySelector('header')).toHaveClass('min-h-tap');
    expect(container.querySelector('header')).not.toHaveClass('h-7');
    expect(screen.getByRole('region', { name: 'Acorde' })).toBeInTheDocument();
  });

  /**
   * Y sus mandos también: los 44 de la cabecera llevan el borde dentro, así que
   * a lo que se estira le quedaban 43 —medido en componer a 1024 y 1440—. La
   * caja de los mandos baja un píxel y pisa el borde, y los botones llegan.
   */
  it('sus mandos llegan a los 44 enteros, pisando el borde de la cabecera', () => {
    render(
      <Area titulo="Acorde" onPlegar={() => {}} medida={medida()}>
        <p>dentro</p>
      </Area>,
    );

    const plegar = screen.getByRole('button', { name: 'Plegar Acorde' });
    expect(plegar).toHaveClass('self-stretch');
    expect(plegar.parentElement).toHaveClass('-mb-px', 'self-stretch');
    // Y el dibujo de estrechar es adorno de un botón que ya se llama.
    const estrechar = screen.getByRole('button', { name: 'Estrechar Acorde' });
    expect(estrechar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(estrechar.querySelector('svg')).toHaveAttribute('focusable', 'false');
  });

  it('estrecha y ensancha con flechas, no con un menos y un más', () => {
    const m = medida();
    render(
      <Area titulo="Acorde" medida={m}>
        <p>dentro</p>
      </Area>,
    );
    const estrechar = screen.getByRole('button', { name: 'Estrechar Acorde' });
    const ensanchar = screen.getByRole('button', { name: 'Ensanchar Acorde' });

    fireEvent.click(estrechar);
    fireEvent.click(ensanchar);
    expect(m.menos).toHaveBeenCalledOnce();
    expect(m.mas).toHaveBeenCalledOnce();
    expect(estrechar).not.toHaveTextContent(/[−+]/);
    expect(estrechar.querySelector('svg')).not.toHaveClass('rotate-90');
    expect(estrechar.querySelector('path')).not.toBeNull();
    expect(ensanchar.querySelector('path')?.getAttribute('d')).not.toBe(
      estrechar.querySelector('path')?.getAttribute('d'),
    );
  });

  it('en una fila son «bajar» y «subir», con las flechas giradas, y se apagan en el tope', () => {
    render(
      <Area titulo="Arreglo" medida={medida({ eje: 'alto', puedeMenos: false, puedeMas: false })}>
        <p>dentro</p>
      </Area>,
    );

    const bajar = screen.getByRole('button', { name: 'Bajar Arreglo' });
    expect(bajar).toBeDisabled();
    expect(bajar.querySelector('svg')).toHaveClass('rotate-90');
    expect(screen.getByRole('button', { name: 'Subir Arreglo' })).toBeDisabled();
  });

  it('se pliega a su tira y se devuelve, y al desplegar el contenido entra animado', () => {
    const alPlegar = vi.fn();
    const { rerender, container } = render(
      <Area titulo="Acorde" onPlegar={alPlegar} atajo="A">
        <p>dentro</p>
      </Area>,
    );
    // Cargar la pantalla no anima nada.
    expect(container.querySelector('.motion-safe\\:animate-desplegar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plegar Acorde' }).querySelector('svg')).toHaveClass(
      'rotate-90',
    );
    expect(screen.getByRole('button', { name: 'Plegar Acorde' })).toHaveAttribute(
      'title',
      'Plegar Acorde · A',
    );

    rerender(
      <Area titulo="Acorde" onPlegar={alPlegar} atajo="A" plegada>
        <p>dentro</p>
      </Area>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desplegar Acorde' }));
    expect(alPlegar).toHaveBeenCalledOnce();
    expect(screen.queryByText('dentro')).toBeNull();

    rerender(
      <Area titulo="Acorde" onPlegar={alPlegar} atajo="A">
        <p>dentro</p>
      </Area>,
    );
    expect(screen.getByText('dentro').parentElement).toHaveClass('motion-safe:animate-desplegar');

    // Y plegar de nuevo y volver a un render igual no deja la marca puesta.
    rerender(
      <Area titulo="Acorde" onPlegar={alPlegar} atajo="A" plegada>
        <p>dentro</p>
      </Area>,
    );
    expect(screen.queryByText('dentro')).toBeNull();
  });

  it('una fila no gira el chevron de plegar', () => {
    render(
      <Area titulo="Arreglo" onPlegar={() => {}} pliegue="horizontal">
        <p>dentro</p>
      </Area>,
    );
    expect(
      screen.getByRole('button', { name: 'Plegar Arreglo' }).querySelector('svg'),
    ).not.toHaveClass('rotate-90');
  });

  it('plegada en horizontal, sin atajo y con scroll apagado', () => {
    const { rerender } = render(
      <Area titulo="Arreglo" onPlegar={() => {}} plegada pliegue="horizontal">
        <p>dentro</p>
      </Area>,
    );
    expect(screen.getByRole('button', { name: 'Desplegar Arreglo' })).toHaveAttribute(
      'title',
      'Desplegar Arreglo',
    );
    // La tira va pegada al borde de una caja que recorta: el aro, por dentro.
    expect(screen.getByRole('button', { name: 'Desplegar Arreglo' })).toHaveClass(
      'focus-visible:-outline-offset-3',
    );

    rerender(
      <Area titulo="Mástil" scroll={false} sinCabecera>
        <p>dentro</p>
      </Area>,
    );
    expect(screen.getByText('dentro').parentElement).toHaveClass('overflow-hidden');
    expect(screen.getByRole('heading', { name: 'Mástil' })).toHaveClass('sr-only');
  });
});
