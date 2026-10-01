// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EscenaPortada } from './EscenaPortada';

/**
 * La escena del encabezado.
 *
 * Lo que se prueba es lo que decide JavaScript: **si la escena se mueve**, que
 * pinta el atributo del que cuelgan las animaciones y la descarga de la hoja de
 * fotogramas; el botón de parar; y el puntero, que es lo único que se mueve
 * desde aquí. Lo que se mueve con CSS —los fotogramas, el scroll— no tiene nada
 * que probar en jsdom, que no pinta; eso se mira en un navegador.
 */

interface Preferencias {
  readonly reducido?: boolean;
  readonly punteroFino?: boolean;
}

/** Los avisos de cambio del movimiento reducido, para poder dispararlos. */
let avisosDeMovimiento: Array<() => void> = [];

function preferencias({ reducido = false, punteroFino = true }: Preferencias = {}) {
  let menos = reducido;
  avisosDeMovimiento = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta: string) => ({
      get matches() {
        return consulta.includes('reduced-motion') ? menos : punteroFino;
      },
      addEventListener: (_: string, avisar: () => void) => avisosDeMovimiento.push(avisar),
      removeEventListener: (_: string, avisar: () => void) => {
        avisosDeMovimiento = avisosDeMovimiento.filter((a) => a !== avisar);
      },
    })),
  );
  return {
    pedirMenos() {
      menos = true;
      act(() => avisosDeMovimiento.forEach((avisar) => avisar()));
    },
  };
}

/**
 * `requestAnimationFrame` a mano: el fotograma corre cuando el test lo dice, y
 * uno cancelado no corre, como en un navegador.
 */
let fotogramas = new Map<number, FrameRequestCallback>();
let siguiente = 0;

beforeEach(() => {
  fotogramas = new Map();
  siguiente = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((llamada: FrameRequestCallback) => {
      siguiente += 1;
      fotogramas.set(siguiente, llamada);
      return siguiente;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => fotogramas.delete(id)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function pintarFotogramas() {
  const pendientes = [...fotogramas.values()];
  fotogramas.clear();
  act(() => pendientes.forEach((llamada) => llamada(0)));
}

function escena(container: HTMLElement) {
  return container.querySelector('[data-escena]')!;
}

function escenario(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-escenario]')!;
}

/** El escenario centrado en una ventana de 1000×800, a 200×100 de la esquina. */
function colocar(container: HTMLElement) {
  vi.stubGlobal('innerWidth', 1000);
  vi.stubGlobal('innerHeight', 800);
  vi.spyOn(escenario(container), 'getBoundingClientRect').mockReturnValue({
    left: 400,
    top: 300,
    width: 200,
    height: 200,
  } as DOMRect);
}

describe('la escena de la portada', () => {
  it('en el servidor sale quieta y sin botón, que es lo que hidrata', () => {
    preferencias();

    const html = renderToString(<EscenaPortada />);

    expect(html).not.toContain('data-viva');
    expect(html).not.toContain('<button');
    // Lo quieto ya está entero: las tres capas y las tiras en su sitio.
    expect(html).toContain('escena-fondo');
    expect(html).toContain('data-tira="mascota"');
  });

  it('con movimiento aceptado se pone viva y se puede parar', () => {
    preferencias();

    const { container } = render(<EscenaPortada />);

    expect(escena(container)).toHaveAttribute('data-viva');
    expect(screen.getByRole('button', { name: 'Parar la escena' })).toBeInTheDocument();
  });

  it('con movimiento reducido se queda quieta, sin botón y sin pedir la hoja', () => {
    preferencias({ reducido: true });

    const { container } = render(<EscenaPortada />);

    expect(escena(container)).not.toHaveAttribute('data-viva');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('con el ahorro de datos puesto tampoco se mueve: la hoja no se baja', () => {
    preferencias();
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } });

    const { container } = render(<EscenaPortada />);

    expect(escena(container)).not.toHaveAttribute('data-viva');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('si se pide menos movimiento con la portada abierta, se para en el momento', () => {
    const sistema = preferencias();
    const { container } = render(<EscenaPortada />);
    expect(escena(container)).toHaveAttribute('data-viva');

    sistema.pedirMenos();

    expect(escena(container)).not.toHaveAttribute('data-viva');
  });

  it('sin matchMedia no revienta, y se queda en movimiento', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { container } = render(<EscenaPortada />);

    expect(escena(container)).toHaveAttribute('data-viva');
  });

  it('es adorno: el escenario no lo lee un lector de pantalla', () => {
    preferencias();

    const { container } = render(<EscenaPortada />);

    expect(escenario(container)).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * Un bucle que dura más de cinco segundos tiene que poder pararse (WCAG
   * 2.2.2), con un botón que se pulse con el dedo y que diga lo que va a hacer.
   */
  it('el botón para y vuelve a poner en marcha, y dice cuál toca', async () => {
    preferencias();
    const { container } = render(<EscenaPortada />);

    await userEvent.click(screen.getByRole('button', { name: 'Parar la escena' }));
    expect(escena(container)).toHaveAttribute('data-parada');

    const seguir = screen.getByRole('button', { name: 'Poner en marcha la escena' });
    expect(seguir.className).toContain('size-tap');
    await userEvent.click(seguir);
    expect(escena(container)).not.toHaveAttribute('data-parada');
  });

  /**
   * El puntero desplaza la pared a favor y lo de delante en contra, en píxeles
   * enteros del dibujo, y con un solo fotograma pendiente por muchos eventos que
   * lleguen.
   */
  it('con ratón, las capas siguen al puntero a píxel entero', () => {
    preferencias();
    const { container } = render(<EscenaPortada />);
    colocar(container);

    // Abajo a la derecha del todo: el centro está en (500, 400).
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 800 });
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 800 });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    pintarFotogramas();

    const estilo = escenario(container).style;
    expect(estilo.getPropertyValue('--fondo-x')).toBe('2');
    expect(estilo.getPropertyValue('--fondo-y')).toBe('1');
    expect(estilo.getPropertyValue('--frente-x')).toBe('-3');
    expect(estilo.getPropertyValue('--frente-y')).toBe('-2');

    // Muy fuera de la ventana no se pasa del tope, y en el centro vuelve a cero
    // —sin «-0»—.
    fireEvent.pointerMove(window, { clientX: -5000, clientY: 400 });
    pintarFotogramas();
    expect(estilo.getPropertyValue('--frente-x')).toBe('3');
    expect(estilo.getPropertyValue('--frente-y')).toBe('0');
    fireEvent.pointerMove(window, { clientX: 510, clientY: 410 });
    pintarFotogramas();
    expect(estilo.getPropertyValue('--fondo-x')).toBe('0');
    expect(estilo.getPropertyValue('--frente-x')).toBe('0');
  });

  it('parada, deja de seguir al puntero y las capas vuelven a su sitio', async () => {
    preferencias();
    const { container } = render(<EscenaPortada />);
    colocar(container);
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 800 });
    pintarFotogramas();

    await userEvent.click(screen.getByRole('button', { name: 'Parar la escena' }));

    const estilo = escenario(container).style;
    expect(estilo.getPropertyValue('--frente-x')).toBe('0');
    fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
    pintarFotogramas();
    expect(estilo.getPropertyValue('--frente-x')).toBe('0');
  });

  it('con el dedo no hay puntero que seguir', () => {
    preferencias({ punteroFino: false });
    render(<EscenaPortada />);

    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('con movimiento reducido tampoco', () => {
    preferencias({ reducido: true });
    render(<EscenaPortada />);

    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('al desmontar suelta el puntero y cancela el fotograma pendiente', () => {
    preferencias();
    const { unmount } = render(<EscenaPortada />);
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(window, { clientX: 20, clientY: 20 });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
