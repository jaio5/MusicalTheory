// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteAccountForm } from './DeleteAccountForm';

const borrar = vi.hoisted(() => vi.fn());
const cerrarSesion = vi.hoisted(() => vi.fn());

vi.mock('@state/account', () => ({ deleteAccount: borrar }));
vi.mock('next-auth/react', () => ({ signOut: cerrarSesion }));

/** Abre el formulario y rellena lo que haga falta. */
async function abrir() {
  await userEvent.click(screen.getByRole('button', { name: /Quiero borrar mi cuenta/ }));
}

describe('borrar la cuenta', () => {
  it('cerrado no enseña ningún campo: un botón rojo al final de los ajustes es un accidente', () => {
    render(<DeleteAccountForm />);

    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quiero borrar mi cuenta/ })).toBeInTheDocument();
  });

  it('dice qué se va con la cuenta, y no «todos tus datos»', async () => {
    render(<DeleteAccountForm />);
    await abrir();

    expect(screen.getByText(/tus canciones guardadas/i)).toBeInTheDocument();
    expect(screen.getByText(/tu avance/i)).toBeInTheDocument();
  });

  it('no deja borrar solo con la contraseña', async () => {
    // La contraseña se escribe de memoria y sin leer. Escribir la palabra es lo
    // que obliga a haber leído qué se pierde.
    render(<DeleteAccountForm />);
    await abrir();

    await userEvent.type(screen.getByLabelText('Tu contraseña'), 'la mia');

    expect(screen.getByRole('button', { name: /Borrar mi cuenta/ })).toBeDisabled();
  });

  it('no deja borrar solo con la palabra', async () => {
    render(<DeleteAccountForm />);
    await abrir();

    await userEvent.type(screen.getByLabelText(/Escribe/), 'borrar');

    expect(screen.getByRole('button', { name: /Borrar mi cuenta/ })).toBeDisabled();
  });

  it('con las dos cosas borra y cierra la sesión', async () => {
    borrar.mockResolvedValue({ ok: true });
    render(<DeleteAccountForm />);
    await abrir();

    await userEvent.type(screen.getByLabelText('Tu contraseña'), 'la mia');
    await userEvent.type(screen.getByLabelText(/Escribe/), 'BORRAR');
    await userEvent.click(screen.getByRole('button', { name: /Borrar mi cuenta/ }));

    expect(borrar).toHaveBeenCalledWith('la mia');
    // La cookie sigue firmada y viva: sin cerrarla, quien acaba de borrarse se
    // queda con una sesión que apunta a una fila que ya no existe.
    expect(cerrarSesion).toHaveBeenCalled();
  });

  it('si el servidor dice que no, se enseña su frase y no se cierra la sesión', async () => {
    borrar.mockResolvedValue({ ok: false, message: 'La contraseña no es esa.' });
    cerrarSesion.mockClear();
    render(<DeleteAccountForm />);
    await abrir();

    await userEvent.type(screen.getByLabelText('Tu contraseña'), 'otra');
    await userEvent.type(screen.getByLabelText(/Escribe/), 'borrar');
    await userEvent.click(screen.getByRole('button', { name: /Borrar mi cuenta/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña no es esa.');
    expect(cerrarSesion).not.toHaveBeenCalled();
  });

  it('«mejor no» lo cierra y olvida lo escrito', async () => {
    render(<DeleteAccountForm />);
    await abrir();
    await userEvent.type(screen.getByLabelText('Tu contraseña'), 'la mia');
    await userEvent.click(screen.getByRole('button', { name: /Mejor no/ }));
    await abrir();

    expect(screen.getByLabelText('Tu contraseña')).toHaveValue('');
  });
});
