// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
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

  // Y si el servidor contesta sin frase, la de aquí: nunca se queda mudo.
  it('sin frase del servidor, la de casa', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({}));
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/le hemos mandado un enlace/);
  });

  /**
   * La burbuja de `type="email"` la escribe el navegador **en su idioma**, así
   * que el correo se comprueba aquí y se dice con el `Aviso`, que es donde esta
   * pantalla cuenta todo lo demás.
   */
  it('un correo que no lo parece se dice aqui, y no se manda nada', async () => {
    const request = vi.fn();
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@sin-arroba');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    expect(request).not.toHaveBeenCalled();
    expect(await screen.findByText(/no tiene buena pinta/)).toBeInTheDocument();
  });

  /**
   * **Sin correo, se dice que falta.** El botón nacía apagado, y un botón gris no
   * dice qué le pasa: quien no ve la pantalla oía «no disponible» y nada más.
   */
  it('sin correo escrito se puede pulsar, y dice que falta', async () => {
    const request = vi.fn();
    render(<ForgottenForm request={request} />);

    const boton = screen.getByRole('button', { name: /Mandarme el enlace/ });
    expect(boton).toBeEnabled();
    await userEvent.click(boton);

    expect(request).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta el correo.');
  });

  // Mientras pide, el botón no se apaga: apagado soltaba el foco al `<body>`.
  it('mientras pide, el boton se queda con el foco y no pide dos veces', async () => {
    const request = vi.fn(() => new Promise<Response>(() => {}));
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));
    const boton = await screen.findByRole('button', { name: /Un momento/ });
    await userEvent.click(boton);

    expect(boton).toHaveFocus();
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(request).toHaveBeenCalledTimes(1);
  });

  /**
   * **Y al terminar, el foco va a lo que ha pasado.** El botón que se pulsó
   * desaparece con el formulario, y el foco caía al `<body>`: el lector de
   * pantalla se callaba y el tabulador volvía a empezar por la cabecera.
   */
  it('al mandarlo, el foco va al aviso que sustituye al formulario', async () => {
    const request = vi.fn().mockResolvedValue(respondWith({ message: 'Si ese correo…' }));
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    const aviso = (await screen.findByRole('status')).parentElement!;
    expect(aviso).toHaveFocus();
    expect(aviso).toHaveAttribute('tabindex', '-1');
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

  /**
   * **El vale sale de la barra de direcciones en cuanto se lee.** Con él dentro,
   * la dirección se quedaba en el historial y en las pestañas sincronizadas: una
   * llave de la cuenta durante una hora. Lo demás de la dirección se queda.
   */
  it('quita el vale de la dirección y deja lo demás', () => {
    window.history.replaceState(null, '', `/olvidada?vale=${VALE}&desde=correo#arriba`);

    render(<ForgottenForm vale={VALE} request={vi.fn()} />);

    expect(window.location.search).toBe('?desde=correo');
    expect(window.location.hash).toBe('#arriba');
    expect(window.location.pathname).toBe('/olvidada');
  });

  it('sin vale en la dirección no toca el historial', () => {
    window.history.replaceState(null, '', '/olvidada');
    const replace = vi.spyOn(window.history, 'replaceState');

    render(<ForgottenForm vale={VALE} request={vi.fn()} />);
    render(<ForgottenForm request={vi.fn()} />);

    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });

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

  it('no manda si las dos no coinciden, y lo dice', async () => {
    const request = vi.fn();
    render(<ForgottenForm vale={VALE} request={request} />);

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'contraseñalarga');
    await userEvent.type(screen.getByLabelText(/Otra vez/), 'otracosa');

    expect(screen.getByText('Las dos no son la misma.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Poner esta contraseña/ }));

    expect(request).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/no son la misma/);
  });

  it('no manda una contraseña corta, y dice el minimo', async () => {
    const request = vi.fn();
    render(<ForgottenForm vale={VALE} request={request} />);

    await userEvent.click(screen.getByRole('button', { name: /Poner esta contraseña/ }));

    expect(request).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos \d+ caracteres/);
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

describe('sin red', () => {
  /**
   * Las dos mitades del trámite tienen su propia frase, y las dos hacen falta:
   * una red caída al pedir el enlace y una al ponerlo se arreglan igual
   * —reintentar— pero decir «no hemos podido cambiar la contraseña» cuando lo
   * que falló fue pedir el correo manda a buscar el problema donde no está.
   */
  it('pedir el enlace y no poder se dice', async () => {
    const request = vi.fn().mockRejectedValue(new Error('sin red'));
    render(<ForgottenForm request={request} />);

    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    expect(await screen.findByText(/No hemos podido mandar el correo/)).toBeInTheDocument();
  });

  it('poner la contraseña nueva y no poder, también', async () => {
    const request = vi.fn().mockRejectedValue(new Error('sin red'));
    render(<ForgottenForm vale="unvale" request={request} />);

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'contraseñalarga');
    await userEvent.type(screen.getByLabelText(/Otra vez/), 'contraseñalarga');
    await userEvent.click(screen.getByRole('button', { name: /Poner esta contraseña/ }));

    expect(await screen.findByText(/No hemos podido cambiar la contraseña/)).toBeInTheDocument();
  });
});

describe('sin fabrica de peticion', () => {
  /**
   * Se llama a `/api/cuenta/olvidada`, que es lo que hace en la aplicación: la
   * dirección y la cabecera son parte del contrato con el servidor.
   */
  it('pide a /api/cuenta/olvidada con json', async () => {
    const pedidas: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      pedidas.push({ url, init });
      return respondWith({ message: 'Si ese correo…' });
    });

    render(<ForgottenForm />);
    await userEvent.type(screen.getByLabelText('Tu correo'), 'javier@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/ }));

    await waitFor(() => expect(pedidas).toHaveLength(1));
    expect(pedidas[0]!.url).toBe('/api/cuenta/olvidada');
    expect(pedidas[0]!.init.headers).toEqual({ 'Content-Type': 'application/json' });
    vi.unstubAllGlobals();
  });
});
