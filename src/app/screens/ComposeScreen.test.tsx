// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { ComposeScreen } from './ComposeScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/componer',
}));

/**
 * Se limpia el almacenamiento, no solo el estado.
 *
 * Desde que la tonalidad se recuerda, `reset()` no basta: la pantalla llama a
 * `loadWorkspace` al montarse y volvería a poner la que dejó puesta el test
 * anterior. Es el mismo motivo por el que existe la persistencia, visto desde el
 * otro lado.
 */
beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
});

/**
 * Lo que se prueba aquí es **qué se sacrifica en el móvil**, que es una decisión y
 * no un detalle de estilo. jsdom no tiene ancho de pantalla de verdad, así que se
 * comprueba la regla escrita: qué lleva `sm:`/`lg:` y qué no.
 */
describe('Componer en una pantalla estrecha', () => {
  /**
   * Grabar dejó de ser una franja fija arriba.
   *
   * Cuando grababa vídeo tenía que esconderse en el móvil: se llevaba un renglón
   * entero para algo que pide trípode y pantalla grande. Grabando solo el sonido
   * ya no hay franja que esconder —es una herramienta más de la fila de abajo—,
   * así que la pregunta cambia: **que esté disponible en cualquier ancho**, que
   * es justo lo contrario de lo que se defendía antes
   * ([adr/0023](../../../docs/adr/0023-grabar-solo-el-sonido.md)).
   */
  it('grabar es una herramienta más, y está también en el movil', async () => {
    render(<ComposeScreen />);

    const pestana = screen.getByRole('button', { name: 'Grabar' });
    expect(pestana.className, 'la pestaña de grabar no se esconde en móvil').not.toContain(
      'hidden',
    );

    await userEvent.click(pestana);

    expect(screen.getByRole('button', { name: /grabar lo que tocas/i })).toBeInTheDocument();
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
    // Con tonalidad puesta: sin ella las dos columnas se juntan a propósito en
    // una sola cosa que decir, que es por dónde se empieza.
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    render(<ComposeScreen />);

    expect(screen.getByLabelText('El acorde y sus formas')).toBeInTheDocument();
    expect(screen.getByLabelText('A dónde puedes ir')).toBeInTheDocument();
  });

  /**
   * Qué va primero cuando se apilan.
   *
   * En pantalla ancha son tres columnas y no hay «antes»; apiladas en un
   * teléfono sí, y salían en el orden de la pantalla ancha. Sin acorde elegido,
   * las dos primeras franjas son invitaciones —«elige uno», «abre el micro»— así
   * que había que pasar por delante de setecientos píxeles de sugerencias para
   * llegar a lo único que se puede hacer, que es la lista. Con acorde el orden es
   * el bueno, y se deja.
   */
  it('sin acorde elegido, en el móvil la lista va antes que las invitaciones', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    render(<ComposeScreen />);

    expect(screen.getByLabelText('A dónde puedes ir').className).toContain('order-1');
    expect(screen.getByLabelText('El acorde y sus formas').className).toContain('order-2');
  });

  it('con acorde elegido vuelve el orden de siempre: primero cómo se hace', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    actions.pushChord({ symbol: 'C', label: 'I', root: 0, notes: [0, 4, 7], why: 'La casa.' });

    render(<ComposeScreen />);

    expect(screen.getByLabelText('El acorde y sus formas').className).toContain('order-1');
    expect(screen.getByLabelText('A dónde puedes ir').className).toContain('order-2');
  });

  /**
   * Y sin tonalidad, **una sola**.
   *
   * Eran tres paneles diciendo cada uno su versión de «elige una tonalidad»: uno
   * centrado a media pantalla, otro debajo del rótulo «Elegido» y un tercero en
   * la columna de al lado. Tres veces lo mismo en una pantalla vacía se lee como
   * una pantalla rota, no como una que espera.
   */
  it('sin tonalidad, las dos columnas se juntan en una sola cosa que decir', () => {
    useSessionStore.getState().actions.reset();

    render(<ComposeScreen />);

    expect(screen.getByLabelText('Por dónde se empieza')).toBeInTheDocument();
    expect(screen.queryByLabelText('El acorde y sus formas')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('A dónde puedes ir')).not.toBeInTheDocument();
  });
});

describe('La tonalidad que se está usando', () => {
  it('sin elegir se dice, y se dice qué hacer', () => {
    useSessionStore.getState().actions.reset();

    render(<ComposeScreen />);

    expect(screen.getByText('sin elegir')).toBeInTheDocument();
    expect(screen.getByText(/Pulsa una tonalidad para empezar/)).toBeInTheDocument();
  });

  /**
   * Y **se pliega sola en cuanto hay tonalidad**.
   *
   * No lo hacía, y era el peor fallo de la pantalla en un teléfono: la barra es
   * `shrink-0` y la rueda abierta medía seiscientos trece píxeles de ochocientos,
   * así que a lo que crece —el acorde, la lista, la canción— le tocaban cero, y
   * no había forma de desplazarse hasta ello. Elegías el tono y la pantalla
   * parecía vaciarse. Se vio midiendo el reparto de alto en un Chromium de
   * verdad; ningún test lo habría visto mirando texto.
   */
  it('la tonalidad se abre sin elegir y se pliega al elegir', () => {
    useSessionStore.getState().actions.reset();
    const { container, rerender } = render(<ComposeScreen />);

    expect(container.querySelector('details')).toHaveAttribute('open');

    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    rerender(<ComposeScreen />);

    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });

  it('elegida, se lee en las dos: la plegada del móvil y la columna de al lado', () => {
    // Las dos existen a la vez en el HTML —una se esconde con `lg:`— y las dos
    // tienen que decir lo mismo: si no, girar el móvil cambiaría la tonalidad a
    // ojos de quien mira.
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<ComposeScreen />);

    expect(screen.getAllByText(/A menor/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('sin elegir')).not.toBeInTheDocument();
  });
});

describe('Las herramientas del cajón', () => {
  it('pulsar la que está abierta la cierra', async () => {
    // El mismo botón para las dos cosas: con el cajón abierto, lo que se quiere
    // hacer con la pestaña que está puesta es cerrarla.
    const { container } = render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));
    expect(container.querySelector('#herramienta-abierta')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(container.querySelector('#herramienta-abierta')).toBeNull();
  });
});
