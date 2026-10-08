// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';

import { AppShell } from './AppShell';

const ruta = vi.fn(() => '/aprender');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => ruta(),
}));

/**
 * El `Link` de Next, con lo que se le pide de precarga a la vista: en jsdom no
 * precarga nada, y lo que se prueba es cuándo se le pide.
 */
vi.mock('next/link', async () => {
  const { forwardRef } = await import('react');
  return {
    default: forwardRef<HTMLAnchorElement, Record<string, unknown>>(function Enlace(
      { href, prefetch, children, ...resto },
      ref,
    ) {
      return (
        <a ref={ref} href={String(href)} data-precarga={String(prefetch)} {...resto}>
          {children as React.ReactNode}
        </a>
      );
    }),
  };
});

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

/**
 * El marco de la aplicación.
 *
 * Dos cosas que solo se ven montándolo entero:
 *
 * **La navegación está dos veces** —arriba en pantalla grande, abajo en el móvil,
 * donde llega el pulgar— y cada una va en su propio `nav` con su propio nombre,
 * para que un lector de pantalla no anuncie la misma lista dos veces.
 *
 * **La pantalla actual sigue marcada dentro de sus partes**: comparar la dirección
 * entera dejaría «Aprender» apagado mientras se hace una unidad, que es justo
 * cuando más falta hace saber dónde estás.
 *
 * Y el reconocimiento de acordes se enciende solo en componer: analizar el
 * espectro en el afinador sería gastar batería por gusto.
 */

function pintar(pathname = '/aprender') {
  ruta.mockReturnValue(pathname);
  return render(
    <AccountProvider account={ANONYMOUS} accounts={false}>
      <AppShell>
        <p>El contenido</p>
      </AppShell>
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

/**
 * Las pantallas se generan en cada petición y Next no las precarga solas: cada
 * clic en la barra esperaba al servidor. Se precargan al ir a pulsarlas, no al
 * verse, que con la barra siempre a la vista era descargar las cuatro.
 */
describe('la precarga de las pantallas', () => {
  it('no precarga al verse, sino al ir a pulsar: puntero, dedo o foco', () => {
    pintar('/afinar');
    const abajo = within(screen.getByRole('navigation', { name: 'Pantallas, abajo' }));
    const enlaces = ['Aprender', 'Profesor', 'Componer'].map((nombre) =>
      abajo.getByRole('link', { name: nombre }),
    );
    expect(enlaces.map((enlace) => enlace.dataset['precarga'])).toEqual([
      'false',
      'false',
      'false',
    ]);

    fireEvent.pointerEnter(enlaces[0]!);
    fireEvent.touchStart(enlaces[1]!);
    fireEvent.focus(enlaces[2]!);

    expect(enlaces.map((enlace) => enlace.dataset['precarga'])).toEqual(['true', 'true', 'true']);
  });
});

describe('el marco', () => {
  it('pinta lo que le metan dentro', () => {
    pintar();

    expect(screen.getByText('El contenido')).toBeInTheDocument();
  });

  it('tiene el boton de escuchar, el tema y la vuelta a la portada', () => {
    pintar();

    expect(screen.getByRole('button', { name: /Escuchar la guitarra/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cambiar al tema/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Caos ordenado' })).toHaveAttribute('href', '/');
  });

  /**
   * A 390 con la cuenta configurada la barra se pasaba por trece píxeles, y el
   * marco recorta: el botón de la cuenta dejaba de existir. Sin base de datos
   * no se pinta, así que se cuenta aquí: por debajo de `sm` la marca va sin
   * margen y con la letra a 14, los huecos a 6, y el nombre se calla a 22,5 rem
   * de caja —lo que pide esa cuenta— y no a 22,25. Y si aun así no cabe —la
   * letra del navegador al doble—, la barra envuelve en vez de recortar.
   */
  it('a 390 deja sitio al boton de la cuenta, y si no cabe envuelve', () => {
    pintar();

    const nombre = screen.getByText('Caos ordenado');
    const marca = nombre.closest('a')!;
    expect(nombre).toHaveClass('text-sm', 'sm:text-base', '@max-[22.5rem]:sr-only');
    expect(marca).toHaveClass('gap-1.5', 'sm:gap-2', 'sm:mr-1');
    expect(marca).not.toHaveClass('mr-1');
    expect(screen.getByRole('button', { name: /Cambiar al tema/ }).parentElement).toHaveClass(
      'gap-1.5',
      'sm:gap-3',
    );
    expect(nombre.closest('header')).toHaveClass('flex-wrap');
  });
});

/**
 * La barra con el micro abierto.
 *
 * A 390, durante una toma, la pastilla del micro se metía debajo del botón del
 * tema. Lo que cabe lo mide la sonda del skill `arrancar` en un navegador; aquí se
 * fija la regla, que jsdom no sabe medir: **el nombre de la marca se calla cuando
 * la barra lleva la pastilla dentro**, y lo pregunta a la pastilla y no a un
 * estado copiado.
 */
describe('la barra con el micro abierto', () => {
  it('el nombre de la marca se calla mientras hay pastilla, y se sigue leyendo', () => {
    pintar('/componer');

    const nombre = screen.getByText('Caos ordenado');
    const barra = nombre.closest('header');
    expect(barra).toHaveClass('group/barra', '@container');
    expect(nombre).toHaveClass('@max-[67rem]:group-has-data-lectura/barra:sr-only');
    // Callado a la vista: el enlace sigue llamándose así para quien no ve.
    expect(screen.getByRole('link', { name: 'Caos ordenado' })).toBeInTheDocument();
  });
});

describe('la navegacion', () => {
  it('esta dos veces, y cada una se anuncia distinto', () => {
    pintar();

    expect(screen.getByRole('navigation', { name: 'Pantallas' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pantallas, abajo' })).toBeInTheDocument();
  });

  it('lleva las cuatro pantallas, en las dos', () => {
    pintar();

    for (const nav of screen.getAllByRole('navigation')) {
      const nombres = within(nav)
        .getAllByRole('link')
        .map((enlace) => enlace.textContent);
      expect(nombres).toEqual(['Aprender', 'Profesor', 'Componer', 'Afinar']);
    }
  });

  it('marca en cual estas', () => {
    pintar('/componer');

    const arriba = within(screen.getByRole('navigation', { name: 'Pantallas' }));
    expect(arriba.getByRole('link', { name: 'Componer' })).toHaveAttribute('aria-current', 'page');
    expect(arriba.getByRole('link', { name: 'Aprender' })).not.toHaveAttribute('aria-current');
  });

  it('y sigue marcada dentro de sus partes', () => {
    // Mientras se hace una unidad es cuando más falta hace saber dónde estás.
    pintar('/aprender/e1-grados');

    const arriba = within(screen.getByRole('navigation', { name: 'Pantallas' }));
    expect(arriba.getByRole('link', { name: 'Aprender' })).toHaveAttribute('aria-current', 'page');
  });

  it('una direccion que solo empieza igual no cuenta', () => {
    // `/aprendera-tocar` no está dentro de `/aprender`.
    pintar('/aprendermas');

    const arriba = within(screen.getByRole('navigation', { name: 'Pantallas' }));
    expect(arriba.getByRole('link', { name: 'Aprender' })).not.toHaveAttribute('aria-current');
  });

  it('en la portada no hay ninguna marcada', () => {
    pintar('/');

    for (const enlace of screen.getAllByRole('link')) {
      expect(enlace).not.toHaveAttribute('aria-current');
    }
  });
});
