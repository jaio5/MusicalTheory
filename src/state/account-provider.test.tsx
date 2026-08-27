// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';

/**
 * El proveedor de la cuenta y el gancho que la lee.
 *
 * Tres cosas que no se ven leyendo y que aquí quedan fijadas:
 *
 * 1. **Fuera del proveedor no revienta**: devuelve la anónima. Así un componente
 *    se prueba suelto sin montar medio árbol, y una pantalla mal envuelta enseña
 *    candados en vez de quedarse en blanco.
 * 2. **Si el servidor vuelve a pintar con otra cuenta, gana la del servidor** —al
 *    entrar, al salir, al cambiar de plan—.
 * 3. **Sin red se queda lo que había**, que es más útil que vaciar la pantalla.
 */

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

const { AccountProvider, useAccount } = await import('./account');

const CUENTA: Account = { ...ANONYMOUS, email: 'a@b.c', name: 'Javi', plan: 'medio' };

/** Pinta lo que ve el gancho, y un botón para volver a pedirla. */
function Mirilla() {
  const { account, accounts, signedIn, planName, refresh } = useAccount();
  return (
    <div>
      <p data-testid="correo">{account.email ?? 'sin correo'}</p>
      <p data-testid="plan">{planName}</p>
      <p data-testid="dentro">{signedIn ? 'dentro' : 'fuera'}</p>
      <p data-testid="cuentas">{accounts ? 'hay' : 'no hay'}</p>
      <button onClick={() => void refresh()}>Volver a pedirla</button>
    </div>
  );
}

const fetchFalso = vi.fn();

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sin proveedor alrededor', () => {
  it('devuelve la anónima en vez de reventar', () => {
    render(<Mirilla />);

    expect(screen.getByTestId('correo')).toHaveTextContent('sin correo');
    expect(screen.getByTestId('dentro')).toHaveTextContent('fuera');
    expect(screen.getByTestId('cuentas')).toHaveTextContent('no hay');
  });
});

describe('con proveedor', () => {
  it('sirve la cuenta que le da el servidor, con su plan escrito', () => {
    render(
      <AccountProvider account={CUENTA} accounts>
        <Mirilla />
      </AccountProvider>,
    );

    expect(screen.getByTestId('correo')).toHaveTextContent('a@b.c');
    expect(screen.getByTestId('plan')).toHaveTextContent('Medio');
    expect(screen.getByTestId('dentro')).toHaveTextContent('dentro');
  });

  it('si el servidor vuelve a pintar con otra cuenta, gana la del servidor', async () => {
    // Pasa al entrar, al salir y al cambiar de plan: el servidor sabe más que lo
    // que este navegador tuviera guardado de antes.
    const { rerender } = render(
      <AccountProvider account={CUENTA} accounts>
        <Mirilla />
      </AccountProvider>,
    );

    rerender(
      <AccountProvider account={ANONYMOUS} accounts>
        <Mirilla />
      </AccountProvider>,
    );

    expect(screen.getByTestId('correo')).toHaveTextContent('sin correo');
  });

  it('volver a pedirla actualiza lo que se ve', async () => {
    // Lo usa el panel de IA después de cada petición: el cupo ha cambiado se haya
    // contestado o se haya rechazado.
    fetchFalso.mockResolvedValue(
      new Response(JSON.stringify({ account: { ...CUENTA, plan: 'pro' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <AccountProvider account={CUENTA} accounts>
        <Mirilla />
      </AccountProvider>,
    );

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByTestId('plan')).toHaveTextContent('Pro');
    });
    // Sin caché: pedirla otra vez es justo para no creerse la de antes.
    expect(fetchFalso).toHaveBeenCalledWith('/api/cuenta', { cache: 'no-store' });
  });

  it('sin red se queda lo que había', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));

    render(
      <AccountProvider account={CUENTA} accounts>
        <Mirilla />
      </AccountProvider>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('plan')).toHaveTextContent('Medio');
  });

  it('con una respuesta que no vale tampoco se borra nada', async () => {
    fetchFalso.mockResolvedValue(new Response('', { status: 500 }));

    render(
      <AccountProvider account={CUENTA} accounts>
        <Mirilla />
      </AccountProvider>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('correo')).toHaveTextContent('a@b.c');
  });
});
