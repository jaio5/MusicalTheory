/**
 * El cobrador de verdad.
 *
 * Habla con la API de Stripe por HTTP, sin el SDK. Son dos llamadas —crear una
 * sesión de Checkout y cancelar una suscripción— y la comprobación de la firma
 * del webhook, que está en `stripe-signature.ts`. Meter el SDK entero por eso
 * sería una dependencia más que actualizar y auditar, y es la misma razón por la
 * que las contraseñas usan `scrypt` de Node y no bcrypt.
 *
 * **Aquí no se cambia ningún plan.** `start` manda a pagar y termina; quien
 * cambia el plan es el webhook, cuando Stripe confirma que el dinero ha entrado.
 * Cambiarlo antes convertiría «he pulsado pagar» en «he pagado, y eso es
 * exactamente lo que se evita teniendo una pasarela.
 */

import type { PlanId } from '@core/billing';

import { appUrl } from '../app-url';
import { setPlan } from '../users';

import type { Billing, StartResult } from './port';

const API = 'https://api.stripe.com/v1';

/**
 * Qué precio de Stripe corresponde a cada plan.
 *
 * Los identificadores viven en el entorno y no en el código: son distintos en la
 * cuenta de pruebas y en la de verdad, y tenerlos escritos aquí obligaría a un
 * despliegue para cambiarlos y garantizaría que algún día se cobra en la cuenta
 * equivocada.
 */
function priceIdOf(plan: PlanId): string | null {
  const byPlan: Readonly<Record<string, string | undefined>> = {
    basico: process.env['STRIPE_PRICE_BASICO'],
    medio: process.env['STRIPE_PRICE_MEDIO'],
    pro: process.env['STRIPE_PRICE_PRO'],
  };
  const price = byPlan[plan];
  return price === undefined || price === '' ? null : price;
}

/** El plan que corresponde a un precio. Es lo que traduce el webhook. */
export function planOfPrice(priceId: unknown): PlanId | null {
  if (typeof priceId !== 'string' || priceId === '') {
    return null;
  }
  for (const plan of ['basico', 'medio', 'pro'] as const) {
    if (priceIdOf(plan) === priceId) {
      return plan;
    }
  }
  return null;
}

/** Si están puestas las variables que hacen falta para cobrar de verdad. */
export function stripeConfigured(): boolean {
  const key = process.env['STRIPE_SECRET_KEY'];
  return (
    typeof key === 'string' &&
    key !== '' &&
    (['basico', 'medio', 'pro'] as const).every((plan) => priceIdOf(plan) !== null)
  );
}

/**
 * Una llamada a la API de Stripe.
 *
 * Con `application/x-www-form-urlencoded`, que es lo que espera: la API de
 * Stripe no acepta JSON en el cuerpo.
 */
async function stripeFetch(
  path: string,
  form: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const key = process.env['STRIPE_SECRET_KEY'] ?? '';
  try {
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Una consulta a la API de Stripe. Los parámetros van en la dirección. */
async function stripeGet(
  path: string,
  query: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const key = process.env['STRIPE_SECRET_KEY'] ?? '';
  try {
    const response = await fetch(`${API}${path}?${new URLSearchParams(query).toString()}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const StripeBilling: Billing = {
  name: 'Stripe',
  charges: true,

  async start({
    userId,
    email,
    plan,
  }: {
    userId: string;
    email: string;
    plan: PlanId;
  }): Promise<StartResult> {
    // Bajar de plan no se paga: se cancela lo que hay y se queda en gratis.
    if (plan === 'gratis') {
      return (await this.cancel({ userId })).ok
        ? { kind: 'listo', plan: 'gratis' }
        : { kind: 'error', reason: 'no se ha podido cancelar la suscripción' };
    }

    const price = priceIdOf(plan);
    if (price === null) {
      return { kind: 'error', reason: 'ese plan no tiene precio configurado' };
    }

    const session = await stripeFetch('/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      customer_email: email,
      // El identificador de la cuenta viaja de ida y vuelta: es lo único que
      // permite al webhook saber a quién cambiarle el plan. Sin esto habría que
      // buscar por correo, y un correo se cambia.
      client_reference_id: userId,
      'metadata[userId]': userId,
      'metadata[plan]': plan,
      success_url: `${appUrl()}/cuenta?pago=hecho`,
      cancel_url: `${appUrl()}/planes/${plan}?pago=cancelado`,
    });

    const url = session?.['url'];
    return typeof url === 'string' && url !== ''
      ? { kind: 'ir-a-pagar', url }
      : { kind: 'error', reason: 'la pasarela no ha devuelto una dirección de pago' };
  },

  async cancel({ userId }: { userId: string }): Promise<{ ok: boolean }> {
    // El plan baja aquí y no se espera al webhook a propósito: quien cancela
    // deja de tener acceso ya, y si la llamada a Stripe fallara, lo peligroso
    // sería seguir dándole el plan de pago.
    return { ok: await setPlan(userId, 'gratis') };
  },

  /**
   * El portal de cliente de Stripe: cambiar la tarjeta, ver las facturas.
   *
   * Se busca el cliente **por correo** y no se guarda su identificador en
   * nuestra base de datos. Es una consulta más por visita a cambio de una
   * columna menos que mantener sincronizada, y esta pantalla se abre muy de
   * tarde en tarde. El día que se abra a menudo, la columna se añade.
   *
   * Sin cliente en Stripe no hay portal: es alguien que nunca ha pagado, y
   * mandarlo a una página vacía sería peor que no enseñar el enlace.
   */
  async portal({ email }: { userId: string; email: string }): Promise<string | null> {
    if (email === '') {
      return null;
    }

    const clientes = await stripeGet('/customers', { email, limit: '1' });
    const primero = Array.isArray(clientes?.['data']) ? clientes['data'][0] : undefined;
    const customer = (primero as { id?: unknown } | undefined)?.id;
    if (typeof customer !== 'string' || customer === '') {
      return null;
    }

    const session = await stripeFetch('/billing_portal/sessions', {
      customer,
      return_url: `${appUrl()}/cuenta`,
    });
    const url = session?.['url'];
    return typeof url === 'string' && url !== '' ? url : null;
  },
};
