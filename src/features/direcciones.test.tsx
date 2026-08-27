// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';
import type { Account } from '@core/billing';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { ForgottenForm } from './account/ForgottenForm';
import { IdeasPanel } from './ideas/IdeasPanel';
import { SongsPanel } from './songs/SongsPanel';
import { VersionsPanel } from './versions/VersionsPanel';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

/**
 * A qué dirección llama de verdad cada panel.
 *
 * Los cuatro reciben su `fetch` por parámetro para poder probarlos sin red, y
 * eso deja **el cableado por defecto sin probar**: la dirección, el método y la
 * cabecera que se usan cuando nadie inyecta nada, que es lo que pasa en la
 * aplicación de verdad. Una errata ahí —`/api/cancione`— no la vería ningún
 * test, y en pantalla saldría un «no hemos podido» sin más pista.
 *
 * Aquí se montan **sin inyectar nada** y se mira lo que sale por `fetch`.
 */

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

const fetchFalso = vi.fn();

function contesta(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function conCuenta(nodo: React.ReactNode) {
  return render(
    <AccountProvider account={CON_PLAN} accounts>
      {nodo}
    </AccountProvider>,
  );
}

/** Con tonalidad y unos compases, que es lo que hace falta para pedir nada. */
function componiendo() {
  const A = pitchClassFromName('A');
  const { actions } = useSessionStore.getState();
  actions.reset();
  actions.pinKey({ tonic: A, mode: 'minor' });
  for (const label of ['i', 'VI', 'III', 'VII']) {
    actions.pushChord({ symbol: label, label, root: A, notes: [A], why: 'porque sí' });
  }
}

/** La dirección y las opciones de la última llamada. */
function ultima(): [string, RequestInit] {
  return fetchFalso.mock.calls.at(-1) as [string, RequestInit];
}

beforeEach(() => {
  fetchFalso.mockReset();
  fetchFalso.mockResolvedValue(contesta({}));
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('las direcciones que se usan de verdad', () => {
  it('las ideas van a /api/ideas, en POST y con JSON', async () => {
    componiendo();
    fetchFalso.mockResolvedValue(contesta({ ideas: [] }));
    conCuenta(<IdeasPanel />);

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = ultima();
    expect(url).toBe('/api/ideas');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('las salidas van a /api/versiones', async () => {
    componiendo();
    fetchFalso.mockResolvedValue(contesta({ versions: [] }));
    conCuenta(<VersionsPanel />);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(ultima()[0]).toBe('/api/versiones');
  });

  it('las canciones van a /api/canciones, y se leen sin caché', async () => {
    // Con caché, guardar una y volver a la pantalla enseñaría la lista de antes.
    fetchFalso.mockResolvedValue(contesta({ songs: [] }));
    conCuenta(<SongsPanel />);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = ultima();
    expect(url).toBe('/api/canciones');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
  });

  it('la contraseña olvidada va a /api/cuenta/olvidada', async () => {
    fetchFalso.mockResolvedValue(contesta({ mandado: true }));
    conCuenta(<ForgottenForm />);

    await userEvent.type(screen.getByLabelText(/correo/i), 'a@b.c');
    await userEvent.click(screen.getByRole('button', { name: /Mandarme el enlace/i }));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(ultima()[0]).toBe('/api/cuenta/olvidada');
  });
});
