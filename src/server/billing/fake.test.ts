import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { CobroCerrado, FakeBilling } = await import('./fake');
const { billing } = await import('./index');

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

describe('en producción sin Stripe', () => {
  /*
    `billing()` daba el de mentira también en producción: a una copia publicada a
    la que le faltara una sola de las cinco variables de Stripe, cualquiera le
    sacaba el plan Pro pulsando un botón. Ahora se cierra, como el correo.
  */
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('el cobrador es el que no deja pagar, no el de mentira', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(billing()).toBe(CobroCerrado);

    vi.stubEnv('NODE_ENV', 'development');
    expect(billing()).toBe(FakeBilling);
  });

  it('con Stripe puesto, Stripe, esté donde esté', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
    vi.stubEnv('STRIPE_PRICE_BASICO', 'p1');
    vi.stubEnv('STRIPE_PRICE_MEDIO', 'p2');
    vi.stubEnv('STRIPE_PRICE_PRO', 'p3');

    expect(billing().name).toBe('Stripe');
  });

  it('subir de plan no se regala, y no se toca la fila', async () => {
    expect((await CobroCerrado.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
    expect(setPlan).not.toHaveBeenCalled();
    expect(CobroCerrado.charges).toBe(false);
  });

  it('bajar a gratis sí, porque no da nada', async () => {
    expect(await CobroCerrado.start({ userId: 'u1', email: 'a@b.c', plan: 'gratis' })).toEqual({
      kind: 'listo',
      plan: 'gratis',
    });
    expect(await CobroCerrado.cancel({ userId: 'u1' })).toEqual({ ok: true });
    expect(setPlan).toHaveBeenCalledWith('u1', 'gratis');

    setPlan.mockResolvedValue('error');
    expect((await CobroCerrado.start({ userId: 'u1', email: 'a@b.c', plan: 'gratis' })).kind).toBe(
      'error',
    );
  });

  it('y no hay portal', async () => {
    expect(await CobroCerrado.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
  });
});
