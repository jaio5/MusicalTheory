// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';
import { CLAVE_RECORRIDO } from '@state/recorrido';

import Marco from './layout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/afinar',
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

/**
 * El marco común, puesto una vez en el layout del grupo.
 *
 * Lo que importa es que **cambiar de página no lo vuelve a montar**: con el
 * marco dentro de cada `page.tsx`, navegar desmontaba la barra, se llevaba el
 * micro con ella y la dejaba encendida sobre un micro cerrado. Un layout de Next
 * conserva su árbol entre sus páginas; aquí se comprueba con lo que hace Next al
 * navegar, que es cambiarle los hijos.
 */
function pintar(pagina: React.ReactElement) {
  return (
    <AccountProvider account={ANONYMOUS} accounts={false}>
      <Marco>{pagina}</Marco>
    </AccountProvider>
  );
}

describe('el marco de las pantallas de trabajo', () => {
  // Lo de aquí es el marco; el recorrido de la primera visita va en su propio test.
  beforeEach(() => {
    localStorage.setItem(CLAVE_RECORRIDO, 'visto');
  });

  it('pone la barra alrededor de la página', () => {
    render(pintar(<h1>Afinar</h1>));

    expect(screen.getByRole('navigation', { name: 'Pantallas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Afinar' })).toBeInTheDocument();
  });

  it('y al cambiar de página la barra es la misma, no una nueva', () => {
    const { rerender } = render(pintar(<h1>Afinar</h1>));
    const barra = screen.getByRole('banner');

    rerender(pintar(<h1>Aprender</h1>));

    expect(screen.getByRole('heading', { name: 'Aprender' })).toBeInTheDocument();
    expect(screen.getByRole('banner'), 'el marco se ha vuelto a montar').toBe(barra);
  });
});

/**
 * El recorrido de la primera visita lo pone el marco, al lado de la barra: así
 * sale en cualquier pantalla de trabajo y no se desmonta al navegar.
 */
describe('la primera visita', () => {
  it('pone el recorrido encima de la pantalla', async () => {
    localStorage.clear();
    render(pintar(<h1>Afinar</h1>));

    expect(
      await screen.findByRole('dialog', { name: 'Bienvenido a Caos ordenado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pantallas' })).toBeInTheDocument();
  });
});
