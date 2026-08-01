// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { PasswordForm } from './PasswordForm';

const DENTRO: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: 3,
  aiLeftMonth: 3,
};

function pintar() {
  return render(
    <AccountProvider account={DENTRO} accounts>
      <PasswordForm />
    </AccountProvider>,
  );
}

// Tipado como el `fetch` de verdad para poder leer después con qué se llamó sin
// castings: lo que se comprueba de esta pantalla es justo eso.
function responder(payload: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function escribir(actual: string, nueva: string, repetida: string) {
  await userEvent.type(screen.getByLabelText(/la de ahora/i), actual);
  // «Otra vez la nueva» también contiene «la nueva»: se busca por el mínimo, que
  // solo lo dice el campo de la contraseña nueva.
  await userEvent.type(screen.getByLabelText(/mínimo/i), nueva);
  await userEvent.type(screen.getByLabelText(/otra vez/i), repetida);
}

describe('Cambiar la contraseña', () => {
  it('manda la de ahora junto a la nueva', async () => {
    const fetchMock = responder({ account: { ...DENTRO } });
    vi.stubGlobal('fetch', fetchMock);
    pintar();

    await escribir('la-de-siempre', 'una-nueva-larga', 'una-nueva-larga');
    await userEvent.click(screen.getByRole('button', { name: /cambiar la contraseña/i }));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cuenta');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      passwordActual: 'la-de-siempre',
      passwordNueva: 'una-nueva-larga',
    });
    expect(await screen.findByText(/cambiada/i)).toBeInTheDocument();

    // Y después se vuelve a pedir la cuenta: el cambio lo confirma lo que hay
    // guardado, no lo que se acaba de escribir en el formulario.
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/cuenta');
  });

  /**
   * El servidor no puede saber que las dos nuevas no son la misma —solo recibe
   * una—, así que si esto no se comprueba aquí no lo comprueba nadie.
   */
  it('no deja enviar si las dos nuevas no coinciden', async () => {
    const fetchMock = responder({});
    vi.stubGlobal('fetch', fetchMock);
    pintar();

    await escribir('la-de-siempre', 'una-nueva-larga', 'otra-distinta');

    expect(screen.getByText(/las dos nuevas no son la misma/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar la contraseña/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Ocho es el mínimo del dominio, y el formulario no puede dejar enviar lo que
  // el servidor va a rechazar: el viaje de ida y vuelta para eso sobra.
  it('no deja enviar una contraseña más corta que el mínimo', async () => {
    pintar();

    await escribir('la-de-siempre', 'corta', 'corta');

    expect(screen.getByRole('button', { name: /cambiar la contraseña/i })).toBeDisabled();
  });

  it('enseña el motivo que da el servidor', async () => {
    vi.stubGlobal(
      'fetch',
      responder(
        { error: { code: 'no-coincide', message: 'La contraseña de ahora no es esa.' } },
        403,
      ),
    );
    pintar();

    await escribir('me-la-invento', 'una-nueva-larga', 'una-nueva-larga');
    await userEvent.click(screen.getByRole('button', { name: /cambiar la contraseña/i }));

    expect(await screen.findByText(/la contraseña de ahora no es esa/i)).toBeInTheDocument();
  });
});
