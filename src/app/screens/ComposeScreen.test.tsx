// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ComposeScreen } from './ComposeScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/componer',
}));

/**
 * Lo que se prueba aquí es **qué se sacrifica en el móvil**, que es una decisión y
 * no un detalle de estilo. jsdom no tiene ancho de pantalla de verdad, así que se
 * comprueba la regla escrita: qué lleva `sm:`/`lg:` y qué no.
 */
describe('Componer en una pantalla estrecha', () => {
  it('la barra de grabar solo aparece a partir de tableta', () => {
    render(<ComposeScreen />);

    const grabar = screen.getByRole('button', { name: /grabarte tocando/i });
    const barra = grabar.parentElement;

    expect(barra?.className, 'la barra de grabar tiene que esconderse en móvil').toContain(
      'hidden',
    );
    expect(barra?.className).toContain('sm:flex');
  });

  /**
   * La rueda ocupa media pantalla de teléfono y se toca una vez, al elegir tono.
   * Plegada deja a la vista lo que se mira todo el rato: el acorde y a dónde ir.
   */
  it('la tonalidad se pliega en móvil y se despliega en pantalla ancha', () => {
    const { container } = render(<ComposeScreen />);

    const plegable = container.querySelector('.lg\\:hidden details');
    expect(plegable, 'falta el plegable de tonalidad del móvil').not.toBeNull();

    const columna = screen.getByLabelText('Tonalidad');
    expect(columna.className, 'la columna de la rueda es solo de pantalla ancha').toContain(
      'lg:flex',
    );
    expect(columna.className).toContain('hidden');
  });

  /**
   * El hueco fantasma: con el mástil abierto se podía bajar hasta una franja
   * donde no hay nada. Sale de pedir alturas de columna donde no hay columnas —en
   * el móvil las filas se miden por su contenido— y de un tope de 72vh que en un
   * teléfono es la pantalla entera.
   */
  /**
   * El hueco fantasma y el solape son **el mismo fallo**: filas que se estiran
   * para repartirse el alto. Si el contenido crece —al elegir un acorde salen sus
   * formas— se sale de su fila y se monta encima de la siguiente; si mengua, deja
   * hueco por el que desplazarse. Medidas por su contenido, ninguna de las dos.
   */
  it('en móvil las filas se miden por su contenido, no por el hueco', () => {
    const { container } = render(<ComposeScreen />);

    const rejilla = container.querySelector('.grid');
    expect(rejilla?.className, 'sin esto, las filas se estiran y el contenido se monta').toContain(
      'auto-rows-min',
    );
    expect(rejilla?.className, 'en columnas sí se estiran').toContain('lg:auto-rows-auto');
  });

  it('con el mástil abierto, su tope de alto es distinto en móvil que en escritorio', async () => {
    const { container } = render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    const panel = container.querySelector('#herramienta-abierta');
    expect(panel, 'el mástil tendría que haberse abierto').not.toBeNull();
    // 72vh de un teléfono es la pantalla entera: el mástil empujaba el resto
    // fuera y lo que quedaba debajo era hueco por el que desplazarse.
    expect(panel?.className).toContain('max-h-[45vh]');
    expect(panel?.className).toContain('lg:max-h-');
  });

  // Lo que se mira mientras tocas sigue estando en las dos anchuras.
  it('el acorde y a dónde ir no se sacrifican', () => {
    render(<ComposeScreen />);

    expect(screen.getByLabelText('El acorde y sus formas')).toBeInTheDocument();
    expect(screen.getByLabelText('A dónde puedes ir')).toBeInTheDocument();
  });
});
