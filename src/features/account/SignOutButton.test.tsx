// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Cuenta from '@state/account';

import { SignOutButton } from './SignOutButton';

const refrescar = vi.fn();
const signOutHere = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refrescar, push: () => {} }),
}));

vi.mock('@state/account', async (original) => ({
  ...(await original<typeof Cuenta>()),
  signOutHere: () => signOutHere(),
}));

/**
 * Salir de la cuenta.
 *
 * Lo que se prueba es el `refresh`, que es lo único que hay aquí que se puede
 * olvidar sin que nada falle: la cuenta la lee el layout **en el servidor**, así
 * que sin él la cookie ya está borrada y la pantalla sigue enseñando el plan de
 * antes. Nadie lo nota hasta que alguien sale y sigue viendo su nombre.
 */

beforeEach(() => {
  refrescar.mockReset();
  signOutHere.mockReset();
  signOutHere.mockResolvedValue(undefined);
});

describe('salir', () => {
  it('sale y pide al servidor que vuelva a pintar', async () => {
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole('button', { name: /Salir de la cuenta/ }));

    await waitFor(() => expect(refrescar).toHaveBeenCalled());
    expect(signOutHere).toHaveBeenCalled();
  });

  it('mientras sale, no se puede pulsar dos veces', async () => {
    let terminar: () => void = () => undefined;
    signOutHere.mockReturnValue(
      new Promise<void>((listo) => {
        terminar = listo;
      }),
    );
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button', { name: 'Saliendo…' })).toBeDisabled();
    terminar();
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });
});
