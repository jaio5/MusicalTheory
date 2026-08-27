// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import type * as Cuenta from '@state/account';
import { AccountProvider } from '@state/account';

import { NameForm } from './NameForm';

const updateAccount = vi.fn();

vi.mock('@state/account', async (original) => ({
  ...(await original<typeof Cuenta>()),
  updateAccount: (...a: unknown[]) => updateAccount(...a),
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

/**
 * Cómo quieres que te llamen.
 *
 * Es lo único que se puede cambiar de quién eres, y lo que se prueba aquí es lo
 * que se decidió a propósito: **vaciarlo es válido** y vuelve a la letra del
 * correo, porque nadie está obligado a decir su nombre para estudiar teoría. Un
 * campo obligatorio ahí sería pedir un dato que no hace falta para nada.
 */

const CUENTA: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: 3,
  aiLeftMonth: 20,
};

function pintar(account: Account = CUENTA) {
  return render(
    <AccountProvider account={account} accounts>
      <NameForm />
    </AccountProvider>,
  );
}

beforeEach(() => {
  updateAccount.mockReset();
  updateAccount.mockResolvedValue({ ok: true });
});

describe('el nombre', () => {
  it('viene puesto el que hay', () => {
    pintar();

    expect(screen.getByLabelText(/Cómo te llamas/)).toHaveValue('Javier');
  });

  it('sin nombre, se dice que se usara el correo', () => {
    pintar({ ...CUENTA, name: null });

    expect(screen.getByPlaceholderText(/se usa tu correo/)).toBeInTheDocument();
  });

  it('no se puede guardar lo que ya esta guardado', () => {
    pintar();

    expect(screen.getByRole('button', { name: /Guardar el nombre/ })).toBeDisabled();
  });

  it('al cambiarlo se guarda, y se dice', async () => {
    pintar();

    await userEvent.clear(screen.getByLabelText(/Cómo te llamas/));
    await userEvent.type(screen.getByLabelText(/Cómo te llamas/), 'Javi');
    await userEvent.click(screen.getByRole('button', { name: /Guardar el nombre/ }));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({ name: 'Javi' }));
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();
  });

  it('vaciarlo es valido: nadie esta obligado a decir su nombre', async () => {
    pintar();

    await userEvent.clear(screen.getByLabelText(/Cómo te llamas/));

    expect(screen.getByRole('button', { name: /Guardar el nombre/ })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /Guardar el nombre/ }));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({ name: '' }));
  });

  it('si no se puede guardar, se dice y no se canta victoria', async () => {
    updateAccount.mockResolvedValue({ ok: false, message: 'No hemos podido.' });
    pintar();

    await userEvent.type(screen.getByLabelText(/Cómo te llamas/), 'to');
    await userEvent.click(screen.getByRole('button', { name: /Guardar el nombre/ }));

    expect(await screen.findByText('No hemos podido.')).toBeInTheDocument();
    expect(screen.queryByText('Guardado.')).not.toBeInTheDocument();
  });

  it('al seguir escribiendo, el «guardado» se va', async () => {
    // Si se quedara, diría que está guardado lo que hay escrito ahora, que no lo
    // está.
    pintar();

    await userEvent.type(screen.getByLabelText(/Cómo te llamas/), 'to');
    await userEvent.click(screen.getByRole('button', { name: /Guardar el nombre/ }));
    await screen.findByText('Guardado.');

    await userEvent.type(screen.getByLabelText(/Cómo te llamas/), 'x');

    expect(screen.queryByText('Guardado.')).not.toBeInTheDocument();
  });

  it('si la cuenta cambia por debajo, gana la del servidor', () => {
    // Al refrescar o al entrar con otra: es lo mismo que hace el proveedor de la
    // cuenta con la suya.
    const { rerender } = pintar();

    rerender(
      <AccountProvider account={{ ...CUENTA, name: 'Otro' }} accounts>
        <NameForm />
      </AccountProvider>,
    );

    expect(screen.getByLabelText(/Cómo te llamas/)).toHaveValue('Otro');
  });
});
