// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { COMPOSE_XP, EMPTY_PROGRESS, MAX_COMPOSE_XP, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';
import { apuntarHecho } from '@state/hechos-de-componer';
import { loadProgress, saveProgress } from '@state/learn-progress';

import { useGananciaAlComponer } from './use-ganancia-al-componer';

/**
 * Componer cuenta como practicar, y lo apunta un gancho aparte del avance
 * entero para que `/componer` no se lleve el temario.
 *
 * La suma llega por un `import()`, así que todo lo de aquí se espera: el hecho
 * se apunta en el acto y lo ganado aparece un instante después.
 */

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

const CON_SINCRONIA: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

const fetchFalso = vi.fn();

function montar(account: Account = ANONYMOUS) {
  return renderHook(() => useGananciaAlComponer(), {
    wrapper: ({ children }) => (
      <AccountProvider account={account} accounts>
        {children}
      </AccountProvider>
    ),
  });
}

function fusion(progress: unknown) {
  return new Response(JSON.stringify({ progress }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchFalso.mockReset();
  fetchFalso.mockResolvedValue(fusion(EMPTY_PROGRESS));
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('componer cuenta como practicar', () => {
  it('un hecho apuntado suma y queda guardado en el equipo', async () => {
    montar();

    act(() => apuntarHecho('cancion'));

    await waitFor(() => expect(loadProgress().composeToday).toBe(COMPOSE_XP.cancion));
    expect(loadProgress().streak).toBe(1);
  });

  it('y lo cuenta en pantalla, con la medalla que acabe de salir', async () => {
    const { result } = montar();

    act(() => apuntarHecho('cancion'));

    await waitFor(() =>
      expect(result.current.composeGain).toMatchObject({
        deed: 'cancion',
        xp: COMPOSE_XP.cancion,
        newBadges: [expect.objectContaining({ id: 'primera-cancion' })],
      }),
    );
  });

  it('suma sobre lo que ya habia guardado, no sobre un avance vacio', async () => {
    // Lee del equipo justo antes de sumar: una unidad hecha en otra pestaña
    // no se pierde por guardar una canción aquí.
    saveProgress({ ...EMPTY_PROGRESS, done: [UNIT_ORDER[0]!] });
    montar();

    act(() => apuntarHecho('oido'));

    await waitFor(() => expect(loadProgress().xpToday).toBe(COMPOSE_XP.oido));
    expect(loadProgress().done).toEqual([UNIT_ORDER[0]]);
  });

  it('el aviso se puede quitar sin deshacer lo ganado', async () => {
    const { result } = montar();
    act(() => apuntarHecho('oido'));
    await waitFor(() => expect(result.current.composeGain).not.toBeNull());

    act(() => result.current.dismissComposeGain());

    expect(result.current.composeGain).toBeNull();
    expect(loadProgress().xpToday).toBe(COMPOSE_XP.oido);
  });

  it('con el tope lleno deja de sumar y no enseña un aviso de cero', async () => {
    const { result } = montar();
    act(() => {
      for (let i = 0; i < 10; i += 1) {
        apuntarHecho('cancion');
      }
    });
    await waitFor(() => expect(loadProgress().composeToday).toBe(MAX_COMPOSE_XP));
    act(() => result.current.dismissComposeGain());

    act(() => apuntarHecho('cancion'));
    // Se espera a que la suma pase —la racha vuelve a guardarse— antes de mirar
    // que el aviso sigue sin salir.
    const antes = localStorage.getItem('caos-ordenado:aprender');
    await act(async () => {
      await import('./sumar-al-componer');
    });

    expect(localStorage.getItem('caos-ordenado:aprender')).toBe(antes);
    expect(result.current.composeGain).toBeNull();
  });

  it('y al desmontar la pantalla se da de baja', async () => {
    const { unmount } = montar();

    unmount();
    apuntarHecho('cancion');
    await import('./sumar-al-componer');

    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });
});

describe('con cuenta que sincroniza', () => {
  it('sube lo compuesto y guarda la fusion que vuelve', async () => {
    const otras = UNIT_ORDER.slice(0, 2);
    fetchFalso.mockResolvedValue(fusion({ ...EMPTY_PROGRESS, done: otras }));
    montar(CON_SINCRONIA);

    act(() => apuntarHecho('cancion'));

    await waitFor(() => expect(loadProgress().done).toEqual([...otras]));
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/progreso');
    expect(init.method).toBe('PUT');
  });

  it('si el servidor contesta mal, se queda lo de aqui', async () => {
    fetchFalso.mockResolvedValue(new Response('', { status: 500 }));
    montar(CON_SINCRONIA);

    act(() => apuntarHecho('cancion'));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(loadProgress().composeToday).toBe(COMPOSE_XP.cancion);
  });

  it('sin red tampoco se pierde nada', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));
    montar(CON_SINCRONIA);

    act(() => apuntarHecho('cancion'));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(loadProgress().composeToday).toBe(COMPOSE_XP.cancion);
  });

  it('montar la pantalla no sube nada: la fusion de entrada es de aprender', () => {
    montar(CON_SINCRONIA);

    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
