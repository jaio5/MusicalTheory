import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_PROGRESS, findUnit, UNIT_ORDER } from '@core/music';

/**
 * El avance en la cuenta: leerlo y guardarlo.
 *
 * Lo que se prueba es lo que de verdad puede salir mal aquí: que sin cuenta no se
 * conteste nada, y sobre todo **que guardar no pierda avance**. Esta ruta funde
 * lo que llega con lo que ya había en vez de sobreescribirlo, y esa es la única
 * razón de que se pueda usar la aplicación en dos aparatos.
 */

const currentSession = vi.fn();
const loadAccountProgress = vi.fn();
const fusionarAvance =
  vi.fn<(userId: string, entrante: unknown, hoy: string) => Promise<unknown>>();
const frenoPorCuenta = vi.fn<() => Promise<Response | null>>();

vi.mock('@server/entitlements', () => ({ currentSession: () => currentSession() }));
// Fundir de verdad es una transacción contra Postgres, y eso se prueba con la base
// delante en `route.con-base.test.ts`. Aquí se mira lo que la ruta hace alrededor.
vi.mock('@server/progress-repo', () => ({
  hoyEnElServidor: () => '2026-10-07',
  loadAccountProgress: (userId: string) => loadAccountProgress(userId),
  fusionarAvance: (userId: string, entrante: unknown, hoy: string) =>
    fusionarAvance(userId, entrante, hoy),
}));
vi.mock('@server/tope-por-cuenta', () => ({
  TOPE_DEL_AVANCE: { limit: 60, windowMs: 60_000 },
  frenoPorCuenta: () => frenoPorCuenta(),
}));

const { GET, PUT } = await import('./route');

// Guardar el avance en la cuenta entra en un plan de pago: con el gratis, 402.
const SESION = { userId: 'u1', account: { plan: 'basico' } };

/** El avance viaja dentro de `progress`, no suelto en la raíz. */
function guardar(progress: unknown): Request {
  return new Request('http://x/api/progreso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress }),
  });
}

/** Un avance con la forma del dominio: unidades hechas, no un diccionario. */
function avance(hechas: readonly string[]) {
  return { ...EMPTY_PROGRESS, done: [...hechas] };
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  currentSession.mockReset();
  loadAccountProgress.mockReset();
  fusionarAvance.mockReset();
  fusionarAvance.mockImplementation(async (_userId, entrante) => entrante);
  frenoPorCuenta.mockReset();
  frenoPorCuenta.mockResolvedValue(null);
});

describe('sin plan que lo incluya', () => {
  it('guardar el avance en la cuenta pide plan, y lo dice con el que hace falta', async () => {
    currentSession.mockResolvedValue({ userId: 'u1', account: { plan: 'gratis' } });

    const { status, body } = await leer(await GET());

    expect(status).toBe(402);
    expect((body['error'] as { message: string }).message).toContain('Guardar el avance');
  });
});

describe('sin cuenta', () => {
  it('leer no devuelve nada', async () => {
    currentSession.mockResolvedValue(null);

    expect((await leer(await GET())).status).toBe(401);
  });

  it('guardar tampoco, y no toca el repositorio', async () => {
    currentSession.mockResolvedValue(null);

    expect((await leer(await PUT(guardar(avance(['e1-grados']))))).status).toBe(401);
    expect(fusionarAvance).not.toHaveBeenCalled();
  });
});

describe('con cuenta', () => {
  beforeEach(() => {
    currentSession.mockResolvedValue(SESION);
  });

  it('devuelve el avance guardado', async () => {
    loadAccountProgress.mockResolvedValue({
      kind: 'ok',
      progress: avance(['e1-grados']),
    });

    const { status, body } = await leer(await GET());

    expect(status).toBe(200);
    expect((body['progress'] as { done: string[] }).done).toEqual(['e1-grados']);
  });

  it('si no se puede leer, lo dice en vez de fingir que no hay avance', async () => {
    // Contestar «no tienes nada» cuando la base de datos no contesta haría que el
    // navegador se creyera vacío y pisara lo que sí había.
    loadAccountProgress.mockResolvedValue({ kind: 'error' });

    expect((await leer(await GET())).status).toBe(502);
  });

  it('guardar funde en el repositorio, con el día del servidor, y devuelve la fusión', async () => {
    // Fundir es lo que permite usar la aplicación en dos aparatos, y lo hace el
    // repositorio dentro de una transacción para que dos subidas no se pisen.
    fusionarAvance.mockResolvedValue(avance(['e1-grados', 'e1-notas']));

    const { status, body } = await leer(await PUT(guardar(avance(['e1-notas']))));

    expect(status).toBe(200);
    expect(fusionarAvance.mock.calls[0]![0]).toBe('u1');
    expect((fusionarAvance.mock.calls[0]![1] as { done: string[] }).done).toEqual(['e1-notas']);
    expect(fusionarAvance.mock.calls[0]![2]).toBe('2026-10-07');
    expect((body['progress'] as { done: string[] }).done).toEqual(['e1-grados', 'e1-notas']);
  });

  it('lo que llega se limpia en vez de creerse', async () => {
    // A propósito no se rechaza: cualquiera puede abrir la consola y mandarse los
    // diez cursos hechos, y eso da igual porque es su avance. Lo que no puede es
    // colar una unidad que no existe ni un XP que no cuadre con lo hecho.
    const { status } = await leer(
      await PUT(guardar({ ...EMPTY_PROGRESS, done: ['unidad-inventada'], xp: 99_999 })),
    );

    const subido = fusionarAvance.mock.calls[0]![1] as { done: string[]; xp: number };

    expect(status).toBe(200);
    expect(subido.done).not.toContain('unidad-inventada');
    expect(subido.xp).toBeLessThan(99_999);
  });

  it('ni una fecha posterior a mañana, ni una racha imposible', async () => {
    await PUT(guardar({ ...EMPTY_PROGRESS, lastDay: '9999-12-31', streak: 1e308, xpToday: 1e308 }));

    expect(fusionarAvance.mock.calls[0]![1]).toMatchObject({ lastDay: null, streak: 0 });
  });

  /**
   * El navegador no carga las lecciones para contar sus preguntas, así que su
   * cola puede apuntar a una que el temario ya no tiene. Se suelta aquí: si se
   * guardara, contaría como pendiente para siempre sin poder preguntarse.
   */
  it('lo que la cola apunta a una pregunta que ya no existe no se guarda', async () => {
    const deTocar = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!;

    await PUT(
      guardar({
        ...EMPTY_PROGRESS,
        review: [
          { unitId: deTocar, index: 0, seenOn: '2026-07-29', hits: 0 },
          { unitId: deTocar, index: 999, seenOn: '2026-07-29', hits: 0 },
        ],
      }),
    );

    const subido = fusionarAvance.mock.calls[0]![1] as { review: { index: number }[] };
    expect(subido.review.map((item) => item.index)).toEqual([0]);
  });

  it('si no se puede fundir y guardar, lo dice', async () => {
    fusionarAvance.mockResolvedValue(null);

    const { status, body } = await leer(await PUT(guardar(avance(['e1-grados']))));

    expect(status).toBe(502);
    expect((body['error'] as { code: string }).code).toBe('no-guardado');
  });

  it('frenada por el tope de la cuenta, contesta el 429 y no toca nada', async () => {
    frenoPorCuenta.mockResolvedValue(new Response(null, { status: 429 }));

    const res = await PUT(guardar(avance(['e1-grados'])));

    expect(res.status).toBe(429);
    expect(fusionarAvance).not.toHaveBeenCalled();
  });
});

describe('una cuenta que todavía no ha guardado nada', () => {
  it('devuelve el avance vacío, no un error', async () => {
    // Es lo normal el primer día con cuenta: hay cuenta, hay plan y no hay
    // ninguna fila. Un error ahí haría que la escalera saliera bloqueada.
    currentSession.mockResolvedValue({ userId: 'u1', account: { plan: 'medio' } });
    loadAccountProgress.mockResolvedValue({ kind: 'vacio' });

    const { status, body } = await leer(await GET());

    expect(status).toBe(200);
    expect(body['progress']).toMatchObject({ done: [] });
  });
});
