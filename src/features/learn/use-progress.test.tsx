// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { COMPOSE_XP, EMPTY_PROGRESS, MAX_COMPOSE_XP, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';
import { apuntarHecho } from '@state/hechos-de-componer';
import { loadProgress } from '@state/learn-progress';

import { useProgress } from './use-progress';

/**
 * El avance: leído del equipo, guardado en cuanto cambia y subido si el plan lo
 * incluye.
 *
 * La regla que sostiene esto es **el navegador es la copia de trabajo, también
 * con cuenta**: se escribe en `localStorage` primero y se sube después, así que
 * terminar una unidad no espera a la red y una unidad terminada en un túnel no se
 * pierde. Los tests de aquí lo miran desde los dos lados: lo que queda guardado
 * en el equipo y lo que sale hacia el servidor.
 *
 * `next-auth/react` se sustituye porque en Node no carga; la cuenta entra por el
 * proveedor, que es como llega de verdad.
 */

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

const PRIMERA = UNIT_ORDER[0]!;

const CON_SINCRONIA: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

const fetchFalso = vi.fn();

function montar(account: Account = ANONYMOUS, escuchaComponer = false) {
  return renderHook(() => useProgress({ escuchaComponer }), {
    wrapper: ({ children }) => (
      <AccountProvider account={account} accounts>
        {children}
      </AccountProvider>
    ),
  });
}

/** Lo que contestaría `/api/progreso`. */
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

describe('leer lo que hay', () => {
  it('empieza vacio y se rellena despues de pintar', () => {
    // En servidor no hay `localStorage`, y leerlo durante el render daría un
    // HTML distinto al del cliente.
    const { result } = montar();

    expect(result.current.loaded).toBe(true);
    expect(result.current.progress).toEqual(EMPTY_PROGRESS);
    expect(result.current.day).not.toBeNull();
  });

  it('lo guardado en el equipo se recupera', () => {
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: [PRIMERA] }),
    );

    const { result } = montar();

    expect(result.current.progress.done).toEqual([PRIMERA]);
  });
});

describe('terminar una unidad', () => {
  it('suma, celebra y queda guardado en el equipo', () => {
    const { result } = montar();

    act(() => result.current.complete(PRIMERA, true));

    expect(result.current.progress.done).toContain(PRIMERA);
    expect(result.current.celebration?.unitId).toBe(PRIMERA);
    expect(result.current.celebration?.xp).toBeGreaterThan(0);
    expect(loadProgress().done).toContain(PRIMERA);
  });

  it('repetirla no vuelve a sumar ni a celebrar', () => {
    // Se repasa cuantas veces se quiera, pero el XP no se gana dos veces.
    const { result } = montar();
    act(() => result.current.complete(PRIMERA, true));
    const xp = result.current.progress.xp;
    act(() => result.current.dismissCelebration());

    act(() => result.current.complete(PRIMERA, true));

    expect(result.current.progress.xp).toBe(xp);
    expect(result.current.celebration).toBeNull();
  });

  it('sin cuenta no sale nada hacia el servidor', () => {
    const { result } = montar();

    act(() => result.current.complete(PRIMERA, true));

    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe('fallar y acertar', () => {
  it('un fallo se apunta para el repaso y no sube', () => {
    // Subir por cada pregunta fallada sería una petición por pulsación. Viaja
    // con la siguiente unidad terminada.
    const { result } = montar();

    act(() => result.current.miss(PRIMERA, 0));

    expect(result.current.progress.review.length).toBeGreaterThan(0);
    expect(loadProgress().review.length).toBeGreaterThan(0);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('un acierto en repaso tambien se guarda', () => {
    const { result } = montar();
    act(() => result.current.miss(PRIMERA, 0));

    act(() => result.current.hit(PRIMERA, 0));

    expect(loadProgress().review).toEqual(result.current.progress.review);
  });
});

describe('cerrar un repaso', () => {
  it('celebra y suma a la meta del dia', () => {
    const { result } = montar();

    act(() => result.current.finishReview(true));

    expect(result.current.celebration?.unitId).toBe('repaso');
    expect(result.current.celebration?.flawless).toBe(true);
  });
});

describe('el punto de partida', () => {
  it('se mueve sin borrar nada ni dar nada por hecho', () => {
    const { result } = montar();

    act(() => result.current.chooseStart('elemental-2'));

    expect(result.current.progress.startCourse).toBe('elemental-2');
    expect(result.current.progress.done).toEqual([]);
  });

  it('elegir el mismo no vuelve a guardar', () => {
    const { result } = montar(CON_SINCRONIA);
    act(() => result.current.chooseStart('elemental-2'));
    const llamadas = fetchFalso.mock.calls.length;

    act(() => result.current.chooseStart('elemental-2'));

    expect(fetchFalso.mock.calls.length).toBe(llamadas);
  });
});

describe('borrar el avance', () => {
  it('lo deja como el primer dia, sin celebracion colgando', () => {
    const { result } = montar();
    act(() => result.current.complete(PRIMERA, true));

    act(() => result.current.reset());

    expect(result.current.progress).toEqual(EMPTY_PROGRESS);
    expect(result.current.celebration).toBeNull();
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });
});

describe('con cuenta que sincroniza', () => {
  it('al entrar se sube lo de este navegador, que es lo que no pierde nada', async () => {
    // Es lo que hace que estudiar sin cuenta y registrarse después conserve el
    // avance: se sube lo que hay y se queda lo que devuelva la fusión.
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: [PRIMERA] }),
    );

    montar(CON_SINCRONIA);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/progreso');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string).progress.done).toEqual([PRIMERA]);
  });

  it('lo que vuelve del servidor es lo que se queda', async () => {
    // Si en otro aparato se hicieron dos unidades más, aparecen aquí sin
    // recargar.
    const otras = UNIT_ORDER.slice(0, 2);
    fetchFalso.mockResolvedValue(fusion({ ...EMPTY_PROGRESS, done: otras }));

    const { result } = montar(CON_SINCRONIA);

    await waitFor(() => expect(result.current.progress.done).toEqual([...otras]));
    expect(loadProgress().done).toEqual([...otras]);
  });

  it('si el servidor contesta mal, se queda lo de aqui', async () => {
    fetchFalso.mockResolvedValue(new Response('', { status: 500 }));

    const { result } = montar(CON_SINCRONIA);
    act(() => result.current.complete(PRIMERA, true));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(result.current.progress.done).toContain(PRIMERA);
  });

  it('sin red tampoco se pierde nada', async () => {
    // La próxima subida lo arrastra: la fusión no depende de que esta llegara.
    fetchFalso.mockRejectedValue(new Error('sin red'));

    const { result } = montar(CON_SINCRONIA);
    act(() => result.current.complete(PRIMERA, true));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(loadProgress().done).toContain(PRIMERA);
  });

  it('la fusion de entrada se hace una sola vez', async () => {
    const { rerender } = montar(CON_SINCRONIA);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    rerender();

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('dice que esta sincronizando, que es lo que la pantalla enseña', () => {
    expect(montar(CON_SINCRONIA).result.current.syncing).toBe(true);
    expect(montar().result.current.syncing).toBe(false);
  });
});

describe('componer cuenta como practicar', () => {
  it('un hecho apuntado suma y queda guardado en el equipo', () => {
    const { result } = montar(ANONYMOUS, true);

    act(() => {
      apuntarHecho('cancion');
    });

    expect(result.current.progress.xpToday).toBe(COMPOSE_XP.cancion);
    expect(result.current.progress.streak).toBe(1);
    expect(loadProgress().composeToday).toBe(COMPOSE_XP.cancion);
  });

  it('y lo cuenta en pantalla, con la medalla que acabe de salir', () => {
    const { result } = montar(ANONYMOUS, true);

    act(() => {
      apuntarHecho('cancion');
    });

    expect(result.current.composeGain).toMatchObject({
      deed: 'cancion',
      xp: COMPOSE_XP.cancion,
      newBadges: ['primera-cancion'],
    });
  });

  it('el aviso se puede quitar sin deshacer lo ganado', () => {
    const { result } = montar(ANONYMOUS, true);

    act(() => {
      apuntarHecho('oido');
    });
    act(() => {
      result.current.dismissComposeGain();
    });

    expect(result.current.composeGain).toBeNull();
    expect(result.current.progress.xpToday).toBe(COMPOSE_XP.oido);
  });

  it('quien no escucha no suma, aunque se apunte un hecho', () => {
    // Es la razón de que `escuchaComponer` exista: hay varias pantallas
    // llamando a este gancho a la vez, y con dos apuntados el mismo hecho
    // sumaría dos veces y las dos copias se pisarían al guardar.
    const { result } = montar();

    act(() => {
      apuntarHecho('cancion');
    });

    expect(result.current.progress).toEqual(EMPTY_PROGRESS);
  });

  it('con el tope lleno deja de sumar y no enseña un aviso de cero', () => {
    const { result } = montar(ANONYMOUS, true);

    act(() => {
      for (let i = 0; i < 10; i += 1) {
        apuntarHecho('cancion');
      }
    });
    act(() => {
      result.current.dismissComposeGain();
    });
    act(() => {
      apuntarHecho('cancion');
    });

    expect(result.current.progress.composeToday).toBe(MAX_COMPOSE_XP);
    expect(result.current.composeGain).toBeNull();
  });

  it('y al desmontar la pantalla se da de baja', () => {
    const { result, unmount } = montar(ANONYMOUS, true);
    const antes = result.current.progress.xpToday;

    unmount();
    apuntarHecho('cancion');

    expect(loadProgress().xpToday).toBe(antes);
  });
});
