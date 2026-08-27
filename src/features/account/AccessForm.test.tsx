// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import type * as Cuenta from '@state/account';
import { AccountProvider } from '@state/account';

import { AccessForm } from './AccessForm';

const refrescar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refrescar, push: () => {} }),
  usePathname: () => '/cuenta',
}));

const signInWithPassword = vi.fn();
const registerAccount = vi.fn();

vi.mock('@state/account', async (original) => ({
  ...(await original<typeof Cuenta>()),
  signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
  registerAccount: (...a: unknown[]) => registerAccount(...a),
}));

/**
 * Entrar o crear una cuenta, en el mismo formulario.
 *
 * En el mismo y con un interruptor arriba, no en dos pantallas: la mitad de las
 * veces uno no se acuerda de si ya tenía cuenta aquí, y mandarle a otra dirección
 * para descubrirlo es perder el sitio donde estaba. Lo que cambia según de dónde
 * vengas es cuál de los dos viene puesto.
 *
 * Lo que se prueba con más cuidado son **los `autoComplete`**: son los que el
 * navegador espera para ofrecer la contraseña guardada, y ponerlos mal es la
 * razón por la que algunos formularios no la ofrecen nunca. No se ve mirando la
 * pantalla, solo usándola durante meses.
 */

function pintar(props = {}, accounts = true) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={accounts}>
      <AccessForm {...props} />
    </AccountProvider>,
  );
}

beforeEach(() => {
  refrescar.mockReset();
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({ ok: true });
  registerAccount.mockReset();
  registerAccount.mockResolvedValue({ ok: true });
});

describe('sin cuentas configuradas', () => {
  it('se dice, y se dice que lo demás funciona igual', () => {
    pintar({}, false);

    expect(screen.getByText(/no tiene cuentas configuradas/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});

describe('cuál de los dos viene puesto', () => {
  it('por defecto, entrar', () => {
    pintar();

    expect(screen.getByRole('button', { name: 'Ya tengo cuenta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('en la pantalla de registro, crear', () => {
    pintar({ inicial: 'crear' });

    expect(screen.getByRole('button', { name: 'Crear una' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Crear la cuenta' })).toBeInTheDocument();
  });

  it('el interruptor sigue estando, porque uno no se acuerda', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));

    expect(screen.getByRole('button', { name: 'Crear la cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cómo te llamas/)).toBeInTheDocument();
  });
});

describe('lo que espera el navegador para ofrecer la contraseña guardada', () => {
  it('al entrar, la contraseña de siempre', () => {
    pintar();

    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('autocomplete', 'current-password');
  });

  it('al crear, una nueva: es lo que hace que la proponga', () => {
    pintar({ inicial: 'crear' });

    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('la contraseña es un campo de contraseña de verdad', () => {
    pintar();

    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('type', 'password');
  });
});

describe('entrar', () => {
  it('no se puede pulsar sin los dos campos', async () => {
    pintar();
    const entrar = screen.getByRole('button', { name: 'Entrar' });

    expect(entrar).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    expect(entrar).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'x');
    expect(entrar).toBeEnabled();
  });

  it('al crear, la contraseña corta no deja pulsar', async () => {
    // Es la misma regla que el servidor. Comprobarla aquí evita un viaje que
    // solo puede terminar en «es corta».
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'corta');

    expect(screen.getByRole('button', { name: 'Crear la cuenta' })).toBeDisabled();
  });

  it('al entrar se refrescan las dos cosas, y las dos hacen falta', async () => {
    // Sin la primera, el candado de al lado seguiría cerrado un instante; sin la
    // segunda, el avatar de arriba seguiría siendo el de nadie.
    const alTerminar = vi.fn();
    pintar({ onDone: alTerminar });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(refrescar).toHaveBeenCalled());
    expect(alTerminar).toHaveBeenCalled();
  });

  it('el error se anuncia, para quien no ve la pantalla', async () => {
    signInWithPassword.mockResolvedValue({ ok: false, message: 'El correo o la contraseña.' });
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const aviso = await screen.findByText('El correo o la contraseña.');
    expect(aviso).toHaveAttribute('aria-live', 'polite');
  });

  it('un fallo sin frase tiene una de respaldo', async () => {
    signInWithPassword.mockResolvedValue({ ok: false });
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/No ha salido/)).toBeInTheDocument();
  });

  it('cambiar de pestaña borra el error de la anterior', async () => {
    signInWithPassword.mockResolvedValue({ ok: false, message: 'No entras.' });
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('No entras.');
    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));

    expect(screen.queryByText('No entras.')).not.toBeInTheDocument();
  });
});

describe('crear la cuenta', () => {
  it('el nombre solo viaja si se ha puesto', async () => {
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    await waitFor(() => expect(registerAccount).toHaveBeenCalled());
    expect(registerAccount.mock.calls[0]![2]).toBeUndefined();
  });

  it('y si se pone, va', async () => {
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Cómo te llamas/), 'Javi');
    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    await waitFor(() => expect(registerAccount.mock.calls[0]![2]).toBe('Javi'));
  });
});

describe('la contraseña olvidada', () => {
  it('el enlace esta solo al entrar', async () => {
    // En el formulario de crear cuenta no hay contraseña que recuperar todavía,
    // y ofrecerlo ahí despista.
    pintar();

    expect(screen.getByRole('link', { name: /He olvidado mi contraseña/ })).toHaveAttribute(
      'href',
      '/olvidada',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));

    expect(screen.queryByRole('link', { name: /He olvidado/ })).not.toBeInTheDocument();
  });
});
