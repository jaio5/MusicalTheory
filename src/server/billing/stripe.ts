/**
 * El cobrador de verdad.
 *
 * Habla con la API de Stripe por HTTP, sin el SDK: crear una sesión de Checkout,
 * leer y cancelar una suscripción y abrir el portal, más la comprobación de la
 * firma del webhook, que está en `stripe-signature.ts`. Meter el SDK entero por
 * eso sería una dependencia más que actualizar y auditar, y es la misma razón por
 * la que las contraseñas usan `scrypt` de Node y no bcrypt.
 *
 * **Aquí no se sube ningún plan.** `start` manda a pagar y termina; quien sube el
 * plan es el webhook, cuando Stripe confirma que el dinero ha entrado. Subirlo
 * antes convertiría «he pulsado pagar» en «he pagado», y eso es exactamente lo
 * que se evita teniendo una pasarela. Bajarlo sí se baja aquí, al cancelar, y
 * solo después de que Stripe haya dejado de cobrar.
 *
 * **Nada de esto se ha ejecutado contra Stripe.** Los nombres de los campos y de
 * los estados salen de su documentación (`docs.stripe.com/api`, 2 de octubre de
 * 2026), y los tests comprueban la petición que se construye y qué se hace con lo
 * que conteste; que Stripe la acepte pide una clave de pruebas
 * (`docs/PARA-PUBLICAR.md`).
 */

import type { PlanId } from '@core/billing';

import { appUrl } from '../app-url';
import { soltarSuscripcion, suscripcionDe } from '../users';

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
 * Qué se hace con el plan según el estado de la suscripción en Stripe.
 *
 * Es lo que recomienda su guía de suscripciones (`billing/subscriptions/webhooks`):
 * se da el plan con `active` y `trialing`; se quita con `canceled` y `unpaid`, y
 * con `incomplete_expired` y `paused`, que tampoco cobran. Con `past_due` y
 * `incomplete` **no se toca nada**: el cobro ha fallado y Stripe lo está
 * reintentando, y su guía pide avisar a quien paga, no cortarle. Si los
 * reintentos se agotan, llega `unpaid` o `canceled` y entonces sí.
 *
 * Cualquier estado que no conozcamos tampoco toca nada: un estado nuevo de
 * Stripe no puede dar ni quitar planes por su cuenta.
 */
export function accesoDe(status: unknown): 'dar' | 'quitar' | 'esperar' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'dar';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'quitar';
    default:
      return 'esperar';
  }
}

/**
 * Si una suscripción ya no puede volver a cobrar.
 *
 * Son los dos estados terminales de Stripe. Con cualquier otro la suscripción
 * sigue ahí, y abrir un Checkout nuevo sería cobrar dos veces.
 */
function terminada(status: unknown): boolean {
  return status === 'canceled' || status === 'incomplete_expired';
}

interface Contestado {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

/**
 * Ir a la API de Stripe y volver con lo que diga, o con nulo si no se ha podido.
 *
 * Nulo es la red caída o un cuerpo que no es JSON. **El estado se devuelve**, y no
 * solo «ha ido bien»: un 404 al buscar una suscripción no es un fallo, es que ya
 * no existe, y eso cambia lo que se hace después.
 *
 * La clave se lee en cada llamada y no al cargar el módulo, porque en desarrollo
 * el `.env` puede aparecer después de que Next haya importado esto.
 */
async function stripeIrY(url: string, init: RequestInit): Promise<Contestado | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        // Sin clave se manda vacía y Stripe contesta 401, que es «no se ha podido»:
        // le pasa al webhook, que puede tener su secreto sin tener la clave.
        Authorization: `Bearer ${process.env['STRIPE_SECRET_KEY'] ?? ''}`,
        ...init.headers,
      },
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** Si Stripe ha contestado que sí. */
function bien(respuesta: Contestado | null): respuesta is Contestado {
  return respuesta !== null && respuesta.status >= 200 && respuesta.status < 300;
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
  method = 'POST',
): Promise<Contestado | null> {
  return stripeIrY(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
}

/** Una consulta a la API de Stripe. */
async function stripeGet(path: string): Promise<Contestado | null> {
  return stripeIrY(`${API}${path}`, {});
}

/** La dirección de una sesión que contesta Stripe, o nulo si no la trae. */
function urlDe(respuesta: Contestado | null): string | null {
  const url = bien(respuesta) ? respuesta.body['url'] : undefined;
  return typeof url === 'string' && url !== '' ? url : null;
}

function primerElemento(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const items = body['items'] as { data?: unknown } | undefined;
  const primero: unknown = Array.isArray(items?.data) ? items.data[0] : undefined;
  return typeof primero === 'object' && primero !== null
    ? (primero as Record<string, unknown>)
    : undefined;
}

/**
 * Lo que Stripe dice hoy de una suscripción, para el webhook.
 *
 * - `terminada`: `canceled` o `incomplete_expired`, o un 404 —ya no existe—. No
 *   vuelve a cobrar, así que no da plan a nadie.
 * - `viva`: cualquier otro estado, con el plan de su precio si es de alguno.
 * - `no-se-sabe`: la red, o Stripe contestando otra cosa. No se decide nada a
 *   ciegas: el webhook contesta error y Stripe lo reintenta.
 *
 * Existe porque **un aviso no dice cómo está la suscripción ahora**, sino cómo
 * estaba cuando se mandó, y Stripe reintenta los que no se contestan durante
 * días y sin respetar el orden: un `checkout.session.completed` repetido después
 * de la baja volvía a dar el plan de una suscripción muerta.
 */
export type SuscripcionEnStripe =
  | { readonly kind: 'terminada' }
  | { readonly kind: 'viva'; readonly status: string; readonly plan: PlanId | null }
  | { readonly kind: 'no-se-sabe' };

export async function suscripcionEnStripe(id: string): Promise<SuscripcionEnStripe> {
  const respuesta = await stripeGet(`/subscriptions/${encodeURIComponent(id)}`);
  if (respuesta?.status === 404) {
    return { kind: 'terminada' };
  }
  const status = bien(respuesta) ? respuesta.body['status'] : undefined;
  if (typeof status !== 'string') {
    return { kind: 'no-se-sabe' };
  }
  if (terminada(status)) {
    return { kind: 'terminada' };
  }
  const precio = primerElemento((respuesta as Contestado).body)?.['price'] as
    { id?: unknown } | undefined;
  return { kind: 'viva', status, plan: planOfPrice(precio?.id) };
}

/**
 * Cancela una suscripción en Stripe ya, sin esperar al final del periodo.
 *
 * Dice si ha dejado de cobrar: un 404 también, que es que ya no existía.
 */
export async function cancelarEnStripe(id: string): Promise<boolean> {
  const cancelada = await stripeFetch(`/subscriptions/${encodeURIComponent(id)}`, {}, 'DELETE');
  return cancelada?.status === 404 || bien(cancelada);
}

/**
 * Cambiar de un plan de pago a otro, sin un segundo Checkout.
 *
 * **Abrir otro Checkout teniendo ya suscripción cobraba dos veces**: Stripe crea
 * una suscripción nueva y la vieja sigue cobrando. Lo que se hace es mandar al
 * portal a confirmar el cambio de precio de la suscripción que ya hay —el flujo
 * `subscription_update_confirm`—, que es donde Stripe enseña el prorrateo, cobra la
 * diferencia y pide la autenticación de la tarjeta si hace falta. El plan nuevo
 * llega luego con `customer.subscription.updated`.
 *
 * Pide que el portal esté configurado para cambiar de plan con esos precios
 * (`docs/DESPLIEGUE.md`).
 */
async function cambiarDePlan(
  suscripcion: Contestado,
  subscriptionId: string,
  price: string,
): Promise<StartResult> {
  const customer = suscripcion.body['customer'];
  const item = primerElemento(suscripcion.body)?.['id'];
  if (typeof customer !== 'string' || typeof item !== 'string') {
    return { kind: 'error', reason: 'la suscripción no tiene la forma esperada' };
  }
  const portal = await stripeFetch('/billing_portal/sessions', {
    customer,
    return_url: `${appUrl()}/cuenta`,
    'flow_data[type]': 'subscription_update_confirm',
    'flow_data[subscription_update_confirm][subscription]': subscriptionId,
    'flow_data[subscription_update_confirm][items][0][id]': item,
    'flow_data[subscription_update_confirm][items][0][price]': price,
    'flow_data[subscription_update_confirm][items][0][quantity]': '1',
    'flow_data[after_completion][type]': 'redirect',
    'flow_data[after_completion][redirect][return_url]': `${appUrl()}/cuenta?pago=hecho`,
  });
  const url = urlDe(portal);
  return url === null
    ? { kind: 'error', reason: 'la pasarela no ha devuelto una dirección para cambiar de plan' }
    : { kind: 'ir-a-pagar', url };
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

    // Sin poder leer la cuenta no se sabe si ya paga, y entonces no se abre nada:
    // un Checkout a ciegas es justo como se cobra dos veces.
    const cuenta = await suscripcionDe(userId);
    if (cuenta === null) {
      return { kind: 'error', reason: 'no se ha podido leer la cuenta' };
    }

    if (cuenta.subscriptionId !== null) {
      const id = cuenta.subscriptionId;
      const suscripcion = await stripeGet(`/subscriptions/${encodeURIComponent(id)}`);
      // 404 es una suscripción que Stripe ya no tiene: se paga de nuevo. Cualquier
      // otra cosa que no sea un sí es no saber, y no saber no abre otro cobro.
      if (suscripcion?.status !== 404) {
        if (!bien(suscripcion)) {
          return { kind: 'error', reason: 'no se ha podido consultar la suscripción' };
        }
        if (!terminada(suscripcion.body['status'])) {
          return cambiarDePlan(suscripcion, id, price);
        }
      }
    }

    const session = await stripeFetch('/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      // El cliente de antes si lo hay, para que el portal enseñe todas sus
      // facturas; si no, el correo con el que Stripe creará uno.
      ...(cuenta.customerId === null ? { customer_email: email } : { customer: cuenta.customerId }),
      // El identificador de la cuenta viaja de ida y vuelta: es lo que permite al
      // webhook saber a quién subirle el plan. Sin esto habría que buscar por
      // correo, y un correo se cambia.
      client_reference_id: userId,
      'metadata[userId]': userId,
      'metadata[plan]': plan,
      // **Y en la suscripción también.** Los metadatos de la sesión se quedan en la
      // sesión: la suscripción que crea nace sin ellos, y los avisos de después —el
      // de baja, el de cambio— llegan con la suscripción. Así se ve de quién es
      // desde el panel de Stripe.
      'subscription_data[metadata][userId]': userId,
      'subscription_data[metadata][plan]': plan,
      success_url: `${appUrl()}/cuenta?pago=hecho`,
      cancel_url: `${appUrl()}/planes/${plan}?pago=cancelado`,
    });

    const url = urlDe(session);
    return url === null
      ? { kind: 'error', reason: 'la pasarela no ha devuelto una dirección de pago' }
      : { kind: 'ir-a-pagar', url };
  },

  async cancel({ userId }: { userId: string }): Promise<{ ok: boolean }> {
    const cuenta = await suscripcionDe(userId);
    if (cuenta === null) {
      return { ok: false };
    }

    // **Primero se para el cobro, y solo luego se baja el plan.** Antes se bajaba
    // el plan y no se le decía nada a Stripe, que seguía cobrando cada mes a quien
    // ya no tenía nada. Si Stripe no contesta, no se toca la fila: mejor que quien
    // cancela vuelva a intentarlo que dejarle pagando sin plan. Un 404 es que ya
    // no existe, y eso es lo que se quería.
    if (cuenta.subscriptionId !== null && !(await cancelarEnStripe(cuenta.subscriptionId))) {
      return { ok: false };
    }

    return { ok: (await soltarSuscripcion(userId)) === 'ok' };
  },

  /**
   * El portal de cliente de Stripe: cambiar la tarjeta, ver las facturas.
   *
   * Con el cliente que se guardó al pagar, y no buscándolo por correo como antes:
   * Checkout con `customer_email` crea un cliente nuevo cada vez, así que la
   * búsqueda devolvía uno cualquiera de los de ese correo, y un correo puede
   * cambiar.
   *
   * Sin cliente no hay portal: es alguien que nunca ha pagado, y mandarlo a una
   * página vacía sería peor que no enseñar el enlace.
   */
  async portal({ userId }: { userId: string; email: string }): Promise<string | null> {
    const customer = (await suscripcionDe(userId))?.customerId ?? null;
    if (customer === null) {
      return null;
    }

    return urlDe(
      await stripeFetch('/billing_portal/sessions', {
        customer,
        return_url: `${appUrl()}/cuenta`,
      }),
    );
  },
};
