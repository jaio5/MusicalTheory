// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
      <p data-testid="hoy">{account.aiLeftToday ?? 'no se sabe'}</p>
      <p data-testid="mes">{account.aiLeftMonth ?? 'no se sabe'}</p>
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

  // Y volver a pedirla no hace nada ni revienta: no hay a quién pedírsela.
  it('volver a pedirla no llama a nadie', async () => {
    render(<Mirilla />);

    await userEvent.click(screen.getByRole('button'));

    expect(fetchFalso).not.toHaveBeenCalled();
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
      new Response(JSON.stringify({ account: { ...CUENTA, plan: 'basico' } }), {
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
      expect(screen.getByTestId('plan')).toHaveTextContent('Básico');
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

describe('lo que contesta el servidor, leido con cuidado', () => {
  /**
   * `/api/cuenta` es lo que el navegador cree de sí mismo, y lo que no encaje se
   * lee como anónimo: un cupo que no es un número o un plan que ya no existe no
   * pueden dejar la pantalla enseñando cosas que no son.
   */
  async function volverAPedirla(account: unknown) {
    fetchFalso.mockResolvedValue(
      new Response(JSON.stringify({ account }), {
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
  }

  it('una cuenta que no es un objeto se lee como anonima', async () => {
    await volverAPedirla('javier');

    await waitFor(() => expect(screen.getByTestId('correo')).toHaveTextContent('sin correo'));
  });

  it('un nombre en blanco o un plan inventado caen a lo de siempre', async () => {
    await volverAPedirla({ email: 'a@b.c', name: '', plan: 'inventado', aiModel: '' });

    await waitFor(() => expect(screen.getByTestId('plan')).toHaveTextContent('Gratis'));
    expect(screen.getByTestId('correo')).toHaveTextContent('a@b.c');
  });

  /**
   * Y los cupos: un número se redondea hacia abajo y no baja de cero, y lo que
   * no sea un número es «no se sabe» —que no es lo mismo que cero—.
   */
  it('los cupos se leen con cuidado', async () => {
    await volverAPedirla({ plan: 'medio', aiLeftToday: 3.7, aiLeftMonth: -5 });

    await waitFor(() => expect(screen.getByTestId('hoy')).toHaveTextContent('3'));
    expect(screen.getByTestId('mes')).toHaveTextContent('0');

    cleanup();
    await volverAPedirla({ plan: 'medio', aiLeftToday: 'muchas' });

    await waitFor(() => expect(screen.getByTestId('hoy')).toHaveTextContent('no se sabe'));
  });

  // Y un correo que no es texto es no tener correo.
  it('un correo que no es texto es no tener correo', async () => {
    await volverAPedirla({ email: 42, plan: 'medio' });

    await waitFor(() => expect(screen.getByTestId('correo')).toHaveTextContent('sin correo'));
  });
});
