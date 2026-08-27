import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El cobrador de Stripe, que nunca se ha ejecutado contra Stripe.
 *
 * **Y por eso mismo esto tiene un límite que conviene decir**: lo que se prueba
 * es la petición que se construye —la dirección, el formato del cuerpo, qué
 * campos viajan— y qué se hace con lo que conteste. Que Stripe acepte esa
 * petición no lo puede decir un test: eso pide una clave de pruebas y está
 * anotado en `docs/PARA-PUBLICAR.md`.
 *
 * Aun así vale la pena, porque los tres fallos que se pueden cometer aquí no son
 * de Stripe sino nuestros: mandar JSON donde piden un formulario, olvidar el
 * identificador de la cuenta en los metadatos —y entonces el webhook no sabe a
 * quién cambiarle el plan— y creerse que ha ido bien cuando la respuesta no trae
 * dirección de pago.
 */

const setPlan = vi.fn<(userId: string, plan: string) => Promise<string>>();

vi.mock('../users', () => ({ setPlan: (u: string, p: string) => setPlan(u, p) }));
vi.mock('../app-url', () => ({ appUrl: () => 'https://caos.test' }));

const { StripeBilling, planOfPrice, stripeConfigured } = await import('./stripe');

const fetchFalso = vi.fn();

/** Lo que devolvería Stripe. */
function contesta(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** La última petición que se le hizo a Stripe, ya interpretada. */
function ultimaPeticion() {
  const [url, init] = fetchFalso.mock.calls.at(-1) as [string, RequestInit];
  const body =
    typeof init.body === 'string' ? new URLSearchParams(init.body) : new URLSearchParams();
  return { url, init, body, headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  fetchFalso.mockReset();
  setPlan.mockReset();
  setPlan.mockResolvedValue('ok');
  vi.stubGlobal('fetch', fetchFalso);
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_loquesea';
  process.env['STRIPE_PRICE_BASICO'] = 'price_basico';
  process.env['STRIPE_PRICE_MEDIO'] = 'price_medio';
  process.env['STRIPE_PRICE_PRO'] = 'price_pro';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of [
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_BASICO',
    'STRIPE_PRICE_MEDIO',
    'STRIPE_PRICE_PRO',
  ]) {
    delete process.env[k];
  }
});

describe('estar configurado', () => {
  it('pide la clave y los tres precios', () => {
    expect(stripeConfigured()).toBe(true);

    delete process.env['STRIPE_PRICE_MEDIO'];
    expect(stripeConfigured()).toBe(false);

    process.env['STRIPE_PRICE_MEDIO'] = 'price_medio';
    delete process.env['STRIPE_SECRET_KEY'];
    expect(stripeConfigured()).toBe(false);
  });
});

describe('de qué plan es un precio', () => {
  it('traduce los tres, y solo esos', () => {
    expect(planOfPrice('price_basico')).toBe('basico');
    expect(planOfPrice('price_medio')).toBe('medio');
    expect(planOfPrice('price_pro')).toBe('pro');
    expect(planOfPrice('price_inventado')).toBeNull();
    expect(planOfPrice(42)).toBeNull();
  });
});

describe('empezar a pagar', () => {
  it('manda un formulario, no JSON', async () => {
    // La API de Stripe no acepta JSON en el cuerpo. Es el fallo más fácil de
    // cometer y el que solo se ve al probarlo de verdad.
    fetchFalso.mockResolvedValue(contesta({ url: 'https://pago' }));

    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'medio' });

    const { headers } = ultimaPeticion();
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('el identificador de la cuenta viaja de ida y vuelta', async () => {
    // Es lo único que permite al webhook saber a quién cambiarle el plan. Sin
    // esto habría que buscar por correo, y un correo se cambia.
    fetchFalso.mockResolvedValue(contesta({ url: 'https://pago' }));

    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'medio' });

    const { body } = ultimaPeticion();
    expect(body.get('client_reference_id')).toBe('u1');
    expect(body.get('metadata[userId]')).toBe('u1');
    expect(body.get('metadata[plan]')).toBe('medio');
    expect(body.get('line_items[0][price]')).toBe('price_medio');
  });

  it('devuelve la dirección de pago cuando la hay', async () => {
    fetchFalso.mockResolvedValue(contesta({ url: 'https://pago' }));

    const result = await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' });

    expect(result).toEqual({ kind: 'ir-a-pagar', url: 'https://pago' });
  });

  it('y no se cree que ha ido bien cuando no la hay', async () => {
    fetchFalso.mockResolvedValue(contesta({ id: 'cs_123' }));

    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
  });

  it('si Stripe contesta un error, tampoco', async () => {
    fetchFalso.mockResolvedValue(contesta({ error: 'no' }, 400));

    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
  });

  it('si la red se cae, tampoco', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));

    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
  });

  it('un plan sin precio configurado no llega a llamar a Stripe', async () => {
    delete process.env['STRIPE_PRICE_PRO'];

    const result = await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' });

    expect(result.kind).toBe('error');
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe('bajar a gratis', () => {
  it('no se paga: se cancela', async () => {
    const result = await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'gratis' });

    expect(result).toEqual({ kind: 'listo', plan: 'gratis' });
    expect(setPlan).toHaveBeenCalledWith('u1', 'gratis');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('el plan baja aquí y no se espera al webhook', async () => {
    // Quien cancela deja de tener acceso ya, y si la llamada a Stripe fallara,
    // lo peligroso sería seguir dándole el plan de pago.
    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: true });
    expect(setPlan).toHaveBeenCalledWith('u1', 'gratis');
  });

  it('si no se puede bajar el plan, se dice', async () => {
    setPlan.mockResolvedValue('error');

    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: false });
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'gratis' })).kind).toBe(
      'error',
    );
  });
});

describe('el portal de cliente', () => {
  it('busca al cliente por correo antes de abrirlo', async () => {
    // Se busca por correo y no se guarda su identificador: una consulta más por
    // visita a cambio de una columna menos que mantener sincronizada.
    fetchFalso
      .mockResolvedValueOnce(contesta({ data: [{ id: 'cus_1' }] }))
      .mockResolvedValueOnce(contesta({ url: 'https://portal' }));

    const url = await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' });

    expect(url).toBe('https://portal');
    expect((fetchFalso.mock.calls[0] as [string])[0]).toContain('email=a%40b.c');
  });

  it('sin cliente en Stripe no hay portal', async () => {
    // Es alguien que nunca ha pagado: no hay facturas que enseñarle.
    fetchFalso.mockResolvedValue(contesta({ data: [] }));

    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
  });

  it('si Stripe no contesta, tampoco', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));

    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
  });
});
