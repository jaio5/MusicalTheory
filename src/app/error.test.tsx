// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ErrorDeUnaPantalla from './(marco)/error';
import ErrorDeLaRaiz from './error';
import ErrorGlobal from './global-error';

// Las letras de verdad las prueba `fuentes.test.ts`; aquí solo tienen que llegar.
vi.mock('./fuentes', () => ({ CLASES_DE_FUENTES: 'las-tres-letras' }));

/**
 * Las tres fronteras de errores dicen lo mismo, en español y con salidas.
 *
 * Sin ellas, Next pintaba la suya: «This page couldn't load», en inglés y sin
 * barra. Se vio con una escala guardada que ya no existía.
 */
describe('una pantalla que se rompe', () => {
  it('lo dice en español, y volver a intentarlo vuelve a pedirla', async () => {
    const retry = vi.fn();
    render(<ErrorDeUnaPantalla retry={retry} />);

    expect(screen.getByRole('heading', { name: 'Esta pantalla se ha roto' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('y deja salir por otro sitio', () => {
    render(<ErrorDeUnaPantalla retry={() => {}} />);

    expect(screen.getByRole('link', { name: 'Ir al camino' })).toHaveAttribute('href', '/aprender');
    expect(screen.getByRole('link', { name: 'La portada' })).toHaveAttribute('href', '/');
  });

  it('fuera del marco pone la sala, que es lo que pintaba la barra', () => {
    const { container } = render(<ErrorDeLaRaiz retry={() => {}} />);

    expect(container.firstElementChild).toHaveClass('fondo-sala');
    expect(screen.getByRole('heading', { name: 'Esta pantalla se ha roto' })).toBeInTheDocument();
  });

  it('y si se rompe el layout raíz, trae su propio documento en español', () => {
    const html = renderToStaticMarkup(<ErrorGlobal retry={() => {}} />);

    expect(html).toMatch(/^<html lang="es" class="las-tres-letras">/);
    expect(html).toContain('<title>Algo se ha roto · Caos ordenado</title>');
    expect(html).toContain('Esta pantalla se ha roto');
  });
});
