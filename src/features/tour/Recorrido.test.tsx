// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAVE_RECORRIDO, guardarPasoDelRecorrido } from '@state/recorrido';

import { LanzadorDelRecorrido } from './Lanzador';

/**
 * La dirección, como un almacén: `usePathname` repinta cuando cambia, igual que
 * en Next.
 */
const navegacion = vi.hoisted(() => {
  let ruta = '/aprender';
  const oyentes = new Set<() => void>();
  return {
    ruta: () => ruta,
    poner: (nueva: string) => {
      ruta = nueva;
      oyentes.forEach((oyente) => oyente());
    },
    suscribir: (oyente: () => void) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    usePathname: () => useSyncExternalStore(navegacion.suscribir, navegacion.ruta),
  };
});

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

/** Con la bienvenida ya vista, que es lo que deja salir el tramo de cada pantalla. */
function conLaBienvenidaVista(paso: string | null = null): void {
  guardarPasoDelRecorrido({ vistos: ['bienvenida'], paso });
}

/**
 * La pieza de cada paso, donde el test no ha puesto la suya. Sin pieza, la
 * tarjeta espera a que llegue antes de pintarse.
 */
const PIEZAS: ReadonlyArray<readonly [string, string]> = [
  ['nav[aria-label="Pantallas"]', '<nav aria-label="Pantallas"></nav>'],
  ['[data-tour="aprender-hoy"]', '<div data-tour="aprender-hoy"></div>'],
  ['[data-tour="afinar-afinador"]', '<div data-tour="afinar-afinador"></div>'],
  ['[data-tour="componer-empezar"]', '<div data-tour="componer-empezar"></div>'],
  ['[data-tour="componer-espacios"]', '<div data-tour="componer-espacios"></div>'],
];

async function abrir(nombre: string | RegExp = /./): Promise<HTMLElement> {
  for (const [selector, html] of PIEZAS) {
    if (document.querySelector(selector) === null) {
      pieza(html);
    }
  }
  render(<LanzadorDelRecorrido />);
  return screen.findByRole('dialog', { name: nombre });
}

/**
 * jsdom no trae `ResizeObserver`. Este apunta qué se observa y deja avisar a
 * mano, que es lo que hace el navegador cuando algo cambia de tamaño.
 */
const observados = vi.hoisted(() => ({ cajas: new Set<Element>(), avisar: () => {} }));
class ObservadorDeMentira {
  constructor(avisar: () => void) {
    observados.avisar = avisar;
  }
  observe(caja: Element): void {
    observados.cajas.add(caja);
  }
  disconnect(): void {
    observados.cajas.clear();
  }
}

/** El aro, si está. */
function aro(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-aro-del-recorrido]');
}

beforeEach(() => {
  localStorage.clear();
  navegacion.poner('/aprender');
  vi.stubGlobal('ResizeObserver', ObservadorDeMentira);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('cuándo sale', () => {
  /**
   * **La primera vez, la bienvenida y nada más**, en un paso. Eran veintiuno
   * seguidos en un diálogo modal: «Bienvenida · 1 de 21» tapando la pantalla
   * antes de haber visto nada (adr/0108).
   */
  it('la primera vez, la bienvenida en un solo paso, que dice dónde retomarlo', async () => {
    navegacion.poner('/profesor');
    const dialogo = await abrir('Bienvenido a Caos ordenado');

    expect(dialogo).toHaveAccessibleDescription(/si lo saltas, lo retomas desde Aprender/);
    expect(screen.getByText('Recorrido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeInTheDocument();
  });

  /**
   * **No bloquea**: no es modal y no se lleva el foco. Lo de detrás sigue vivo,
   * y quien estaba escribiendo no pierde el sitio.
   */
  it('no se lleva el foco ni deja la pantalla inerte', async () => {
    // jsdom no trae `show`; el navegador sí, y es el que abre sin modal.
    const show = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'show', { value: show, configurable: true });
    const fuera = pieza('<button type="button">Algo de la pantalla</button>');
    fuera.focus();

    try {
      await abrir('Bienvenido a Caos ordenado');

      expect(show).toHaveBeenCalled();
      expect(fuera).toHaveFocus();
      expect(fuera.closest('[inert]')).toBeNull();
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'show');
    }
  });

  it.each(['/olvidada', '/planes/estudio'])('no interrumpe un trámite: en %s no sale', (ruta) => {
    navegacion.poner(ruta);
    const { container } = render(<LanzadorDelRecorrido />);
    expect(container).toBeEmptyDOMElement();
    expect(guardado()).toBeNull();
  });

  it('quien ya lo ha visto no lo descarga', () => {
    localStorage.setItem(CLAVE_RECORRIDO, 'visto');
    const { container } = render(<LanzadorDelRecorrido />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * **La bienvenida y el de la pantalla, en la misma tarjeta.** Iban por
   * separado, y en `/afinar` salían dos tarjetas seguidas que decían las dos
   * «paso 1 de 1» (adr/0120).
   */
  it('la primera vez en una pantalla con tramo, los dos en la misma tarjeta', async () => {
    navegacion.poner('/afinar');
    await abrir('Bienvenido a Caos ordenado');
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/^Recorrido, paso 1 de 2\. Bienvenido/)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('dialog', { name: 'Afinar, cuerda a cuerda' });
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(guardado()!)).toEqual({ vistos: ['bienvenida', 'afinar'], paso: null });
  });

  /** Cada pantalla, el suyo, al llegar: no todos de golpe. */
  it('después de la bienvenida, el tramo de la pantalla en la que se está', async () => {
    conLaBienvenidaVista();
    await abrir('Por dónde seguir');

    expect(screen.queryByRole('heading', { name: /Tu canción/ })).not.toBeInTheDocument();
  });

  it('en una pantalla sin tramo no sale nada', () => {
    conLaBienvenidaVista();
    navegacion.poner('/profesor');
    const { container } = render(<LanzadorDelRecorrido />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('moverse por él', () => {
  it('«Siguiente» y «Anterior» dentro del tramo, y cada paso se anuncia con lo que señala', async () => {
    conLaBienvenidaVista();
    navegacion.poner('/componer');
    pieza('<div data-tour="componer-empezar"></div>', 10, 300);
    pieza('<div data-tour="componer-espacios"></div>', 200, 0);
    await abrir('Tu canción, acorde a acorde');
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    // El primero también se anuncia: sin modal, nadie lee la tarjeta al abrirse.
    await waitFor(() =>
      expect(screen.getByText(/^Recorrido, paso 1 de 2\. Tu canción/)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Tres maneras de escribirla' });
    await waitFor(() =>
      expect(screen.getByText(/^Recorrido, paso 2 de 2\./)).toHaveTextContent(
        'Señalado: los tres espacios de trabajo.',
      ),
    );
    expect(dialogo).toHaveAccessibleDescription(/Señalado: los tres espacios de trabajo/);

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await screen.findByRole('heading', { name: 'Tu canción, acorde a acorde' });
  });

  /** Recargar a mitad sigue donde se iba. */
  it('sigue por el paso guardado', async () => {
    conLaBienvenidaVista('componer-espacios');
    navegacion.poner('/componer');
    await abrir('Tres maneras de escribirla');
  });

  /** Componer escucha `1`, `2` y `3` en la ventana: no pueden cambiar de espacio por debajo. */
  it('las teclas pulsadas en la tarjeta no salen de ella', async () => {
    const enLaVentana = vi.fn();
    window.addEventListener('keydown', enLaVentana);
    const dialogo = await abrir();

    fireEvent.keyDown(dialogo, { key: '2' });

    expect(enLaVentana).not.toHaveBeenCalled();
    window.removeEventListener('keydown', enLaVentana);
  });
});

describe('acabar', () => {
  it('«Entendido» da el tramo por visto, y el de otra pantalla sale al llegar a ella', async () => {
    navegacion.poner('/profesor');
    await abrir('Bienvenido a Caos ordenado');

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(guardado()!)).toEqual({ vistos: ['bienvenida'], paso: null });

    navegacion.poner('/aprender');
    await screen.findByRole('dialog', { name: 'Por dónde seguir' });
  });

  it('Escape con el foco dentro cierra el tramo', async () => {
    conLaBienvenidaVista();
    const dialogo = await abrir('Por dónde seguir');

    fireEvent.keyDown(dialogo, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(guardado()!)).toEqual({ vistos: ['bienvenida', 'aprender'], paso: null });
  });

  it('con todos los tramos vistos, el recorrido entero queda visto', async () => {
    guardarPasoDelRecorrido({ vistos: ['bienvenida', 'aprender', 'componer'], paso: null });
    navegacion.poner('/afinar');
    await abrir('Afinar, cuerda a cuerda');

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await waitFor(() => expect(guardado()).toBe('visto'));
  });

  /** Un clic y no sale más, en ninguna pantalla. */
  it('«Saltar el recorrido» lo da por visto entero', async () => {
    await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(guardado()).toBe('visto');
  });
});

describe('señalar la pieza', () => {
  it('pone el aro alrededor de la pieza, y la tarjeta al lado', async () => {
    pieza('<nav aria-label="Pantallas"></nav>', 200, 0);
    const dialogo = await abrir();

    await waitFor(() => expect(aro()).not.toBeNull());
    // La caja de la pieza con el aire de alrededor (`cajaIluminada`), movida con
    // `transform`, que no cuenta como desplazamiento de la página.
    expect(aro()!.style.transform).toBe('translate(194px, 0px)');
    expect(dialogo.style.transform).toMatch(/^translate\(/);
    expect(dialogo.style.visibility).toBe('');
  });

  /**
   * **La primera vez se pone, no se desliza**: deslizarla desde la esquina era
   * un desplazamiento de la página en cada fotograma. Lo que ya estaba puesto sí
   * se desliza al pasar de un paso a otro.
   */
  it('se coloca sin transición, y se desliza solo lo que ya estaba puesto', async () => {
    conLaBienvenidaVista();
    navegacion.poner('/componer');
    pieza('<div data-tour="componer-empezar"></div>', 10, 300);
    pieza('<div data-tour="componer-espacios"></div>', 200, 0);
    const dialogo = await abrir('Tu canción, acorde a acorde');
    await waitFor(() => expect(aro()).not.toBeNull());
    expect(dialogo.className).not.toMatch(/transition/);
    expect(aro()!.className).not.toMatch(/transition/);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(aro()!.style.transform).toBe('translate(194px, 0px)'));
    expect(dialogo.className).toMatch(/motion-safe:transition-transform/);
    expect(aro()!.className).toMatch(/motion-safe:transition-\[transform,width,height\]/);
  });

  /** Lo que ninguna medida de tamaño avisa: se desplaza la caja de dentro. */
  it('vuelve a medir al desplazarse algo o cambiar de tamaño, y sigue a la pieza', async () => {
    const nav = pieza('<nav aria-label="Pantallas"></nav>', 200, 0);
    await abrir();
    await waitFor(() => expect(aro()).not.toBeNull());
    expect(observados.cajas).toContain(nav);

    conCaja(nav, 200, 100);
    // Dos avisos en el mismo fotograma son una sola medida.
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    await waitFor(() => expect(aro()!.style.transform).toBe('translate(194px, 94px)'));

    conCaja(nav, 300, 100);
    act(() => observados.avisar());
    await waitFor(() => expect(aro()!.style.transform).toBe('translate(294px, 94px)'));
  });

  /** El hueco de trabajo de la aplicación es donde puede ir la tarjeta. */
  it('coloca la tarjeta dentro del hueco de trabajo', async () => {
    conCaja(pieza('<main id="contenido"></main>'), 0, 60, 1024, 500);
    await abrir();

    const dialogo = screen.getByRole('dialog');
    await waitFor(() => expect(dialogo.style.transform).not.toBe(''));
    const [, y] = /translate\((-?\d+)px, (-?\d+)px\)/.exec(dialogo.style.transform)!.slice(1);
    expect(Number(y)).toBeGreaterThanOrEqual(60);
  });

  /**
   * La pantalla sigue viva, así que la pieza puede cambiar por otra: en componer,
   * elegir tonalidad quita los botones de salida y pone la lista de acordes.
   */
  it('sigue a la pieza aunque la pantalla la cambie por otra', async () => {
    conLaBienvenidaVista();
    navegacion.poner('/componer');
    const vieja = pieza('<div data-tour="componer-empezar"></div>', 10, 10);
    await abrir('Tu canción, acorde a acorde');
    await waitFor(() => expect(aro()!.style.transform).toBe('translate(4px, 4px)'));

    vieja.remove();
    const nueva = pieza('<div data-tour="componer-que-poner"></div>', 300, 10);

    await waitFor(() => expect(aro()!.style.transform).toBe('translate(294px, 4px)'));

    // Y si se va sin que llegue otra, se deja de señalar.
    nueva.remove();
    await waitFor(() => expect(aro()).toBeNull());
  });

  /**
   * Con la pieza quieta no se mira nada: se miraba cada cuarto de segundo
   * mientras la tarjeta estuviera abierta, se moviera algo o no. Ahora lo que
   * cambia lo avisa el navegador, y cumplido el plazo no queda ninguna espera.
   */
  it('con la pieza quieta no queda nada mirando cada poco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await abrir();
      await waitFor(() => expect(aro()).not.toBeNull());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Si la pieza no llega, el paso se enseña igual, sin señalar nada, hasta que llegue. */
  it('sin pieza a la vista, la tarjeta sale igual y sin aro, y la señala cuando llega', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      navegacion.poner('/profesor');
      render(<LanzadorDelRecorrido />);
      // Escondida no tiene nombre para quien no ve: se busca sin él.
      const dialogo = await screen.findByRole('dialog', { hidden: true });
      // Mientras espera a la pieza no se pinta: saldría en medio y luego saltaría.
      expect(dialogo.style.visibility).toBe('hidden');
      expect(document.querySelector('[aria-live]')).toBeEmptyDOMElement();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
      expect(dialogo.style.visibility).toBe('');
      expect(screen.getByRole('dialog', { name: /Bienvenido/ })).toBe(dialogo);
      expect(aro()).toBeNull();

      // Y si llega más tarde, se la encuentra y se señala.
      pieza('<nav aria-label="Pantallas"></nav>', 200, 0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await waitFor(() => expect(aro()).not.toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });
});
