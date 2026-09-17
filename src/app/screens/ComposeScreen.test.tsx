// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useBancoStore } from '@state/banco';
import { useSessionStore } from '@state/session-store';
import { DEFAULT_BANCO, loadPreferences } from '@state/workspace';

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
});

/**
 * El banco de trabajo.
 *
 * Lo que se prueba aquí es **que no hay que elegir**: antes eran dos caras con un
 * conmutador, y ver el acorde mientras escribías la canción costaba un salto y
 * volver a encontrar dónde estabas
 * ([adr/0031](../../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)).
 */
describe('Las areas del banco', () => {
  function conTonalidad(): void {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  }

  it('la cancion, el acorde y a donde ir se ven a la vez', () => {
    conTonalidad();

    render(<ComposeScreen />);

    expect(screen.getByLabelText('Arreglo')).toBeInTheDocument();
    expect(screen.getByLabelText('Acorde')).toBeInTheDocument();
    expect(screen.getByLabelText('A dónde ir')).toBeInTheDocument();
    expect(screen.getByLabelText('Tonalidad')).toBeInTheDocument();
  });

  // Ya no hay conmutador: es lo que se retira, y si volviera sin querer este
  // test lo diría.
  it('no queda conmutador entre dos caras', () => {
    conTonalidad();

    render(<ComposeScreen />);

    expect(screen.queryByRole('group', { name: 'Cómo componer' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Espacio de trabajo' })).toBeInTheDocument();
  });

  /**
   * Cada área lleva su cabecera con su nombre: es lo que sustituye a los rótulos
   * sueltos encima de cada bloque, y lo que hace que los mandos de una cosa vivan
   * en esa cosa.
   */
  it('cada area lleva su cabecera con su nombre', () => {
    conTonalidad();

    render(<ComposeScreen />);

    for (const nombre of ['Arreglo', 'Acorde', 'A dónde ir']) {
      expect(
        within(screen.getByLabelText(nombre)).getByRole('heading', { name: nombre }),
      ).toBeInTheDocument();
    }
  });

  /**
   * Sin tonalidad no hay nada que inspeccionar, así que la pantalla dice **una
   * sola cosa**. Tres paneles repitiendo cada uno su versión de «elige una
   * tonalidad» se leen como una pantalla rota, no como una que espera.
   */
  it('sin tonalidad, solo se dice por donde empezar', () => {
    useSessionStore.getState().actions.reset();

    render(<ComposeScreen />);

    expect(screen.getByLabelText('Arreglo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Acorde')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('A dónde ir')).not.toBeInTheDocument();
  });
});

/**
 * Los divisores.
 *
 * Se prueba el teclado y no el arrastre: jsdom no tiene punteros de verdad, y lo
 * que de verdad se olvida al escribir un divisor es que se pueda mover sin
 * ratón. Un editor que solo se reparte arrastrando es un editor a medias.
 */
describe('Repartir el banco', () => {
  it('los divisores se mueven con el teclado y dicen cuanto miden', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    const divisor = screen.getByRole('separator', { name: 'Ancho de la tonalidad' });
    const antes = Number(divisor.getAttribute('aria-valuenow'));

    divisor.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(useBancoStore.getState().izquierda).toBe(antes + 1);
  });

  it('y el reparto se recuerda de una vez para otra', async () => {
    render(<ComposeScreen />);

    const divisor = screen.getByRole('separator', { name: 'Ancho de la tonalidad' });
    divisor.focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(loadPreferences().banco.izquierda).toBe(useBancoStore.getState().izquierda);
  });

  // `Inicio` y el doble clic hacen lo mismo: devolver la medida de fábrica.
  it('Inicio devuelve la medida de fabrica', async () => {
    render(<ComposeScreen />);
    const divisor = screen.getByRole('separator', { name: 'Ancho de la tonalidad' });

    divisor.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}');

    expect(useBancoStore.getState().izquierda).toBe(DEFAULT_BANCO.izquierda);
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

describe('El area de abajo', () => {
  it('pulsar la que esta abierta la cierra', async () => {
    // El mismo botón para las dos cosas: con el área abierta, lo que se quiere
    // hacer con la pestaña que está puesta es cerrarla.
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));
    expect(screen.getByLabelText('Mástil')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(screen.queryByLabelText('Mástil')).not.toBeInTheDocument();
  });

  it('y tambien se cierra desde su propia cabecera', async () => {
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Ideas' }));

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar Ideas' }));

    expect(screen.queryByLabelText('Ideas')).not.toBeInTheDocument();
  });

  // Qué editor había abierto es reparto, y el reparto se recuerda.
  it('que editor habia abierto se recuerda', async () => {
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Sesiones' }));

    expect(loadPreferences().banco.abajo).toBe('sesiones');
  });
});
