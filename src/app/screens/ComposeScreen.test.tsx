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

  /**
   * La herramienta abierta es un **cajón**, no una franja más.
   *
   * Empujando, se llevaba una tajada del alto y las tres columnas se apretaban:
   * en un portátil, la rueda salía cortada por la mitad y la lista de acordes a
   * media fila. Al ponerles suelo, el que desaparecía era el panel. No hay
   * reparto bueno cuando son cinco franjas peleando por el mismo alto.
   */
  it('la herramienta abierta se superpone en vez de encoger las columnas', async () => {
    const { container } = render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    const panel = container.querySelector('#herramienta-abierta');
    expect(panel, 'el mástil tendría que haberse abierto').not.toBeNull();
    // `absolute` + `bottom-full`: sale hacia arriba desde la barra de pestañas.
    expect(panel?.className, 'sin absolute vuelve a empujar').toContain('absolute');
    expect(panel?.className).toContain('bottom-full');
    // Y con tope, que taparlo todo tampoco vale.
    expect(panel?.className).toMatch(/max-h-\[min\(\d+vh/);
  });

  it('el cajón se lee como una capa encima, no como el final de la pantalla', async () => {
    // Con el mismo fondo que lo de debajo parecía que la pantalla acababa ahí.
    // Es la regla de profundidad del proyecto: se nota qué está encima de qué.
    const { container } = render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Ideas' }));

    const panel = container.querySelector('#herramienta-abierta');
    expect(panel, 'las ideas tendrían que haberse abierto').not.toBeNull();
    expect(panel?.className).toContain('bg-surface-raised');
    expect(panel?.className).toContain('shadow-');
  });

  /**
   * El título y el metrónomo comparten fila.
   *
   * Eran dos franjas fijas de unos 110 px juntas, y en un portátil eso es justo
   * lo que le falta al mástil para verse entero. La pantalla sigue teniendo su
   * `h1` y su línea —que es lo que pide la regla—; lo que se fue es la fila.
   */
  it('el metrónomo va en el encabezado, no en una franja propia', () => {
    const { container } = render(<ComposeScreen />);

    const encabezado = container.querySelector('h1')?.parentElement;
    expect(encabezado?.textContent, 'el metrónomo no está en la fila del título').toContain('bpm');
  });

  // Lo que se mira mientras tocas sigue estando en las dos anchuras.
  it('el acorde y a dónde ir no se sacrifican', () => {
    render(<ComposeScreen />);

    expect(screen.getByLabelText('El acorde y sus formas')).toBeInTheDocument();
    expect(screen.getByLabelText('A dónde puedes ir')).toBeInTheDocument();
  });
});
