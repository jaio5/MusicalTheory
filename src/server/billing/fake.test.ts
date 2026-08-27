import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El cobrador que no cobra.
 *
 * Es el que hay puesto hoy, así que esto no prueba un respaldo: prueba **el
 * camino que recorre cualquiera que cambie de plan en la aplicación de verdad**.
 * Lo que fija es que cambiar de plan es cambiar una fila, que no hay portal que
 * enseñar y —lo importante— que declara que no cobra, que es lo que hace que la
 * pantalla de planes lo avise sola.
 */

const setPlan = vi.fn<(userId: string, plan: string) => Promise<string>>();

vi.mock('../users', () => ({ setPlan: (u: string, p: string) => setPlan(u, p) }));

const { FakeBilling } = await import('./fake');

beforeEach(() => {
  setPlan.mockReset();
  setPlan.mockResolvedValue('ok');
});

describe('el cobrador de mentira', () => {
  it('declara que no cobra, y por eso la pantalla lo avisa', () => {
    // El día que se enchufe Stripe, esa misma pantalla dejará de avisarlo sola.
    expect(FakeBilling.charges).toBe(false);
  });

  it('cambiar de plan es cambiar una fila, sin pasar por ninguna pasarela', async () => {
    expect(await FakeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).toEqual({
      kind: 'listo',
      plan: 'pro',
    });
    expect(setPlan).toHaveBeenCalledWith('u1', 'pro');
  });

  it('si no se puede guardar, se dice que no se ha podido', async () => {
    // Aquí «no existe» y «no se ha podido» son lo mismo: quien llama está
    // mirando una pantalla y hay que decirle algo.
    setPlan.mockResolvedValue('no-existe');

    expect((await FakeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
  });

  it('cancelar baja a gratis', async () => {
    expect(await FakeBilling.cancel({ userId: 'u1' })).toEqual({ ok: true });
    expect(setPlan).toHaveBeenCalledWith('u1', 'gratis');
  });

  it('y si falla, lo dice', async () => {
    setPlan.mockResolvedValue('error');

    expect(await FakeBilling.cancel({ userId: 'u1' })).toEqual({ ok: false });
  });

  it('no hay portal, porque no se ha cobrado nunca', async () => {
    // No hay tarjeta que cambiar ni facturas que mirar: nulo, y la pantalla no
    // enseña el enlace.
    expect(await FakeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
  });
});
