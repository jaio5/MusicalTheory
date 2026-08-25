/**
 * El webhook de la pasarela: lo que cambia el plan cuando el dinero ha entrado.
 *
 * **La firma se comprueba antes que nada, y sin secreto no se acepta nada.** Un
 * webhook sin comprobar es un formulario público para darse el plan Pro: basta
 * con saber la dirección y mandar un JSON. Por eso la comprobación es lo primero
 * que hay en la función y por eso `verifyStripeSignature` está probado aparte.
 *
 * El cuerpo se lee como **texto crudo** con `request.text()` y no con `.json()`.
 * No es un detalle: la firma se calcula sobre los bytes que mandó Stripe, y
 * volver a serializar el objeto cambia espacios y orden de claves. Es el fallo
 * clásico de esta integración.
 *
 * Es idempotente sin llevar registro de eventos vistos, porque lo único que hace
 * es poner un plan: ponerlo dos veces deja lo mismo. Stripe reintenta los
 * webhooks que no contesta 2xx, así que esto pasa de verdad.
 */

import { NextResponse } from 'next/server';

import type { PlanId } from '@core/billing';
import { planOfPrice } from '@server/billing';
import { verifyStripeSignature } from '@server/billing/stripe-signature';
import { setPlan } from '@server/users';

export const runtime = 'nodejs';

/** Los eventos que nos importan. Todo lo demás se acepta y se ignora. */
const CAMBIA_A_PAGO = 'checkout.session.completed';
const CAMBIA_A_GRATIS = 'customer.subscription.deleted';

function get(value: unknown, ...path: readonly string[]): unknown {
  let actual = value;
  for (const key of path) {
    if (typeof actual !== 'object' || actual === null) {
      return undefined;
    }
    actual = (actual as Record<string, unknown>)[key];
  }
  return actual;
}

/**
 * A quién le toca el cambio.
 *
 * Sale de `client_reference_id` o de los metadatos, que es lo que se mandó al
 * crear la sesión. **No se busca por correo**: un correo se cambia, y dos
 * cuentas pueden acabar con el mismo si algún día se permite cambiarlo.
 */
function userIdOf(object: unknown): string | null {
  for (const candidate of [get(object, 'client_reference_id'), get(object, 'metadata', 'userId')]) {
    if (typeof candidate === 'string' && candidate !== '') {
      return candidate;
    }
  }
  return null;
}

/**
 * Qué plan se ha pagado.
 *
 * Del precio primero, porque es lo que Stripe sabe que se ha cobrado, y de los
 * metadatos solo como respaldo: los metadatos los escribimos nosotros al crear
 * la sesión y el precio lo pone la pasarela. Si los dos se contradijeran, manda
 * lo que se ha cobrado.
 */
function planOf(object: unknown): PlanId | null {
  const porPrecio = planOfPrice(get(object, 'line_items', 'data', '0', 'price', 'id'));
  if (porPrecio !== null) {
    return porPrecio;
  }
  const enMetadatos = get(object, 'metadata', 'plan');
  return enMetadatos === 'basico' || enMetadatos === 'medio' || enMetadatos === 'pro'
    ? enMetadatos
    : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
  const body = await request.text();

  const verdict = verifyStripeSignature({
    body,
    header: request.headers.get('stripe-signature'),
    secret,
    now: Math.floor(Date.now() / 1000),
  });

  if (verdict !== 'ok') {
    // Un 400 y nada más. Decir cuál de los tres motivos ha fallado le diría a
    // quien está probando si el secreto existe, si la firma tiene la forma buena
    // o si es la marca de tiempo lo que sobra.
    return NextResponse.json({ error: 'firma' }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'cuerpo' }, { status: 400 });
  }

  const type = get(event, 'type');
  const object = get(event, 'data', 'object');

  if (type === CAMBIA_A_PAGO) {
    const userId = userIdOf(object);
    const plan = planOf(object);
    if (userId === null || plan === null) {
      // 200 a propósito: el evento venía firmado y es de verdad, así que
      // reintentarlo no lo va a arreglar. Un 500 haría que Stripe lo repitiera
      // durante días.
      return NextResponse.json({ ignorado: 'sin cuenta o sin plan' });
    }
    return (await setPlan(userId, plan))
      ? NextResponse.json({ ok: true, plan })
      : // Aquí sí 500: no se ha podido escribir, y el reintento de Stripe es
        // justo lo que queremos que pase.
        NextResponse.json({ error: 'no guardado' }, { status: 500 });
  }

  if (type === CAMBIA_A_GRATIS) {
    const userId = userIdOf(object);
    if (userId === null) {
      return NextResponse.json({ ignorado: 'sin cuenta' });
    }
    return (await setPlan(userId, 'gratis'))
      ? NextResponse.json({ ok: true, plan: 'gratis' })
      : NextResponse.json({ error: 'no guardado' }, { status: 500 });
  }

  // Todo lo demás se acepta y se ignora. Stripe manda decenas de tipos de
  // evento, y contestar error a los que no nos importan los pone en cola de
  // reintentos para siempre.
  return NextResponse.json({ ignorado: type });
}
