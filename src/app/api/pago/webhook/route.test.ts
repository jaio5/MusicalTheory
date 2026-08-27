import { beforeEach, describe, expect, it, vi } from 'vitest';

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
 */

const verifyStripeSignature = vi.fn();
const setPlan = vi.fn<(userId: string, plan: string) => Promise<string>>();
const planOfPrice = vi.fn();

vi.mock('@server/billing/stripe-signature', () => ({
  verifyStripeSignature: (...a: unknown[]) => verifyStripeSignature(...a),
}));
vi.mock('@server/users', () => ({
  setPlan: (userId: string, plan: string) => setPlan(userId, plan),
}));
vi.mock('@server/billing', () => ({ planOfPrice: (...a: unknown[]) => planOfPrice(...a) }));

const { POST } = await import('./route');

function aviso(cuerpo: unknown, firma = 'v1=loquesea'): Request {
  return new Request('http://x/api/pago/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': firma },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

/** Lo que manda Stripe cuando alguien termina de pagar. */
const PAGADO = {
  type: 'checkout.session.completed',
  data: {
    object: {
      client_reference_id: 'u1',
      metadata: { userId: 'u1' },
      line_items: { data: [{ price: { id: 'price_medio' } }] },
    },
  },
};

beforeEach(() => {
  verifyStripeSignature.mockReset();
  verifyStripeSignature.mockReturnValue('ok');
  setPlan.mockReset();
  setPlan.mockResolvedValue('ok');
  planOfPrice.mockReset();
  planOfPrice.mockReturnValue('medio');
});

describe('la firma', () => {
  it('se comprueba siempre, con el cuerpo tal y como llegó', async () => {
    // El cuerpo se firma en crudo: interpretarlo antes de comprobar la firma
    // cambiaría los bytes y la comprobación dejaría de valer.
    await POST(aviso(PAGADO));

    expect(verifyStripeSignature).toHaveBeenCalledTimes(1);
    const args = verifyStripeSignature.mock.calls[0]?.[0] as { header: string; body: string };
    expect(args.header).toBe('v1=loquesea');
    expect(args.body).toContain('checkout.session.completed');
  });

  it('si la firma no cuadra, 400 y no se toca la base de datos', async () => {
    // Es lo único que separa este endpoint de que cualquiera se ponga el plan Pro
    // con un `curl`.
    verifyStripeSignature.mockReturnValue('firma');

    const res = await POST(aviso(PAGADO));

    expect(res.status).toBe(400);
    expect(setPlan).not.toHaveBeenCalled();
  });

  it('sin cabecera de firma tampoco pasa', async () => {
    verifyStripeSignature.mockReturnValue('sin-cabecera');

    const res = await POST(
      new Request('http://x/api/pago/webhook', { method: 'POST', body: JSON.stringify(PAGADO) }),
    );

    expect(res.status).toBe(400);
    expect(setPlan).not.toHaveBeenCalled();
  });
});

describe('lo que llega dentro', () => {
  it('un cuerpo que no es JSON se rechaza, con firma buena y todo', async () => {
    const res = await POST(aviso('{esto no'));

    expect(res.status).toBe(400);
    expect(setPlan).not.toHaveBeenCalled();
  });

  it('un aviso que no conoce no cambia nada, y no es un error', async () => {
    // Stripe manda avisos de cosas que no nos importan. Contestar error haría que
    // los reintentara para siempre.
    const res = await POST(aviso({ ...PAGADO, type: 'invoice.created' }));

    expect(res.status).toBe(200);
    expect(setPlan).not.toHaveBeenCalled();
  });

  it('si no se puede guardar el plan, se contesta error para que reintente', async () => {
    // Al revés que el caso de arriba: aquí sí interesa que Stripe vuelva a
    // intentarlo, porque el pago se hizo y el plan no se ha puesto.
    setPlan.mockResolvedValue('error');

    const res = await POST(aviso(PAGADO));

    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('un aviso firmado pero sin cuenta se acepta y se ignora', async () => {
    // Venía firmado, así que es de verdad: reintentarlo no lo va a arreglar, y un
    // 500 haría que Stripe lo repitiera durante días.
    const res = await POST(
      aviso({ ...PAGADO, data: { object: { metadata: {}, line_items: { data: [] } } } }),
    );

    expect(res.status).toBe(200);
    expect(setPlan).not.toHaveBeenCalled();
  });

  it('al cancelar la suscripción se vuelve a gratis', async () => {
    await POST(
      aviso({
        type: 'customer.subscription.deleted',
        data: { object: { metadata: { userId: 'u1' } } },
      }),
    );

    expect(setPlan).toHaveBeenCalledWith('u1', 'gratis');
  });
});
