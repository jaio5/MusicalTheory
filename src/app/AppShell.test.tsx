// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';

import { AppShell } from './AppShell';

const ruta = vi.fn(() => '/aprender');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => ruta(),
}));

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
