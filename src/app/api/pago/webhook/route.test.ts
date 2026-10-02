import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El webhook del cobro: por donde entra alguien que no es tu navegador.
 *
 * Es la ruta con la superficie más peligrosa de todas, porque **la llama
 * internet**, no la aplicación. Sin comprobar la firma, cualquiera que sepa la
 * dirección se pone el plan Pro con un `curl`.
 *
 * La comprobación criptográfica está probada aparte
 * (`server/billing/stripe-signature.test.ts`); lo que se prueba aquí es que la
 * ruta **la use**, que se plante cuando falla, y que no toque la base de datos
 * hasta que la firma cuadre.
 *
 * **Los avisos tienen la forma que documenta Stripe, y nada más.** El test de
 * antes se inventaba un `metadata.userId` en la suscripción borrada —que Stripe
 * no mandaba, porque se ponía en la sesión— y una `line_items` en la sesión
 * pagada —que Stripe no incluye si no se pide—, y por eso pasaba con un webhook
 * que en la vida real ignoraba las bajas. Lo de abajo sale de
 * `docs.stripe.com/api/checkout/sessions/object` y `/api/subscriptions/object`,
 * recortado a los campos que se leen y alguno que no, para que se note que se
 * ignoran.
 */

const verifyStripeSignature = vi.fn();
const vincularSuscripcion =
  vi.fn<(userId: string, pago: unknown, o?: unknown) => Promise<{ kind: string; guardada?: string }>>();
const planDeSuscripcion = vi.fn<(id: string, plan: string, o: unknown) => Promise<string>>();

vi.mock('@server/billing/stripe-signature', () => ({
  verifyStripeSignature: (...a: unknown[]) => verifyStripeSignature(...a),
}));
vi.mock('@server/users', () => ({
  vincularSuscripcion: (u: string, p: unknown, o?: unknown) =>
    o === undefined ? vincularSuscripcion(u, p) : vincularSuscripcion(u, p, o),
  planDeSuscripcion: (id: string, plan: string, o: unknown) => planDeSuscripcion(id, plan, o),
  setPlan: vi.fn(),
}));

const { POST } = await import('./route');

function aviso(cuerpo: unknown, firma: string | null = 't=1,v1=loquesea'): Request {
  return new Request('http://x/api/pago/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(firma === null ? {} : { 'stripe-signature': firma }),
    },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

/** Un evento de Stripe: `id`, `object`, `type` y el objeto en `data.object`. */
function evento(type: string, object: Record<string, unknown>) {
  return { id: 'evt_1', object: 'event', api_version: '2025-03-31.basil', type, data: { object } };
}

/** La sesión que llega con `checkout.session.completed`, recortada. */
function sesion(cambios: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    client_reference_id: 'u1',
    customer: 'cus_1',
    customer_email: 'a@b.c',
    subscription: 'sub_1',
    metadata: { userId: 'u1', plan: 'medio' },
    ...cambios,
  };
}

/** La suscripción que llega con `customer.subscription.*`, recortada. */
function suscripcion(status: string, price = 'price_pro') {
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

const PAGADO = evento('checkout.session.completed', sesion());

/**
 * Stripe de mentira: lo que contesta `GET /v1/subscriptions/:id` y `DELETE` de
 * lo mismo, con la forma de su documentación. Por defecto, cada suscripción
 * está `active` con el precio del plan medio.
 */
const fetchFalso = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
let enStripe: Record<string, { status: number; body: unknown }> = {};

function contesta(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Las peticiones que se le han hecho a Stripe, como «MÉTODO id». */
function peticiones(): string[] {
  return fetchFalso.mock.calls.map(
    ([url, init]) => `${init?.method ?? 'GET'} ${url.split('/').at(-1) ?? ''}`,
  );
}

beforeEach(() => {
  verifyStripeSignature.mockReset();
  verifyStripeSignature.mockReturnValue('ok');
  vincularSuscripcion.mockReset();
  vincularSuscripcion.mockResolvedValue({ kind: 'ok' });
  planDeSuscripcion.mockReset();
  planDeSuscripcion.mockResolvedValue('ok');
  process.env['STRIPE_PRICE_BASICO'] = 'price_basico';
  process.env['STRIPE_PRICE_MEDIO'] = 'price_medio';
  process.env['STRIPE_PRICE_PRO'] = 'price_pro';
  enStripe = {};
  fetchFalso.mockReset();
  fetchFalso.mockImplementation(async (url, init) => {
    const id = url.split('/').at(-1) ?? '';
    const hay = enStripe[id] ?? { status: 200, body: { ...suscripcion('active', 'price_medio'), id } };
    if (init?.method === 'DELETE' && hay.status === 200) {
      return contesta({ ...(hay.body as object), status: 'canceled' });
    }
    return contesta(hay.body, hay.status);
  });
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of ['STRIPE_PRICE_BASICO', 'STRIPE_PRICE_MEDIO', 'STRIPE_PRICE_PRO']) {
    delete process.env[k];
  }
});

describe('la firma', () => {
  it('se comprueba siempre, con el cuerpo tal y como llegó', async () => {
    // El cuerpo se firma en crudo: interpretarlo antes de comprobar la firma
    // cambiaría los bytes y la comprobación dejaría de valer.
    await POST(aviso(PAGADO));

    expect(verifyStripeSignature).toHaveBeenCalledTimes(1);
    const args = verifyStripeSignature.mock.calls[0]?.[0] as { header: string; body: string };
    expect(args.header).toBe('t=1,v1=loquesea');
    expect(args.body).toBe(JSON.stringify(PAGADO));
  });

  it('si la firma no cuadra, 400 y no se toca la base de datos', async () => {
    // Es lo único que separa este endpoint de que cualquiera se ponga el plan Pro
    // con un `curl`.
    verifyStripeSignature.mockReturnValue('firma');

    const res = await POST(aviso(PAGADO));

    expect(res.status).toBe(400);
    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });

  it('sin cabecera de firma, 400 sin leer el cuerpo', async () => {
    const sinFirma = aviso(PAGADO, null);

    const res = await POST(sinFirma);

    expect(res.status).toBe(400);
    expect(sinFirma.bodyUsed).toBe(false);
    expect(verifyStripeSignature).not.toHaveBeenCalled();

    expect((await POST(aviso(PAGADO, ''))).status).toBe(400);
  });

  it('un cuerpo enorme se corta sin juntarlo entero, aunque traiga firma', async () => {
    // Antes `request.text()` se tragaba lo que le mandaran antes de mirar la firma.
    const res = await POST(aviso('x'.repeat(200 * 1024)));

    expect(res.status).toBe(400);
    expect(verifyStripeSignature).not.toHaveBeenCalled();
  });
});

describe('lo que llega dentro', () => {
  it('un cuerpo que no es JSON se rechaza, con firma buena y todo', async () => {
    const res = await POST(aviso('{esto no'));

    expect(res.status).toBe(400);
    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });

  it('un aviso que no conoce no cambia nada, y no es un error', async () => {
    // Stripe manda avisos de cosas que no nos importan. Contestar error haría que
    // los reintentara para siempre.
    const res = await POST(aviso(evento('invoice.created', { id: 'in_1', object: 'invoice' })));

    expect(res.status).toBe(200);
    expect(vincularSuscripcion).not.toHaveBeenCalled();
    expect(planDeSuscripcion).not.toHaveBeenCalled();
  });
});

describe('se ha pagado', () => {
  it('guarda el plan, el cliente y la suscripción de la sesión', async () => {
    const res = await POST(aviso(PAGADO));

    expect(res.status).toBe(200);
    expect(vincularSuscripcion).toHaveBeenCalledWith('u1', {
      plan: 'medio',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });
  });

  it('sin `client_reference_id`, de los metadatos de la sesión', async () => {
    await POST(aviso(evento('checkout.session.completed', sesion({ client_reference_id: null }))));

    expect(vincularSuscripcion).toHaveBeenCalledWith('u1', expect.anything());
  });

  /**
   * **`payment_status` se mira.** Con un adeudo bancario la sesión se completa y
   * el dinero tarda días: subir el plan entonces es regalarlo si el cobro falla.
   */
  it('una sesión completa sin cobrar todavía no sube nada', async () => {
    const res = await POST(
      aviso(evento('checkout.session.completed', sesion({ payment_status: 'unpaid' }))),
    );

    expect(res.status).toBe(200);
    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });

  it('y cuando el cobro tardío entra, sí', async () => {
    await POST(aviso(evento('checkout.session.async_payment_succeeded', sesion())));

    expect(vincularSuscripcion).toHaveBeenCalledTimes(1);
  });

  it('sin pago pendiente —un periodo de prueba— también cuenta como cobrada', async () => {
    await POST(
      aviso(
        evento('checkout.session.completed', sesion({ payment_status: 'no_payment_required' })),
      ),
    );

    expect(vincularSuscripcion).toHaveBeenCalledTimes(1);
  });

  it('sin cuenta, sin plan o sin suscripción se acepta y se ignora', async () => {
    // Venía firmado, así que es de verdad: reintentarlo no lo va a arreglar, y un
    // 500 haría que Stripe lo repitiera durante días.
    for (const roto of [
      sesion({ client_reference_id: null, metadata: {} }),
      sesion({ metadata: { userId: 'u1', plan: 'raro' } }),
      sesion({ subscription: null }),
      sesion({ customer: '' }),
    ]) {
      const res = await POST(aviso(evento('checkout.session.completed', roto)));
      expect(res.status).toBe(200);
    }
    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });
});

/**
 * **Lo que el aviso no sabe.** Un `checkout.session.completed` cuenta cómo
 * estaba la suscripción al pagarse, y Stripe lo reintenta durante días y sin
 * orden. Antes de vincular se le pregunta a Stripe cómo está ahora.
 */
describe('antes de vincular, cómo está la suscripción ahora', () => {
  it('se pregunta a Stripe por la suscripción del aviso', async () => {
    await POST(aviso(PAGADO));

    expect(peticiones()).toEqual(['GET sub_1']);
  });

  /** El hallazgo: el pago reintentado después de la baja volvía a dar el plan. */
  it('un pago repetido después de la baja no vuelve a dar el plan', async () => {
    enStripe['sub_1'] = { status: 200, body: suscripcion('canceled') };

    const res = await POST(aviso(PAGADO));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignorado: 'esa suscripción ya ha terminado' });
    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });

  it('ni si caducó sin pagarse, ni si Stripe ya no la tiene', async () => {
    enStripe['sub_1'] = { status: 200, body: suscripcion('incomplete_expired') };
    expect((await POST(aviso(PAGADO))).status).toBe(200);

    enStripe['sub_1'] = {
      status: 404,
      body: { error: { type: 'invalid_request_error', code: 'resource_missing' } },
    };
    expect((await POST(aviso(PAGADO))).status).toBe(200);

    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });

  it('si Stripe no contesta, no se decide a ciegas: que lo reintente', async () => {
    enStripe['sub_1'] = { status: 500, body: { error: { type: 'api_error' } } };

    expect((await POST(aviso(PAGADO))).status).toBe(500);
    expect(vincularSuscripcion).not.toHaveBeenCalled();
  });

  it('el plan es el del precio que cobra hoy, no el de los metadatos de entonces', async () => {
    enStripe['sub_1'] = { status: 200, body: suscripcion('active', 'price_pro') };

    await POST(aviso(PAGADO));

    expect(vincularSuscripcion).toHaveBeenCalledWith('u1', {
      plan: 'pro',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });
  });

  it('con un precio que no es de ningún plan, el de los metadatos', async () => {
    enStripe['sub_1'] = { status: 200, body: suscripcion('trialing', 'price_otro') };

    await POST(aviso(PAGADO));

    expect(vincularSuscripcion).toHaveBeenCalledWith('u1', expect.objectContaining({ plan: 'medio' }));
  });

  // Sin pagar pero sin terminar: se vincula, para que su vuelta a `active`
  // encuentre a su dueño, pero sin plan de pago.
  it('una que ha dejado de cobrar sin terminar se vincula en gratis', async () => {
    enStripe['sub_1'] = { status: 200, body: suscripcion('unpaid') };

    const res = await POST(aviso(PAGADO));

    expect(await res.json()).toEqual({ ok: true, plan: 'gratis' });
    expect(vincularSuscripcion).toHaveBeenCalledWith('u1', expect.objectContaining({ plan: 'gratis' }));
  });
});

/**
 * **Dos Checkout a la vez.** El segundo aviso pisaba la suscripción del primero:
 * aquella seguía cobrando y sus avisos no encontraban a nadie.
 */
describe('la cuenta ya tenía otra suscripción', () => {
  beforeEach(() => {
    vincularSuscripcion.mockResolvedValueOnce({ kind: 'otra', guardada: 'sub_viejo' });
  });

  it('si la otra sigue viva, la nueva se cancela en Stripe y queda en el registro', async () => {
    const registro = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await POST(aviso(PAGADO));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ignorado: 'ya tenía otra suscripción: la nueva se ha cancelado',
    });
    expect(peticiones()).toEqual(['GET sub_1', 'GET sub_viejo', 'DELETE sub_1']);
    expect(vincularSuscripcion).toHaveBeenCalledTimes(1);
    expect(registro).toHaveBeenCalledTimes(1);
    expect(registro.mock.calls[0]?.[0]).toContain('sub_viejo');
    expect(registro.mock.calls[0]?.[0]).toContain('sub_1');
    // Identificadores y nada más: ni correo ni nombre.
    expect(registro.mock.calls[0]?.[0]).not.toContain('a@b.c');
  });

  it('si no se puede cancelar la nueva, que Stripe lo reintente', async () => {
    fetchFalso.mockImplementation(async (url, init) =>
      init?.method === 'DELETE'
        ? contesta({ error: { type: 'api_error' } }, 500)
        : contesta({ ...suscripcion('active'), id: url.split('/').at(-1) }),
    );

    expect((await POST(aviso(PAGADO))).status).toBe(500);
  });

  it('si la otra está muerta, la nueva ocupa su sitio', async () => {
    enStripe['sub_viejo'] = { status: 200, body: suscripcion('canceled') };

    const res = await POST(aviso(PAGADO));

    expect(await res.json()).toEqual({ ok: true, plan: 'medio' });
    expect(vincularSuscripcion).toHaveBeenLastCalledWith(
      'u1',
      { plan: 'medio', customerId: 'cus_1', subscriptionId: 'sub_1' },
      { reemplaza: 'sub_viejo' },
    );
    expect(peticiones()).not.toContain('DELETE sub_1');
  });

  it('si entre medias la guardada ha vuelto a cambiar, se reintenta', async () => {
    enStripe['sub_viejo'] = { status: 404, body: { error: { code: 'resource_missing' } } };
    vincularSuscripcion.mockResolvedValueOnce({ kind: 'otra', guardada: 'sub_tercera' });

    expect((await POST(aviso(PAGADO))).status).toBe(500);
  });

  it('si no se sabe cómo está la otra, tampoco se decide', async () => {
    enStripe['sub_viejo'] = { status: 500, body: { error: { type: 'api_error' } } };

    expect((await POST(aviso(PAGADO))).status).toBe(500);
    expect(peticiones()).not.toContain('DELETE sub_1');
  });
});

describe('cambia la suscripción', () => {
  it('activa con otro precio: el plan de ese precio, que es lo que se cobra', async () => {
    // Pasa al confirmar en el portal el cambio de plan que manda `start`.
    await POST(aviso(evento('customer.subscription.updated', suscripcion('active', 'price_pro'))));

    expect(planDeSuscripcion).toHaveBeenCalledWith('sub_1', 'pro', { soltar: false });
  });

  it('activa pero sin elementos, o un aviso sin objeto, no cambia nada', async () => {
    const sinElementos = { ...suscripcion('active'), items: undefined };
    expect((await POST(aviso(evento('customer.subscription.updated', sinElementos)))).status).toBe(
      200,
    );
    expect((await POST(aviso({ type: 'customer.subscription.updated' }))).status).toBe(200);

    expect(planDeSuscripcion).not.toHaveBeenCalled();
  });

  it('un precio que no es de ningún plan no cambia nada', async () => {
    const res = await POST(
      aviso(evento('customer.subscription.updated', suscripcion('active', 'price_otro'))),
    );

    expect(res.status).toBe(200);
    expect(planDeSuscripcion).not.toHaveBeenCalled();
  });

  /**
   * **`past_due` no corta**: el cobro ha fallado y Stripe lo reintenta, y su guía
   * pide avisar, no quitar el acceso. **`unpaid` sí**: los reintentos se agotaron.
   */
  it('con el cobro reintentándose no se toca; sin pagar, se baja a gratis', async () => {
    await POST(aviso(evento('customer.subscription.updated', suscripcion('past_due'))));
    expect(planDeSuscripcion).not.toHaveBeenCalled();

    await POST(aviso(evento('customer.subscription.updated', suscripcion('unpaid'))));
    // Sin soltarla: si se paga, vuelve a `active` y tiene que encontrar a su dueño.
    expect(planDeSuscripcion).toHaveBeenCalledWith('sub_1', 'gratis', { soltar: false });
  });

  it('cancelada en un cambio también baja, y se suelta', async () => {
    await POST(aviso(evento('customer.subscription.updated', suscripcion('canceled'))));

    expect(planDeSuscripcion).toHaveBeenCalledWith('sub_1', 'gratis', { soltar: true });
  });

  it('sin identificador se acepta y se ignora', async () => {
    const res = await POST(
      aviso(evento('customer.subscription.updated', { object: 'subscription' })),
    );

    expect(res.status).toBe(200);
    expect(planDeSuscripcion).not.toHaveBeenCalled();
  });
});

describe('se acaba la suscripción', () => {
  /**
   * **La baja que se ignoraba.** El aviso trae la suscripción, y el
   * identificador de la cuenta estaba en la sesión: «sin cuenta», 200, y el plan
   * de pago se quedaba para siempre. Ahora se busca por la suscripción guardada.
   */
  it('baja a gratis a quien la tenía, sin mirar metadatos', async () => {
    const sinMetadatos = { ...suscripcion('canceled'), metadata: {} };

    await POST(aviso(evento('customer.subscription.deleted', sinMetadatos)));

    expect(planDeSuscripcion).toHaveBeenCalledWith('sub_1', 'gratis', { soltar: true });
  });
});

describe('qué se le contesta a Stripe', () => {
  it('una cuenta que ya no está se acepta: reintentarlo no lo va a arreglar', async () => {
    // Es el caso que enseñó esto: devolvía 500 y el evento se quedaba en la cola
    // de reintentos durante días sin que nunca fuera a salir bien.
    vincularSuscripcion.mockResolvedValue({ kind: 'no-existe' });

    const respuesta = await POST(aviso(PAGADO));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ ignorado: 'esa cuenta ya no está' });
  });

  it('si no se puede guardar, se contesta error para que reintente', async () => {
    // Al revés que el caso de arriba: aquí sí interesa que Stripe vuelva a
    // intentarlo, porque el pago se hizo y el plan no se ha puesto.
    vincularSuscripcion.mockResolvedValue({ kind: 'error' });
    expect((await POST(aviso(PAGADO))).status).toBe(500);

    planDeSuscripcion.mockResolvedValue('error');
    const baja = evento('customer.subscription.deleted', suscripcion('canceled'));
    expect((await POST(aviso(baja))).status).toBe(500);
  });

  it('una suscripción que nadie tiene guardada se acepta y se ignora', async () => {
    // Un aviso viejo que llega tarde, de una suscripción que ya se soltó.
    planDeSuscripcion.mockResolvedValue('no-existe');

    const respuesta = await POST(
      aviso(evento('customer.subscription.updated', suscripcion('active'))),
    );

    expect(respuesta.status).toBe(200);
  });
});
