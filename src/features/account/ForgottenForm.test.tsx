// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ForgottenForm } from './ForgottenForm';

function respondWith(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('pedir el enlace', () => {
  it('manda el correo escrito', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ message: 'Si ese correo…' }));
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    expect(request).toHaveBeenCalledTimes(1);
    const [init] = request.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'javier@example.com' });
  });

  it('enseña la frase del servidor, que es la misma exista o no la cuenta', async () => {
    // Contestar distinto convertiría esto en un buscador de quién tiene cuenta.
    const request = vi
      .fn()
      .mockResolvedValue(respondWith({ message: 'Si ese correo tiene cuenta, le hemos mandado…' }));
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'nadie@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Si ese correo tiene cuenta/);
  });

  it('sin correo escrito no se puede pedir', () => {
    render(<ForgottenForm request={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Mandarme el enlace/ })).toBeDisabled();
  });

  it('sin proveedor de correo se dice, en vez de dejar esperando', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        respondWith({ error: { code: 'sin-correo', message: 'Esta copia no manda correo.' } }, 501),
      );
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta copia no manda correo.');
  });
});

describe('poner la contraseña nueva', () => {
  const VALE = 'un-vale-de-prueba';

  it('con vale pide la contraseña, no el correo', () => {
    render(<ForgottenForm vale={VALE} request={vi.fn()} />);

    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu correo')).not.toBeInTheDocument();
  });

  it('manda el vale con la contraseña', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ cambiada: true }));
    render(<ForgottenForm vale={VALE} request={request} />);

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'contraseñalarga');
    await userEvent.type(screen.getByLabelText(/Otra vez/), 'contraseñalarga');
    await userEvent.click(screen.getByRole('button', { name: /Poner esta contraseña/ }));

    const [init] = request.mock.calls[0]!;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ vale: VALE, password: 'contraseñalarga' });
  });

  it('no deja mandar si las dos no coinciden', async () => {
    render(<ForgottenForm vale={VALE} request={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'contraseñalarga');
    await userEvent.type(screen.getByLabelText(/Otra vez/), 'otracosa');

    expect(screen.getByText('Las dos no son la misma.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poner esta contraseña/ })).toBeDisabled();
  });

  it('avisa de que las demás sesiones se han cerrado', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ cambiada: true }));
    render(<ForgottenForm vale={VALE} request={request} />);

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'contraseñalarga');
    await userEvent.type(screen.getByLabelText(/Otra vez/), 'contraseñalarga');
    await userEvent.click(screen.getByRole('button', { name: /Poner esta contraseña/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Contraseña cambiada/);
    expect(screen.getByText(/se han cerrado/)).toBeInTheDocument();
  });

  it('un vale caducado se explica y dice qué hacer', async () => {
    const request = vi.fn().mockResolvedValue(
      respondWith(
        {
          error: {
            code: 'vale-no-vale',
            message: 'Ese enlace ya no sirve: o ha caducado, o ya se usó.',
          },
        },
        400,
      ),
    );
    render(<ForgottenForm vale={VALE} request={request} />);

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'contraseñalarga');
    await userEvent.type(screen.getByLabelText(/Otra vez/), 'contraseñalarga');
    await userEvent.click(screen.getByRole('button', { name: /Poner esta contraseña/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no sirve/);
  });
});
