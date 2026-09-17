// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import type * as Cuenta from '@state/account';
import { AccountProvider } from '@state/account';

import { RegisterScreen } from './RegisterScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/registro',
}));

const registerAccount = vi.fn();

vi.mock('@state/account', async (original) => ({
  ...(await original<typeof Cuenta>()),
  registerAccount: (...a: unknown[]) => registerAccount(...a),
}));

/**
 * Crear la cuenta.
 *
 * Dos cosas que se prueban aquí y que no se ven mirando el componente suelto:
 * que **a quien ya ha entrado no se le pinta el formulario** —un registro
 * delante de una sesión abierta es una invitación a crear una segunda cuenta sin
 * querer y perder el avance de la primera— y que se dice, en esta misma
 * pantalla, que sin cuenta la aplicación funciona entera. Eso es lo que evita que
 * parezca un muro.
 */

const DENTRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: 3,
  aiLeftMonth: 20,
};

function pintar(account: Account = ANONYMOUS, accounts = true) {
  return render(
    <AccountProvider account={account} accounts={accounts}>
      <RegisterScreen />
    </AccountProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  registerAccount.mockReset();
});

describe('Crear la cuenta', () => {
  it('enseña el formulario a quien no ha entrado', () => {
    pintar();

    expect(screen.getByRole('heading', { name: /Crear tu cuenta/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Crear la cuenta/)).toBeInTheDocument();
  });

  it('cuenta qué te da, y que sin cuenta funciona entera', () => {
    pintar();

    expect(screen.getByText(/Tu avance, en tu cuenta/)).toBeInTheDocument();
    expect(screen.getByText(/funciona/)).toBeInTheDocument();
  });

  it('sin cuentas configuradas no promete lo que esta copia no puede dar', () => {
    // Sin base de datos ni secreto nadie entra, y prometer que el avance viaja
    // al móvil sería mentira.
    pintar(ANONYMOUS, false);

    expect(screen.queryByText(/Tu avance, en tu cuenta/)).not.toBeInTheDocument();
  });

  it('a quien ya está dentro no le pinta el formulario', () => {
    pintar(DENTRO);

    expect(screen.getByRole('heading', { name: /Ya tienes cuenta/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Crear la cuenta/)).not.toBeInTheDocument();
  });

  it('y le ofrece las dos salidas que tienen sentido', () => {
    pintar(DENTRO);

    expect(screen.getByRole('link', { name: /Tu cuenta/ })).toHaveAttribute('href', '/cuenta');
    expect(screen.getByRole('link', { name: /Ir al camino/ })).toHaveAttribute('href', '/aprender');
  });

  /**
   * Acabar de crearla y llegar con la sesión puesta caen en la misma rama sin
   * formulario, y durante un tiempo dijeron lo mismo: «no hay nada que crear
   * aquí» justo después de pulsar «Crear la cuenta». Esto separa los dos.
   */
  it('recién creada, lo cuenta como un acierto y manda al camino', async () => {
    registerAccount.mockResolvedValue({ ok: true });
    // `refresh` relee la cuenta del servidor: es lo que enciende `signedIn` sin
    // recargar, y sin ello la pantalla se quedaría en el formulario.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ account: DENTRO }) })),
    );

    pintar();
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText(/Correo/), 'javier@example.com');
    await usuario.type(screen.getByLabelText(/Contraseña/), 'ContrasenaLarga123');
    await usuario.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Tu cuenta está lista/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /Empezar a aprender/ })).toHaveAttribute(
      'href',
      '/aprender',
    );
  });
});
