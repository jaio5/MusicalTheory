// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Segmentado } from './Segmentado';

const OPCIONES = [
  { valor: 'ritmica', texto: 'Rítmica' },
  { valor: 'punteo', texto: 'Punteo', title: 'Una nota cada vez' },
] as const;

describe('Segmentado', () => {
  it('es un grupo con nombre, y dice cuál está puesta', () => {
    render(
      <Segmentado etiqueta="Qué tocas" opciones={OPCIONES} valor="punteo" onCambiar={() => {}} />,
    );

    expect(screen.getByRole('group', { name: 'Qué tocas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Punteo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rítmica' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Punteo' })).toHaveAttribute(
      'title',
      'Una nota cada vez',
    );
  });

  it('avisa de la que se elige', async () => {
    const onCambiar = vi.fn();
    render(
      <Segmentado etiqueta="Qué tocas" opciones={OPCIONES} valor="punteo" onCambiar={onCambiar} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Rítmica' }));

    expect(onCambiar).toHaveBeenCalledWith('ritmica');
  });

  it('la elegida no lleva el latón macizo de una acción, sino la marca de estar puesta', () => {
    // Es la razón de que exista: con el botón primario como selección, la
    // opción elegida y la acción de al lado se pintaban igual.
    render(
      <Segmentado
        etiqueta="Qué tocas"
        opciones={OPCIONES}
        valor="ritmica"
        onCambiar={() => {}}
        className="mt-2"
      />,
    );

    const elegida = screen.getByRole('button', { name: 'Rítmica' });
    expect(elegida.className).toContain('text-brass-bright');
    expect(elegida.className).not.toContain('bg-brass');
    expect(screen.getByRole('group').className).toContain('mt-2');
  });

  /**
   * **El aro del foco va por dentro.** El carril recorta (`overflow-hidden`), y
   * el aro de la casa, tres píxeles por fuera, quedaba cortado: con el tabulador
   * no se veía cuál de las opciones tenía el foco.
   */
  it('el aro del foco va hacia dentro, donde el carril no lo recorta', () => {
    render(
      <Segmentado etiqueta="Qué tocas" opciones={OPCIONES} valor="punteo" onCambiar={() => {}} />,
    );

    expect(screen.getByRole('group')).toHaveClass('overflow-hidden');
    for (const boton of screen.getAllByRole('button')) {
      expect(boton).toHaveClass('focus-visible:-outline-offset-3');
    }
  });
});
