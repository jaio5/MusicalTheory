// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { EMPTY_PROGRESS, REVIEW_XP, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';
import { loadProgress, today } from '@state/learn-progress';

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

function montar(account: Account = ANONYMOUS, { estricto = false } = {}) {
  return renderHook(() => useProgress(), {
    wrapper: ({ children }) => {
      const dentro = (
        <AccountProvider account={account} accounts>
          {children}
        </AccountProvider>
      );
      return estricto ? <StrictMode>{dentro}</StrictMode> : dentro;
    },
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
  // La marca de la fusión de entrada es del módulo y sobrevive entre pruebas.
  // Se limpia por donde se limpia de verdad: pasando por una sesión sin cuenta.
  montar(ANONYMOUS).unmount();
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

  /**
   * **Lo que dice la celebración es lo de este repaso**, no lo del día. El
   * primer repaso de hoy, con lo fallado ayer, no puede restar los puntos de
   * ayer: el `xpToday` guardado es del último día con actividad, que no es hoy.
   * Esta rama llevó un `v8 ignore` que decía que no se daba nunca.
   */
  it('el primer repaso del dia cuenta lo suyo, aunque ayer se ganara mas', () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, lastDay: today(ayer), xpToday: 30 }),
    );
    const { result } = montar();

    act(() => result.current.finishReview(true));

    expect(result.current.celebration?.xp).toBe(REVIEW_XP);
  });

  it('y el segundo del mismo dia, tambien solo lo suyo', () => {
    const { result } = montar();
    act(() => result.current.finishReview(true));

    act(() => result.current.finishReview(true));

    expect(result.current.celebration?.xp).toBe(REVIEW_XP);
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

describe('los actualizadores son puros', () => {
  // En `StrictMode` React ejecuta dos veces cada actualizador de estado. Con la
  // subida dentro eran dos `PUT` por unidad terminada.
  async function trasLaEntrada() {
    const montado = montar(CON_SINCRONIA, { estricto: true });
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    fetchFalso.mockClear();
    return montado;
  }

  it('terminar una unidad sube una sola vez', async () => {
    const { result } = await trasLaEntrada();

    act(() => result.current.complete(PRIMERA, true));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
  });

  it('cerrar un repaso y mover el punto de partida, tambien una', async () => {
    const { result } = await trasLaEntrada();

    act(() => result.current.finishReview(true));
    act(() => result.current.chooseStart('elemental-2'));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
  });

  it('dos llamadas seguidas en el mismo tick encadenan', () => {
    // El siguiente se calcula desde la referencia, que cambia a la vez que el
    // estado: si se leyera del render, el segundo fallo pisaría al primero.
    const { result } = montar();

    act(() => {
      result.current.miss(PRIMERA, 0);
      result.current.miss(PRIMERA, 1);
    });

    expect(result.current.progress.review).toHaveLength(2);
    expect(loadProgress().review).toHaveLength(2);
  });
});

describe('la fusion de entrada es una por cuenta, no por pantalla', () => {
  it('dos pantallas montadas con la misma cuenta suben una vez', async () => {
    montar(CON_SINCRONIA);
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));

    montar(CON_SINCRONIA);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('salir de la cuenta la olvida, y volver a entrar sube otra vez', async () => {
    montar(CON_SINCRONIA).unmount();
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));

    montar(ANONYMOUS).unmount();
    montar(CON_SINCRONIA);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
  });

  it('con cuenta pero sin sincronia no se sube nada', () => {
    montar({ ...CON_SINCRONIA, plan: 'gratis' });

    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
