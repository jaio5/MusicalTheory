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

async function abrir(nombre: string | RegExp = /./): Promise<HTMLElement> {
  render(<LanzadorDelRecorrido />);
  return screen.findByRole('dialog', { name: nombre });
}

beforeEach(() => {
  localStorage.clear();
  navegacion.poner('/aprender');
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('cuándo sale', () => {
  /**
   * **La primera vez, la bienvenida y nada más**, en un paso. Eran veintiuno
   * seguidos en un diálogo modal: «Bienvenida · 1 de 21» tapando la pantalla
   * antes de haber visto nada (adr/0108).
   */
  it('la primera vez, la bienvenida en un solo paso, que dice dónde retomarlo', async () => {
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
  it('«Entendido» da el tramo por visto, y no sale más en esta pantalla', async () => {
    await abrir('Bienvenido a Caos ordenado');

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    // En `/aprender`, al cerrar la bienvenida sale el de la pantalla.
    await screen.findByRole('dialog', { name: 'Por dónde seguir' });
    expect(JSON.parse(guardado()!)).toEqual({ vistos: ['bienvenida'], paso: null });
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
    await abrir();

    const aro = () => document.querySelector<HTMLElement>('[data-aro-del-recorrido]');
    await waitFor(() => expect(aro()).not.toBeNull());
    // La caja de la pieza con el aire de alrededor (`cajaIluminada`).
    expect(aro()!.style.left).toBe('194px');
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
    const aro = () => document.querySelector<HTMLElement>('[data-aro-del-recorrido]')!;
    await waitFor(() => expect(aro().style.left).toBe('4px'));

    vieja.remove();
    pieza('<div data-tour="componer-que-poner"></div>', 300, 10);

    await waitFor(() => expect(aro().style.left).toBe('294px'));
  });

  /** Si la pieza no llega, el paso se enseña igual, sin señalar nada, hasta que llegue. */
  it('sin pieza a la vista, la tarjeta sale igual y sin aro, y la señala cuando llega', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<LanzadorDelRecorrido />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
      expect(await screen.findByRole('dialog', { name: /Bienvenido/ })).toBeInTheDocument();
      expect(document.querySelector('[data-aro-del-recorrido]')).toBeNull();

      // Y si llega más tarde, se la encuentra y se señala.
      pieza('<nav aria-label="Pantallas"></nav>', 200, 0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await waitFor(() =>
        expect(document.querySelector('[data-aro-del-recorrido]')).not.toBeNull(),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
