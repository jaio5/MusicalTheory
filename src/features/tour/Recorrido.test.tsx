// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBancoStore } from '@state/banco';
import { CLAVE_RECORRIDO, guardarPasoDelRecorrido, type LoQuePuso } from '@state/recorrido';
import { useSessionStore } from '@state/session-store';

import { LanzadorDelRecorrido } from './Lanzador';
import { selectorDe } from './Recorrido';

/**
 * La dirección, como un almacén: `usePathname` repinta cuando cambia, igual que
 * en Next, y `push` la cambia un momento después, que es lo que tarda en llegar
 * la pantalla nueva.
 */
const navegacion = vi.hoisted(() => {
  let ruta = '/aprender';
  const oyentes = new Set<() => void>();
  const poner = (nueva: string) => {
    ruta = nueva;
    oyentes.forEach((oyente) => oyente());
  };
  return {
    ruta: () => ruta,
    poner,
    suscribir: (oyente: () => void) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    push: vi.fn((nueva: string) => {
      queueMicrotask(() => poner(nueva));
    }),
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const router = { push: navegacion.push };
  return {
    usePathname: () => useSyncExternalStore(navegacion.suscribir, navegacion.ruta),
    useRouter: () => router,
  };
});

const SIN_PONER: LoQuePuso = { tonalidad: false, espacio: null };

function guardado(): string | null {
  return localStorage.getItem(CLAVE_RECORRIDO);
}

/** jsdom no maqueta: la caja de cada pieza se pone a mano. */
function conCaja<T extends Element>(elemento: T, x: number, y: number, ancho = 100, alto = 40): T {
  elemento.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      width: ancho,
      height: alto,
      right: x + ancho,
      bottom: y + alto,
    }) as DOMRect;
  return elemento;
}

/** Una pieza de la pantalla, puesta fuera de lo que pinta React. */
function pieza(html: string, x = 10, y = 10): HTMLElement {
  const caja = document.createElement('div');
  caja.innerHTML = html;
  const elemento = caja.firstElementChild as HTMLElement;
  document.body.append(elemento);
  return conCaja(elemento, x, y);
}

function empezarEn(paso: string | null, origen: string | null, puso = SIN_PONER): void {
  guardarPasoDelRecorrido({ paso, origen, puso });
}

async function abrir(nombre: string | RegExp = /./): Promise<HTMLElement> {
  render(<LanzadorDelRecorrido />);
  return screen.findByRole('dialog', { name: nombre });
}

beforeEach(() => {
  localStorage.clear();
  navegacion.poner('/aprender');
  navegacion.push.mockClear();
  useBancoStore.setState({ espacio: 'tocando' });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('cuándo sale', () => {
  it('la primera vez, con su título y su descripción, y el foco en «Siguiente»', async () => {
    const dialogo = await abrir('Bienvenido a Caos ordenado');

    expect(dialogo).toHaveAccessibleDescription(/En un par de minutos te enseño/);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Bienvenida · 1 de 21')).toBeInTheDocument();
    // Apunta dónde estabas, para devolverte allí.
    await waitFor(() => expect(JSON.parse(guardado()!)).toMatchObject({ origen: '/aprender' }));
  });

  it.each(['/olvidada', '/planes/estudio'])(
    'no interrumpe un trámite: en %s no empieza',
    (ruta) => {
      navegacion.poner(ruta);
      const { container } = render(<LanzadorDelRecorrido />);
      expect(container).toBeEmptyDOMElement();
      expect(guardado()).toBeNull();
    },
  );

  it('quien ya lo ha visto no lo descarga', () => {
    localStorage.setItem(CLAVE_RECORRIDO, 'visto');
    const { container } = render(<LanzadorDelRecorrido />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('moverse por él', () => {
  it('«Siguiente», «Anterior» y las flechas, y cada paso se anuncia con lo que señala', async () => {
    pieza('<nav aria-label="Pantallas"></nav>', 200, 0);
    const dialogo = await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('heading', { name: 'Las cuatro pantallas' });
    await waitFor(() =>
      expect(screen.getByText(/^Paso 2 de 21\. Las cuatro pantallas\./)).toHaveTextContent(
        'Señalado: la navegación entre pantallas.',
      ),
    );
    expect(dialogo).toHaveAccessibleDescription(/Señalado: la navegación entre pantallas/);

    fireEvent.keyDown(dialogo, { key: 'ArrowLeft' });
    await screen.findByRole('heading', { name: 'Bienvenido a Caos ordenado' });
    // En el primero, «Anterior» no hace nada.
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.keyDown(dialogo, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Bienvenido a Caos ordenado' })).toBeVisible();

    fireEvent.keyDown(dialogo, { key: 'ArrowRight' });
    await screen.findByRole('heading', { name: 'Las cuatro pantallas' });
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await screen.findByRole('heading', { name: 'Bienvenido a Caos ordenado' });
  });

  /** Componer escucha `1`, `2` y `3` en la ventana: no pueden cambiar de espacio por debajo. */
  it('las teclas no salen del diálogo', async () => {
    const enLaVentana = vi.fn();
    window.addEventListener('keydown', enLaVentana);
    const dialogo = await abrir();

    fireEvent.keyDown(dialogo, { key: '2' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Siguiente' }), { key: 'Tab' });

    expect(enLaVentana).not.toHaveBeenCalled();
    window.removeEventListener('keydown', enLaVentana);
  });

  it('va solo a la pantalla de cada paso', async () => {
    empezarEn('aprender-hoy', '/afinar');
    navegacion.poner('/afinar');
    pieza('<div data-tour="aprender-hoy"></div>');

    await abrir('Tu meta y por dónde seguir');

    await waitFor(() => expect(navegacion.push).toHaveBeenCalledWith('/aprender'));
    await waitFor(() => expect(navegacion.ruta()).toBe('/aprender'));
  });

  /**
   * Lo que se pinta de nuevo —el lienzo al cambiar de espacio— deja la pieza de
   * antes fuera del documento: se busca otra vez por su nombre.
   */
  it('sigue a la pieza aunque la pantalla la vuelva a pintar', async () => {
    empezarEn('aprender-hoy', '/aprender');
    const vieja = pieza('<div data-tour="aprender-hoy"></div>', 10, 10);
    await abrir('Tu meta y por dónde seguir');
    const foco = () => document.querySelector<HTMLElement>('dialog [aria-hidden="true"]')!;
    await waitFor(() => expect(foco().style.left).toBe('4px'));

    vieja.remove();
    pieza('<div data-tour="aprender-hoy"></div>', 300, 10);

    await waitFor(() => expect(foco().style.left).toBe('294px'));
  });

  it('enciende también lo que flota fuera de la pieza', async () => {
    empezarEn('componer-tonalidad', '/componer');
    navegacion.poner('/componer');
    // La caja encendida se recorta a la ventana, y jsdom la mide de cero.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 844,
      configurable: true,
    });
    const barra = pieza('<div data-tour="componer-tonalidad"><div></div></div>', 0, 100);
    conCaja(barra.firstElementChild!, 0, 145, 390, 480);

    await abrir('Componer empieza por la tonalidad');

    const foco = () => document.querySelector<HTMLElement>('dialog [aria-hidden="true"]')!;
    // La barra mide 45 y la rueda cuelga hasta 625: se enciende todo, con aire.
    await waitFor(() => expect(foco().style.height).toBe(`${525 + 12}px`));
    // @ts-expect-error -- se devuelven las de jsdom.
    delete document.documentElement.clientWidth;
    // @ts-expect-error -- lo mismo.
    delete document.documentElement.clientHeight;
  });

  /**
   * Una pieza que no llega —una pantalla que no la pinta, un lienzo que no
   * termina de descargarse— no deja el recorrido esperando: pasado el plazo, el
   * paso se enseña sin señalar nada.
   */
  it('sin pieza a tiempo, el paso sale igual y no dice que señala nada', async () => {
    empezarEn('bienvenida', '/aprender');
    await abrir();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(screen.getByText(/^Paso 3 de 21\. Tu meta y por dónde seguir\./)).not.toHaveTextContent(
      'Señalado',
    );
  });

  it('en un teléfono, sin áreas ni teclas, y con lo que allí cambia de sitio', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    empezarEn('componer-bandeja', '/componer');
    navegacion.poner('/componer');

    await abrir('Lo que se abre abajo');

    expect(screen.getByText(/^En «Más» están/)).toBeInTheDocument();
    expect(screen.getByText('Componer · 15 de 19')).toBeInTheDocument();
    // @ts-expect-error -- jsdom no la trae, y así se queda para los demás.
    delete window.matchMedia;
  });
});

describe('componer, para enseñarse', () => {
  it('pone el espacio y Do mayor si faltan, y al acabar los deshace', async () => {
    useBancoStore.setState({ espacio: 'escribir' });
    empezarEn('componer-espacios', '/componer');
    navegacion.poner('/componer');

    await abrir('Tres maneras de escribir');

    await waitFor(() =>
      expect(JSON.parse(guardado()!).puso).toEqual({ tonalidad: true, espacio: 'escribir' }),
    );
    expect(useBancoStore.getState().espacio).toBe('tocando');
    expect(useSessionStore.getState().pinnedKey).toEqual({ tonic: 0, mode: 'major' });

    // Dos más allá se escribe: cambia de espacio sin olvidar cuál había.
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('heading', { name: 'Escribir: la canción en bloques' });
    await waitFor(() => expect(useBancoStore.getState().espacio).toBe('escribir'));
    useBancoStore.setState({ espacio: 'ensayar' });
    expect(JSON.parse(guardado()!).puso.espacio).toBe('escribir');

    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));

    await waitFor(() => expect(guardado()).toBe('visto'));
    expect(useBancoStore.getState().espacio).toBe('escribir');
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });

  it('la tonalidad que cambiaste no se toca, ni la que no puso él', async () => {
    empezarEn('componer-tocar', '/componer', { tonalidad: true, espacio: null });
    navegacion.poner('/componer');
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'minor' });

    await abrir('Tocar y parar');
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));
    await waitFor(() => expect(guardado()).toBe('visto'));
    expect(useSessionStore.getState().pinnedKey).toEqual({ tonic: 0, mode: 'minor' });
  });

  it('si apuntó que puso una y ya no hay ninguna, no hace nada', async () => {
    empezarEn('afinar-afinador', '/afinar', { tonalidad: true, espacio: null });
    navegacion.poner('/afinar');

    await abrir('Cuerda a cuerda');
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));

    await waitFor(() => expect(guardado()).toBe('visto'));
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });
});

describe('acabar', () => {
  it('«Terminar» te devuelve a donde estabas, y el foco al botón que lo abrió', async () => {
    const boton = document.createElement('button');
    boton.dataset['recorrido'] = 'volver';
    document.body.append(boton);
    boton.focus();
    empezarEn('despedida', '/aprender');
    navegacion.poner('/afinar');

    const dialogo = await abrir('Ya está');
    // La pantalla de origen se vuelve a pintar: el botón es otro, con la misma marca.
    boton.remove();
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    // Un Escape justo detrás no acaba dos veces ni navega otra vez.
    fireEvent(dialogo, new Event('cancel', { cancelable: true }));
    expect(navegacion.push).toHaveBeenCalledTimes(1);
    expect(navegacion.push).toHaveBeenCalledWith('/aprender');
    const nuevo = document.createElement('button');
    nuevo.dataset['recorrido'] = 'volver';
    setTimeout(() => document.body.append(nuevo), 120);

    await waitFor(() => expect(guardado()).toBe('visto'));
    expect(nuevo).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si lo que tenía el foco no vuelve, se da por visto igual', async () => {
    const campo = document.createElement('input');
    campo.id = 'campo';
    document.body.append(campo);
    campo.focus();
    await abrir();
    campo.remove();

    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));

    await waitFor(() => expect(guardado()).toBe('visto'), { timeout: 2000 });
  });

  it('Escape lo cierra, cuenta como visto y devuelve el foco a donde estaba', async () => {
    const enlace = document.createElement('a');
    enlace.href = '#';
    document.body.append(enlace);
    enlace.focus();
    const dialogo = await abrir();

    fireEvent(dialogo, new Event('cancel', { cancelable: true }));

    await waitFor(() => expect(guardado()).toBe('visto'));
    expect(enlace).toHaveFocus();
  });

  /**
   * Chrome cierra sin `cancel` al segundo Escape seguido; y el modo estricto de
   * React lo cierra y lo vuelve a abrir al montar, que no es acabar.
   */
  it('un cierre del navegador acaba; uno con el diálogo abierto otra vez, no', async () => {
    const dialogo = await abrir();

    fireEvent(dialogo, new Event('close'));
    expect(guardado()).not.toBe('visto');

    dialogo.removeAttribute('open');
    fireEvent(dialogo, new Event('close'));
    await waitFor(() => expect(guardado()).toBe('visto'));
    // Acabar dos veces no deshace dos veces.
    fireEvent(dialogo, new Event('cancel', { cancelable: true }));
  });

  it('con el diálogo del navegador, se abre como modal y se cierra con él', async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    Object.assign(HTMLDialogElement.prototype, { showModal, close });

    await abrir();
    expect(showModal).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));
    await waitFor(() => expect(guardado()).toBe('visto'));
    expect(close).toHaveBeenCalled();

    // @ts-expect-error -- jsdom no los trae, y así se quedan para los demás.
    delete HTMLDialogElement.prototype.showModal;
    // @ts-expect-error -- lo mismo.
    delete HTMLDialogElement.prototype.close;
  });
});

describe('cómo se vuelve a encontrar lo que tenía el foco', () => {
  it('por su marca, por su id, o no se puede', () => {
    const marcado = document.createElement('button');
    marcado.dataset['recorrido'] = 'volver';
    const conId = document.createElement('input');
    conId.id = 'a"b';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    expect(selectorDe(marcado)).toBe('[data-recorrido="volver"]');
    expect(selectorDe(conId)).toBe('[id="a\\"b"]');
    expect(selectorDe(document.createElement('div'))).toBeNull();
    expect(selectorDe(document.body)).toBeNull();
    expect(selectorDe(svg)).toBeNull();
    expect(selectorDe(null)).toBeNull();
  });
});
