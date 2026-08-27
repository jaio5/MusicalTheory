import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_PROGRESS } from '@core/music';

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
const saveAccountProgress = vi.fn<(userId: string, progress: unknown) => Promise<boolean>>();

vi.mock('@server/entitlements', () => ({ currentSession: () => currentSession() }));
vi.mock('@server/progress-repo', () => ({
  loadAccountProgress: (userId: string) => loadAccountProgress(userId),
  saveAccountProgress: (userId: string, progress: unknown) => saveAccountProgress(userId, progress),
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
  saveAccountProgress.mockReset();
  saveAccountProgress.mockResolvedValue(true);
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
    expect(saveAccountProgress).not.toHaveBeenCalled();
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

  it('guardar funde con lo que ya había, en vez de sobreescribirlo', async () => {
    // Es lo que permite usar la aplicación en dos aparatos: lo que se manda desde
    // uno no puede borrar lo que se hizo en el otro.
    loadAccountProgress.mockResolvedValue({
      kind: 'ok',
      progress: avance(['e1-grados']),
    });

    await PUT(guardar(avance(['e1-repaso'])));

    const guardado = saveAccountProgress.mock.calls[0]![1] as { done: string[] };
    expect([...guardado.done].sort()).toEqual(['e1-grados', 'e1-repaso']);
  });

  it('lo que llega se limpia en vez de creerse', async () => {
    // A propósito no se rechaza: cualquiera puede abrir la consola y mandarse los
    // diez cursos hechos, y eso da igual porque es su avance. Lo que no puede es
    // colar una unidad que no existe ni un XP que no cuadre con lo hecho.
    loadAccountProgress.mockResolvedValue({ kind: 'vacio' });

    const { status } = await leer(
      await PUT(guardar({ ...EMPTY_PROGRESS, done: ['unidad-inventada'], xp: 99_999 })),
    );

    const guardado = saveAccountProgress.mock.calls[0]![1] as { done: string[]; xp: number };

    expect(status).toBe(200);
    expect(guardado.done).not.toContain('unidad-inventada');
    expect(guardado.xp).toBeLessThan(99_999);
  });

  it('si no se puede leer lo que había, no se escribe nada', async () => {
    // Escribir sin poder leer sería sustituir el avance de la cuenta por el de
    // este navegador, y eso es perder lo que se hizo en otro sitio.
    loadAccountProgress.mockResolvedValue({ kind: 'error' });

    const { status } = await leer(await PUT(guardar(avance(['e1-grados']))));

    expect(status).toBe(502);
    expect(saveAccountProgress).not.toHaveBeenCalled();
  });

  it('si no se puede guardar, lo dice', async () => {
    loadAccountProgress.mockResolvedValue({ kind: 'vacio' });
    saveAccountProgress.mockResolvedValue(false);

    expect((await leer(await PUT(guardar(avance(['e1-grados']))))).status).toBe(502);
  });
});

describe('una cuenta que todavía no ha guardado nada', () => {
  it('devuelve el avance vacío, no un error', async () => {
    // Es lo normal el primer día con cuenta: hay cuenta, hay plan y no hay
    // ninguna fila. Un error ahí haría que la escalera saliera bloqueada.
    currentSession.mockResolvedValue({ userId: 'u1', account: { plan: 'pro' } });
    loadAccountProgress.mockResolvedValue({ kind: 'vacio' });

    const { status, body } = await leer(await GET());

    expect(status).toBe(200);
    expect(body['progress']).toMatchObject({ done: [] });
  });
});
