// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBancoStore } from '@state/banco';
import { useSessionStore } from '@state/session-store';
import { DEFAULT_BANCO } from '@state/workspace';

import { ComposeScreen } from './ComposeScreen';

// El lienzo de verdad solo lo carga su propio test, por lo que cuenta
// `ComposeScreen.test.tsx`: dos copias del módulo en el mismo proceso descuadran
// la cobertura.
vi.mock('@features/arrange/ArrangeCanvas', async () => {
  const { createElement } = await import('react');
  return {
    ArrangeCanvas: () => createElement('button', { type: 'button' }, 'Escuchar la canción'),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/componer',
}));

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  useBancoStore.setState({ espacio: DEFAULT_BANCO.espacio, repartos: DEFAULT_BANCO.repartos });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Ancho = 'telefono' | 'banco';

/**
 * Si una caja no se pinta en ese ancho, leyendo las clases como las lee
 * Tailwind con el corte `lg`.
 *
 * Un `popover` cerrado tampoco se pinta, y un `sr-only` no ocupa: los dos pueden
 * cambiar al hidratar sin mover nada.
 */
function noSePinta(caja: Element, ancho: Ancho): boolean {
  const clases = [...caja.classList];
  if (caja.hasAttribute('popover') || clases.includes('sr-only')) {
    return true;
  }
  if (ancho === 'telefono') {
    return clases.includes('hidden') || clases.includes('max-lg:hidden');
  }
  const loDevuelveElBanco = clases.some((clase) =>
    /^(?:sm|md|lg):(?:flex|block|inline|inline-flex|grid)$/.test(clase),
  );
  return clases.includes('lg:hidden') || (clases.includes('hidden') && !loDevuelveElBanco);
}

/**
 * Lo que se pinta en un ancho, caja a caja: su etiqueta, sus clases y su texto.
 *
 * Las clases van porque **también mueven**: la fila de mandos de escritorio se
 * envuelve en tres renglones en un teléfono, con el mismo texto dentro.
 */
function loQueSePinta(raiz: Element, ancho: Ancho): string[] {
  const pintado: string[] = [];
  const recorrer = (caja: Element) => {
    if (noSePinta(caja, ancho)) {
      return;
    }
    const texto = [...caja.childNodes]
      .filter((nodo) => nodo.nodeType === Node.TEXT_NODE)
      .map((nodo) => nodo.textContent)
      .join('')
      .trim();
    pintado.push(
      `${caja.tagName.toLowerCase()} [${[...caja.classList].sort().join(' ')}] ${texto}`,
    );
    [...caja.children].forEach(recorrer);
  };
  [...raiz.children].forEach(recorrer);
  return pintado;
}

/** El HTML que manda el servidor, que no sabe cuánto mide la pantalla. */
function delServidor(): Element {
  const caja = document.createElement('div');
  caja.innerHTML = renderToString(<ComposeScreen />);
  return caja;
}

/** Lo que queda después de hidratar, cuando el cliente ya sabe si hay banco. */
function despuesDeHidratar(hayBanco: boolean): Element {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: hayBanco, addEventListener: () => {}, removeEventListener: () => {} })),
  );
  return render(<ComposeScreen />).container;
}

/**
 * **Lo que se ve al llegar no puede cambiar al hidratar**, en ningún ancho.
 *
 * El servidor no sabe el ancho y pinta el banco. Cuando la cabecera, las de las
 * áreas y la fila de abajo dependían de `useHayBanco`, un teléfono recibía la de
 * escritorio —la línea, los mandos envueltos en tres renglones, «Áreas como
 * venían», la fila de abajo— y al hidratar se le cambiaba por la suya: la
 * pantalla entera subía de golpe. Medido con la CPU a ×4: **CLS 0,12 a 390 y
 * 0,05 a 800**. Ahora lo de cada ancho lo eligen las clases, y JavaScript solo
 * poda lo que ya estaba escondido.
 *
 * Se compara lo que pinta el HTML del servidor con lo que pinta el cliente ya
 * hidratado, leyendo las clases para cada ancho: si algo visible cambia, se
 * movería.
 */
describe('La primera pintura de componer', () => {
  it('en un telefono es la misma antes y despues de hidratar', () => {
    const servidor = loQueSePinta(delServidor(), 'telefono');

    expect(loQueSePinta(despuesDeHidratar(false), 'telefono')).toEqual(servidor);
  });

  it('y en el banco tambien', () => {
    const servidor = loQueSePinta(delServidor(), 'banco');

    expect(loQueSePinta(despuesDeHidratar(true), 'banco')).toEqual(servidor);
  });

  // Calibrado: si las dos pasadas pintaran lo mismo en cualquier caso, las dos
  // de arriba no probarían nada. Del servidor al teléfono cambia el árbol
  // —se va «Áreas como venían», llega la lista de «Más»—, y eso no se ve.
  it('aunque el arbol cambie al hidratar', () => {
    const servidor = delServidor();
    const telefono = despuesDeHidratar(false);

    expect(servidor.textContent).toContain('Áreas como venían');
    expect(telefono.textContent).not.toContain('Áreas como venían');
    expect(loQueSePinta(servidor, 'banco')).not.toEqual(loQueSePinta(telefono, 'banco'));
  });
});
