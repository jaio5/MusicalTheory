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
 * Aun así vale la pena, porque los fallos que se pueden cometer aquí no son de
 * Stripe sino nuestros, y tres los encontró la auditoría: cancelar sin decírselo
 * a Stripe —seguía cobrando—, abrir otro Checkout teniendo ya suscripción —cobraba
 * dos veces— y poner el identificador de la cuenta en la sesión y no en la
 * suscripción. **Lo que contesta Stripe aquí tiene la forma de su documentación**
 * (`docs.stripe.com/api`): una suscripción trae `customer`, `status` e
 * `items.data[].price`, y nada que no traiga de verdad.
 */

type Cuenta = { customerId: string | null; subscriptionId: string | null } | null;
const suscripcionDe = vi.fn<(userId: string) => Promise<Cuenta>>();
const soltarSuscripcion = vi.fn<(userId: string) => Promise<string>>();

vi.mock('../users', () => ({
  suscripcionDe: (u: string) => suscripcionDe(u),
  soltarSuscripcion: (u: string) => soltarSuscripcion(u),
}));
vi.mock('../app-url', () => ({ appUrl: () => 'https://caos.test' }));

const {
  StripeBilling,
  accesoDe,
  cancelarEnStripe,
  planOfPrice,
  stripeConfigured,
  suscripcionEnStripe,
} = await import('./stripe');

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

/** Una suscripción como la devuelve `GET /v1/subscriptions/:id`, recortada. */
function suscripcion(status: string, price = 'price_medio') {
  return {
    id: 'sub_1',
    object: 'subscription',
    customer: 'cus_1',
    status,
    metadata: { userId: 'u1', plan: 'medio' },
    items: {
      object: 'list',
      data: [{ id: 'si_1', object: 'subscription_item', price: { id: price, object: 'price' } }],
    },
  };
}

beforeEach(() => {
  fetchFalso.mockReset();
  suscripcionDe.mockReset();
  suscripcionDe.mockResolvedValue({ customerId: null, subscriptionId: null });
  soltarSuscripcion.mockReset();
  soltarSuscripcion.mockResolvedValue('ok');
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

describe('qué hace con el plan cada estado de la suscripción', () => {
  it('lo da, lo quita o espera, como dice la guía de Stripe', () => {
    expect(accesoDe('active')).toBe('dar');
    expect(accesoDe('trialing')).toBe('dar');
    // El cobro ha fallado y Stripe lo reintenta: se avisa, no se corta.
    expect(accesoDe('past_due')).toBe('esperar');
    expect(accesoDe('incomplete')).toBe('esperar');
    for (const fuera of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) {
      expect(accesoDe(fuera), fuera).toBe('quitar');
    }
    // Un estado que no conocemos no da ni quita nada.
    expect(accesoDe('inventado')).toBe('esperar');
    expect(accesoDe(undefined)).toBe('esperar');
  });
});

/**
 * Lo que el webhook le pregunta a Stripe antes de dar un plan: cómo está la
 * suscripción **ahora**, que un aviso reintentado puede llegar después de la
 * baja.
 */
describe('cómo está hoy una suscripción', () => {
  it('viva, con el plan del precio que cobra', async () => {
    fetchFalso.mockResolvedValue(contesta(suscripcion('active', 'price_pro')));

    expect(await suscripcionEnStripe('sub_1')).toEqual({
      kind: 'viva',
      status: 'active',
      plan: 'pro',
    });
    const { url, init } = ultimaPeticion();
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(init.method).toBeUndefined();
  });

  it('viva con un precio que no es de ningún plan, o sin elementos: sin plan', async () => {
    fetchFalso.mockResolvedValueOnce(contesta(suscripcion('past_due', 'price_otro')));
    expect(await suscripcionEnStripe('sub_1')).toEqual({
      kind: 'viva',
      status: 'past_due',
      plan: null,
    });

    fetchFalso.mockResolvedValueOnce(contesta({ ...suscripcion('active'), items: undefined }));
    expect(await suscripcionEnStripe('sub_1')).toMatchObject({ kind: 'viva', plan: null });
  });

  it('terminada si está cancelada, caducada sin pagar o Stripe ya no la tiene', async () => {
    for (const estado of ['canceled', 'incomplete_expired']) {
      fetchFalso.mockResolvedValueOnce(contesta(suscripcion(estado)));
      expect(await suscripcionEnStripe('sub_1'), estado).toEqual({ kind: 'terminada' });
    }
    fetchFalso.mockResolvedValueOnce(
      contesta({ error: { type: 'invalid_request_error', code: 'resource_missing' } }, 404),
    );
    expect(await suscripcionEnStripe('sub_1')).toEqual({ kind: 'terminada' });
  });

  it('sin red, con un error de Stripe o sin estado, no se sabe', async () => {
    fetchFalso.mockRejectedValueOnce(new Error('sin red'));
    expect(await suscripcionEnStripe('sub_1')).toEqual({ kind: 'no-se-sabe' });

    fetchFalso.mockResolvedValueOnce(contesta({ error: { type: 'api_error' } }, 500));
    expect(await suscripcionEnStripe('sub_1')).toEqual({ kind: 'no-se-sabe' });

    fetchFalso.mockResolvedValueOnce(contesta({ id: 'sub_1', object: 'subscription' }));
    expect(await suscripcionEnStripe('sub_1')).toEqual({ kind: 'no-se-sabe' });
  });

  // El webhook tiene su propio secreto, y puede estar puesto sin la clave de la
  // API: entonces Stripe contesta 401, y eso tampoco da ni quita nada.
  it('sin clave se pregunta igual, y el 401 es no saber', async () => {
    delete process.env['STRIPE_SECRET_KEY'];
    fetchFalso.mockResolvedValue(contesta({ error: { type: 'invalid_request_error' } }, 401));

    expect(await suscripcionEnStripe('sub_1')).toEqual({ kind: 'no-se-sabe' });
    expect(ultimaPeticion().headers['Authorization']).toBe('Bearer ');
  });
});

describe('cancelar una suscripción que sobra', () => {
  it('con DELETE, y dice si ha dejado de cobrar', async () => {
    fetchFalso.mockResolvedValueOnce(contesta(suscripcion('canceled')));
    expect(await cancelarEnStripe('sub_2')).toBe(true);
    const { url, init } = ultimaPeticion();
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_2');
    expect(init.method).toBe('DELETE');

    fetchFalso.mockResolvedValueOnce(contesta({ error: { code: 'resource_missing' } }, 404));
    expect(await cancelarEnStripe('sub_2')).toBe(true);

    fetchFalso.mockResolvedValueOnce(contesta({ error: { type: 'api_error' } }, 500));
    expect(await cancelarEnStripe('sub_2')).toBe(false);
  });
});

describe('empezar a pagar sin suscripción', () => {
  it('manda un formulario, no JSON', async () => {
    // La API de Stripe no acepta JSON en el cuerpo. Es el fallo más fácil de
    // cometer y el que solo se ve al probarlo de verdad.
    fetchFalso.mockResolvedValue(contesta({ url: 'https://pago' }));

    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'medio' });

    const { headers } = ultimaPeticion();
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('el identificador de la cuenta viaja en la sesión y en la suscripción', async () => {
    // En la sesión, para el aviso de pago; en la suscripción, porque los avisos
    // de después —baja, cambio— llegan con ella y no con la sesión.
    fetchFalso.mockResolvedValue(contesta({ url: 'https://pago' }));

    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'medio' });

    const { url, body } = ultimaPeticion();
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(body.get('mode')).toBe('subscription');
    expect(body.get('client_reference_id')).toBe('u1');
    expect(body.get('metadata[userId]')).toBe('u1');
    expect(body.get('metadata[plan]')).toBe('medio');
    expect(body.get('subscription_data[metadata][userId]')).toBe('u1');
    expect(body.get('subscription_data[metadata][plan]')).toBe('medio');
    expect(body.get('line_items[0][price]')).toBe('price_medio');
    expect(body.get('customer_email')).toBe('a@b.c');
    expect(body.has('customer')).toBe(false);
  });

  it('quien ya pagó alguna vez vuelve con su cliente, no con otro nuevo', async () => {
    // Con `customer_email` Stripe crea un cliente nuevo en cada Checkout, y el
    // portal enseñaría solo las facturas del último.
    suscripcionDe.mockResolvedValue({ customerId: 'cus_viejo', subscriptionId: null });
    fetchFalso.mockResolvedValue(contesta({ url: 'https://pago' }));

    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'medio' });

    const { body } = ultimaPeticion();
    expect(body.get('customer')).toBe('cus_viejo');
    expect(body.has('customer_email')).toBe(false);
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
    fetchFalso.mockResolvedValue(contesta({ error: { type: 'invalid_request_error' } }, 400));

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

  it('sin poder leer la cuenta no se abre ningún cobro', async () => {
    // No se sabría si ya paga, y un Checkout a ciegas es como se cobra dos veces.
    suscripcionDe.mockResolvedValue(null);

    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe('cambiar de plan teniendo ya suscripción', () => {
  beforeEach(() => {
    suscripcionDe.mockResolvedValue({ customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  /**
   * **Lo que cobraba dos veces.** Con suscripción viva, otro Checkout crea otra
   * suscripción y la vieja sigue cobrando. Se manda al portal a confirmar el
   * cambio de precio de la que hay.
   */
  it('no abre otro Checkout: manda al portal a confirmar el precio nuevo', async () => {
    fetchFalso
      .mockResolvedValueOnce(contesta(suscripcion('active')))
      .mockResolvedValueOnce(contesta({ object: 'billing_portal.session', url: 'https://portal' }));

    const result = await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' });

    expect(result).toEqual({ kind: 'ir-a-pagar', url: 'https://portal' });
    const urls = fetchFalso.mock.calls.map((c) => (c as [string])[0]);
    expect(urls).toEqual([
      'https://api.stripe.com/v1/subscriptions/sub_1',
      'https://api.stripe.com/v1/billing_portal/sessions',
    ]);
    const { body } = ultimaPeticion();
    expect(body.get('customer')).toBe('cus_1');
    expect(body.get('flow_data[type]')).toBe('subscription_update_confirm');
    expect(body.get('flow_data[subscription_update_confirm][subscription]')).toBe('sub_1');
    expect(body.get('flow_data[subscription_update_confirm][items][0][id]')).toBe('si_1');
    expect(body.get('flow_data[subscription_update_confirm][items][0][price]')).toBe('price_pro');
    expect(body.get('flow_data[after_completion][type]')).toBe('redirect');
  });

  it('una suscripción que cobra con retraso también es una suscripción viva', async () => {
    fetchFalso
      .mockResolvedValueOnce(contesta(suscripcion('past_due')))
      .mockResolvedValueOnce(contesta({ url: 'https://portal' }));

    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' });

    expect(ultimaPeticion().url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
  });

  it('una ya cancelada, o que Stripe no tiene, se paga de nuevo con Checkout', async () => {
    fetchFalso
      .mockResolvedValueOnce(contesta(suscripcion('canceled')))
      .mockResolvedValueOnce(contesta({ url: 'https://pago' }));
    await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' });
    expect(ultimaPeticion().url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(ultimaPeticion().body.get('customer')).toBe('cus_1');

    fetchFalso
      .mockResolvedValueOnce(
        contesta({ error: { type: 'invalid_request_error', code: 'resource_missing' } }, 404),
      )
      .mockResolvedValueOnce(contesta({ url: 'https://pago' }));
    expect(await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).toEqual({
      kind: 'ir-a-pagar',
      url: 'https://pago',
    });
  });

  it('si no se puede consultar la suscripción, no se abre nada', async () => {
    fetchFalso.mockResolvedValueOnce(contesta({ error: {} }, 500));
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );

    fetchFalso.mockRejectedValueOnce(new Error('sin red'));
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('una suscripción sin cliente o sin elementos no se toca', async () => {
    fetchFalso.mockResolvedValueOnce(contesta({ ...suscripcion('active'), items: { data: [] } }));
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );

    fetchFalso.mockResolvedValueOnce(contesta({ ...suscripcion('active'), customer: null }));
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );

    fetchFalso.mockResolvedValueOnce(contesta({ ...suscripcion('active'), items: undefined }));
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it('si el portal no devuelve dirección, se dice', async () => {
    fetchFalso
      .mockResolvedValueOnce(contesta(suscripcion('active')))
      .mockResolvedValueOnce(contesta({ error: {} }, 400));

    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'pro' })).kind).toBe(
      'error',
    );
  });
});

describe('bajar a gratis', () => {
  it('sin suscripción no se paga ni se llama a Stripe: se baja la fila', async () => {
    const result = await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'gratis' });

    expect(result).toEqual({ kind: 'listo', plan: 'gratis' });
    expect(soltarSuscripcion).toHaveBeenCalledWith('u1');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  /**
   * **Lo que seguía cobrando.** Cancelar bajaba la fila a gratis y a Stripe no se
   * le decía nada, así que cobraba cada mes a quien ya no tenía nada.
   */
  it('con suscripción, primero se cancela en Stripe y después se baja el plan', async () => {
    suscripcionDe.mockResolvedValue({ customerId: 'cus_1', subscriptionId: 'sub_1' });
    fetchFalso.mockResolvedValue(contesta(suscripcion('canceled')));

    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: true });

    const { url, init } = ultimaPeticion();
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(init.method).toBe('DELETE');
    expect(soltarSuscripcion).toHaveBeenCalledWith('u1');
  });

  it('si Stripe no la cancela, el plan no se toca: mejor reintentar que pagar sin plan', async () => {
    suscripcionDe.mockResolvedValue({ customerId: 'cus_1', subscriptionId: 'sub_1' });
    fetchFalso.mockResolvedValueOnce(contesta({ error: {} }, 500));
    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: false });

    fetchFalso.mockRejectedValueOnce(new Error('sin red'));
    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: false });

    expect(soltarSuscripcion).not.toHaveBeenCalled();
  });

  it('una que Stripe ya no tiene es una cancelada: se baja el plan', async () => {
    suscripcionDe.mockResolvedValue({ customerId: 'cus_1', subscriptionId: 'sub_1' });
    fetchFalso.mockResolvedValue(contesta({ error: { code: 'resource_missing' } }, 404));

    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: true });
  });

  it('si no se puede leer la cuenta o bajar el plan, se dice', async () => {
    suscripcionDe.mockResolvedValueOnce(null);
    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: false });

    soltarSuscripcion.mockResolvedValue('error');
    expect(await StripeBilling.cancel({ userId: 'u1' })).toEqual({ ok: false });
    expect((await StripeBilling.start({ userId: 'u1', email: 'a@b.c', plan: 'gratis' })).kind).toBe(
      'error',
    );
  });
});

describe('el portal de cliente', () => {
  it('se abre con el cliente que se guardó al pagar, sin buscarlo por correo', async () => {
    suscripcionDe.mockResolvedValue({ customerId: 'cus_1', subscriptionId: 'sub_1' });
    fetchFalso.mockResolvedValue(contesta({ url: 'https://portal' }));

    const url = await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' });

    expect(url).toBe('https://portal');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const { url: destino, body } = ultimaPeticion();
    expect(destino).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    expect(body.get('customer')).toBe('cus_1');
  });

  it('sin cliente no hay portal, y no se pregunta siquiera', async () => {
    // Es alguien que nunca ha pagado: no hay facturas que enseñarle.
    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
    suscripcionDe.mockResolvedValue(null);
    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('si Stripe no contesta o no trae dirección, tampoco', async () => {
    suscripcionDe.mockResolvedValue({ customerId: 'cus_1', subscriptionId: null });

    fetchFalso.mockResolvedValueOnce(contesta({ error: {} }, 401));
    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();

    fetchFalso.mockResolvedValueOnce(contesta({ url: '' }));
    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();

    fetchFalso.mockRejectedValueOnce(new Error('sin red'));
    expect(await StripeBilling.portal({ userId: 'u1', email: 'a@b.c' })).toBeNull();
  });
});
