import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cambiar de plan.
 *
 * Hoy el cobrador no cobra —lo cambia y ya, a propósito y con su ADR—, así que lo
 * que se prueba es lo que seguirá siendo verdad cuando sí cobre: que hace falta
 * cuenta, que el plan que se pide tiene que existir, y que **quién cambia de plan
 * sale de la sesión y no del cuerpo**.
 */

const currentSession = vi.fn();
const billing = vi.fn();
const setPlan = vi.fn<(userId: string, plan: string) => Promise<string>>();

vi.mock('@server/entitlements', () => ({ currentSession: () => currentSession() }));
vi.mock('@server/billing', () => ({ billing: () => billing() }));
vi.mock('@server/users', () => ({
  setPlan: (userId: string, plan: string) => setPlan(userId, plan),
}));
vi.mock('@server/auth', () => ({ authAvailable: () => true }));

const { GET, POST } = await import('./route');

const SESION = { userId: 'u1', account: { plan: 'gratis' } };

/** El cobrador que no cobra: cambia el plan y lo declara. */
const COBRADOR_FALSO = {
  name: 'sin cobro',
  charges: false,
  start: vi.fn<(datos: { userId: string; email: string; plan: string }) => Promise<unknown>>(),
  cancel: vi.fn<(datos: { userId: string }) => Promise<{ ok: boolean }>>(),
  portal: vi.fn(async () => null),
};

function pedir(body: unknown): Request {
  return new Request('http://x/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  currentSession.mockReset();
  currentSession.mockResolvedValue(SESION);
  billing.mockReset();
  billing.mockReturnValue(COBRADOR_FALSO);
  setPlan.mockClear();
  setPlan.mockResolvedValue('ok');
  COBRADOR_FALSO.start.mockReset();
  COBRADOR_FALSO.start.mockResolvedValue({ kind: 'listo', plan: 'medio' });
  COBRADOR_FALSO.cancel.mockReset();
  COBRADOR_FALSO.cancel.mockResolvedValue({ ok: true });
});

describe('quién puede cambiar de plan', () => {
  it('sin cuenta, no', async () => {
    currentSession.mockResolvedValue(null);

    const { status } = await leer(await POST(pedir({ plan: 'medio' })));

    expect(status).toBe(401);
    expect(COBRADOR_FALSO.start).not.toHaveBeenCalled();
  });

  it('volver a gratis cancela en vez de cobrar', async () => {
    currentSession.mockResolvedValue({ userId: 'u1', account: { plan: 'medio' } });

    await POST(pedir({ plan: 'gratis' }));

    expect(COBRADOR_FALSO.cancel).toHaveBeenCalledWith({ userId: 'u1' });
    expect(COBRADOR_FALSO.start).not.toHaveBeenCalled();
  });

  it('pedir el plan que ya tienes no hace nada', async () => {
    const { status } = await leer(await POST(pedir({ plan: 'gratis' })));

    expect(status).toBe(200);
    expect(COBRADOR_FALSO.start).not.toHaveBeenCalled();
    expect(COBRADOR_FALSO.cancel).not.toHaveBeenCalled();
  });

  it('el usuario sale de la sesión, no del cuerpo', async () => {
    // Si saliera del cuerpo, cualquiera le pondría el plan Pro a otra persona
    // —o se lo quitaría—.
    await POST(pedir({ plan: 'medio', userId: 'otro' }));

    const usuarios = setPlan.mock.calls.map((c) => c[0]);
    const enCobro = COBRADOR_FALSO.start.mock.calls.map((c) => c[0].userId);

    expect(COBRADOR_FALSO.start).toHaveBeenCalled();
    expect([...usuarios, ...enCobro].every((u) => u === undefined || u === 'u1')).toBe(true);
  });
});

describe('qué plan se pide', () => {
  it('un plan que no existe no se acepta', async () => {
    const { status } = await leer(await POST(pedir({ plan: 'platino' })));

    expect(status).toBe(400);
    expect(COBRADOR_FALSO.start).not.toHaveBeenCalled();
  });

  it('sin decir plan tampoco', async () => {
    const { status } = await leer(await POST(pedir({})));

    expect(status).toBe(400);
  });
});

describe('lo que dice el cobrador', () => {
  it('GET cuenta si esta copia cobra o no', async () => {
    // La pantalla lo usa para avisar de que no se cobra en vez de fingir una
    // pasarela.
    const { status, body } = await leer(await GET());

    expect(status).toBe(200);
    expect(body['billing']).toMatchObject({ charges: false });
    expect(body['plans']).toBeInstanceOf(Array);
  });

  it('con el cobrador que no cobra, el plan cambia sin pasar por caja', async () => {
    const { status } = await leer(await POST(pedir({ plan: 'medio' })));

    expect(status).toBe(200);
    expect(COBRADOR_FALSO.start).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', plan: 'medio' }),
    );
  });
});
