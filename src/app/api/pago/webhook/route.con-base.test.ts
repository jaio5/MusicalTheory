import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DIAS_DE_GRACIA } from '@core/billing';
import { levantarBaseDePrueba, type BaseDePrueba } from '@server/db/para-tests';
import type * as Users from '@server/users';

/**
 * El webhook entero, contra Postgres de verdad y un Stripe de mentira.
 *
 * `route.test.ts` prueba cada decisión de la ruta con la base fingida; esto
 * prueba **las dos carreras** que encontró la revisión, que solo se ven con las
 * dos cosas delante —lo que hay guardado y lo que dice Stripe—:
 *
 * - dos Checkout pagados a la vez, donde el segundo pisaba al primero y lo dejaba
 *   cobrando sin dueño;
 * - un `checkout.session.completed` reintentado después de la baja, que volvía a
 *   dar el plan de una suscripción muerta.
 *
 * La firma es de verdad, con el secreto de pruebas: así no hay nada fingido
 * entre el aviso y la base. Los avisos y las respuestas de Stripe tienen la forma
 * de su documentación (`docs.stripe.com/api/events`, `/api/subscriptions/object`).
 */

const SECRETO = 'whsec_de_pruebas';

let base: BaseDePrueba;
let users: typeof Users;
let POST: (request: Request) => Promise<Response>;

/** Lo que Stripe tiene: el estado de cada suscripción, que cambia al cancelarla. */
let enStripe: Map<string, string>;
const fetchFalso = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function suscripcion(id: string, status: string) {
  return {
    id,
    object: 'subscription',
    customer: 'cus_1',
    status,
    items: {
      object: 'list',
      data: [{ id: `si_${id}`, object: 'subscription_item', price: { id: 'price_medio' } }],
    },
  };
}

function aviso(type: string, object: Record<string, unknown>): Request {
  const body = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', SECRETO).update(`${t}.${body}`).digest('hex');
  return new Request('http://x/api/pago/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
    body,
  });
}

function pagado(userId: string, subscription: string): Request {
  return aviso('checkout.session.completed', {
    id: `cs_${subscription}`,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    client_reference_id: userId,
    customer: 'cus_1',
    subscription,
    metadata: { userId, plan: 'medio' },
  });
}

/** Lo manda como Stripe: lo que no contesta 2xx lo vuelve a mandar. */
async function comoStripe(hacer: () => Request): Promise<Response> {
  for (let intento = 0; intento < 3; intento += 1) {
    const res = await POST(hacer());
    if (res.status < 500) {
      return res;
    }
  }
  throw new Error('Stripe se habría cansado de reintentar');
}

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  users = await import('@server/users');
  ({ POST } = await import('./route'));
});
afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  process.env['STRIPE_WEBHOOK_SECRET'] = SECRETO;
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_loquesea';
  process.env['STRIPE_PRICE_BASICO'] = 'price_basico';
  process.env['STRIPE_PRICE_MEDIO'] = 'price_medio';
  process.env['STRIPE_PRICE_BASICO_ANUAL'] = 'price_basico_anual';
  process.env['STRIPE_PRICE_MEDIO_ANUAL'] = 'price_medio_anual';
  enStripe = new Map();
  fetchFalso.mockReset();
  fetchFalso.mockImplementation(async (url, init) => {
    const id = url.split('/').at(-1) ?? '';
    const status = enStripe.get(id);
    if (status === undefined) {
      return Response.json({ error: { code: 'resource_missing' } }, { status: 404 });
    }
    if (init?.method === 'DELETE') {
      enStripe.set(id, 'canceled');
    }
    return Response.json(suscripcion(id, enStripe.get(id) ?? status));
  });
  vi.stubGlobal('fetch', fetchFalso);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of [
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_BASICO',
    'STRIPE_PRICE_MEDIO',
    'STRIPE_PRICE_BASICO_ANUAL',
    'STRIPE_PRICE_MEDIO_ANUAL',
  ]) {
    delete process.env[k];
  }
});

async function cuenta(): Promise<string> {
  const creada = await users.createUser({
    mayorDe14: true,
    email: 'a@b.c',
    password: 'unaContrasenaLarga',
  });
  if (creada.kind !== 'ok') {
    throw new Error(creada.kind);
  }
  return creada.user.id;
}

describe('dos Checkout pagados a la vez', () => {
  it('se queda una, y la otra se cancela en Stripe para que no cobre', async () => {
    const userId = await cuenta();
    enStripe.set('sub_a', 'active');
    enStripe.set('sub_b', 'active');

    // A la vez, como llegarían; y lo que conteste 500 se reintenta, como Stripe.
    await Promise.all([
      comoStripe(() => pagado(userId, 'sub_a')),
      comoStripe(() => pagado(userId, 'sub_b')),
    ]);

    const guardada = (await users.suscripcionDe(userId))?.subscriptionId;
    expect(['sub_a', 'sub_b']).toContain(guardada);
    const sobrante = guardada === 'sub_a' ? 'sub_b' : 'sub_a';
    expect(enStripe.get(sobrante)).toBe('canceled');
    expect(enStripe.get(guardada ?? '')).toBe('active');
    expect((await users.findUserById(userId))?.plan).toBe('medio');

    // Y la baja de la cancelada, que Stripe manda después, no le quita nada a nadie.
    const baja = await POST(
      aviso('customer.subscription.deleted', suscripcion(sobrante, 'canceled')),
    );
    expect(baja.status).toBe(200);
    expect((await users.findUserById(userId))?.plan).toBe('medio');
    expect((await users.suscripcionDe(userId))?.subscriptionId).toBe(guardada);
  });
});

describe('un pago reintentado después de la baja', () => {
  it('no vuelve a dar el plan de una suscripción muerta', async () => {
    const userId = await cuenta();
    enStripe.set('sub_1', 'active');
    expect((await POST(pagado(userId, 'sub_1'))).status).toBe(200);
    expect((await users.findUserById(userId))?.plan).toBe('medio');

    // Se da de baja en Stripe y llega el aviso.
    enStripe.set('sub_1', 'canceled');
    await POST(aviso('customer.subscription.deleted', suscripcion('sub_1', 'canceled')));
    expect((await users.findUserById(userId))?.plan).toBe('gratis');

    // Y ahora llega, tarde, el reintento del pago.
    const tarde = await POST(pagado(userId, 'sub_1'));

    expect(tarde.status).toBe(200);
    expect((await users.findUserById(userId))?.plan).toBe('gratis');
    expect((await users.suscripcionDe(userId))?.subscriptionId).toBeNull();
  });

  it('pero si la vieja murió sin que llegara su baja, la nueva ocupa su sitio', async () => {
    const userId = await cuenta();
    enStripe.set('sub_1', 'active');
    await POST(pagado(userId, 'sub_1'));

    // Se cancela en Stripe, la baja no llega, y se paga otra.
    enStripe.set('sub_1', 'canceled');
    enStripe.set('sub_2', 'active');
    expect((await POST(pagado(userId, 'sub_2'))).status).toBe(200);

    expect((await users.suscripcionDe(userId))?.subscriptionId).toBe('sub_2');
    expect(enStripe.get('sub_2')).toBe('active');
    expect((await users.findUserById(userId))?.plan).toBe('medio');
  });
});

/**
 * **Los dos ataques al estado de la suscripción** (adr/0114), con la base de
 * verdad.
 */
describe('lo que diga Stripe hoy, y no el aviso', () => {
  it('un updated(active) viejo que llega tras el unpaid no devuelve el plan', async () => {
    const userId = await cuenta();
    enStripe.set('sub_1', 'active');
    await POST(pagado(userId, 'sub_1'));

    // El cobro falla del todo y la suscripción queda `unpaid`.
    enStripe.set('sub_1', 'unpaid');
    await POST(aviso('customer.subscription.updated', suscripcion('sub_1', 'unpaid')));
    expect((await users.findUserById(userId))?.plan).toBe('gratis');

    // Llega tarde un `updated(active)` de antes: su primera entrega dio 500.
    const tarde = await POST(
      aviso('customer.subscription.updated', suscripcion('sub_1', 'active')),
    );

    expect(tarde.status).toBe(200);
    expect((await users.findUserById(userId))?.plan).toBe('gratis');
  });

  /**
   * **`past_due` tenía el plan sin plazo**: dependía de que Stripe estuviera
   * configurado para acabar en `unpaid`. Ahora son `DIAS_DE_GRACIA`, contados
   * desde el primer aviso: los siguientes no los vuelven a dar.
   */
  it('past_due conserva el plan solo durante el plazo de gracia', async () => {
    const userId = await cuenta();
    enStripe.set('sub_1', 'active');
    await POST(pagado(userId, 'sub_1'));

    enStripe.set('sub_1', 'past_due');
    await POST(aviso('customer.subscription.updated', suscripcion('sub_1', 'past_due')));
    expect((await users.findUserById(userId))?.plan).toBe('medio');

    // Ocho días después: otro aviso de `past_due` no reinicia el plazo.
    const haceOcho = new Date(Date.now() - (DIAS_DE_GRACIA + 1) * 86_400_000).toISOString();
    await base.ejecutar(`update users set impagada_desde = '${haceOcho}' where id = '${userId}'`);
    await POST(aviso('customer.subscription.updated', suscripcion('sub_1', 'past_due')));
    expect((await users.findUserById(userId))?.plan).toBe('gratis');

    // Y en cuanto Stripe cobra, el plan vuelve.
    enStripe.set('sub_1', 'active');
    await POST(aviso('customer.subscription.updated', suscripcion('sub_1', 'active')));
    expect((await users.findUserById(userId))?.plan).toBe('medio');
  });
});
