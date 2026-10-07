/**
 * El webhook de la pasarela: lo que cambia el plan cuando Stripe dice algo.
 *
 * **La firma se comprueba antes que nada, y sin secreto no se acepta nada.** Un
 * webhook sin comprobar es un formulario público para darse un plan de pago: basta
 * con saber la dirección y mandar un JSON. Por eso la comprobación es lo primero
 * que hay en la función y por eso `verifyStripeSignature` está probado aparte.
 *
 * **Y antes de la firma, su cabecera.** Sin ella no hay nada que comprobar, así
 * que se contesta 400 sin leer el cuerpo; y el cuerpo se lee **acotado**
 * (`textoAcotado`): con `request.text()` cualquiera podía mandar cincuenta megas
 * que el servidor juntaba enteros antes de descubrir que la firma no valía.
 *
 * El cuerpo se lee como **texto crudo** y no con `.json()`. No es un detalle: la
 * firma se calcula sobre los bytes que mandó Stripe, y volver a serializar el
 * objeto cambia espacios y orden de claves. Es el fallo clásico de esta
 * integración.
 *
 * Cuatro avisos, con los nombres y campos de la documentación de Stripe
 * (`billing/subscriptions/webhooks`, `api/checkout/sessions/object`):
 *
 * - `checkout.session.completed`: se ha pagado. Trae `client_reference_id`,
 *   `customer`, `subscription` —identificadores, sin expandir—, `payment_status` y
 *   nuestros `metadata`. **No trae `line_items`**: Stripe no los incluye si no se
 *   piden, así que el plan sale de los metadatos que escribimos al crear la
 *   sesión, junto con el precio de ese mismo plan.
 * - `checkout.session.async_payment_succeeded`: lo mismo, cuando el pago tardó.
 * - `customer.subscription.updated`: cambio de precio, de estado o renovación.
 * - `customer.subscription.deleted`: se acabó.
 *
 * De los dos últimos solo se usa **qué suscripción es**: el estado y el precio se
 * le preguntan a Stripe (`alCambiar`, adr/0114), porque el aviso dice cómo estaba
 * al mandarse y puede llegar días tarde.
 *
 * Es idempotente sin llevar registro de eventos vistos, porque lo único que hace
 * es poner un plan: ponerlo dos veces deja lo mismo. Stripe reintenta los
 * webhooks que no contesta 2xx, así que esto pasa de verdad.
 *
 * **El orden, que Stripe no garantiza, no se le deja al aviso.** Los de la
 * suscripción se aplican a quien la tenga guardada, y una que ya se soltó no
 * encuentra a nadie. El del pago, en cambio, trae el nombre de la cuenta, y por sí
 * solo no sabe si llega tarde: un `checkout.session.completed` reintentado después
 * de la baja volvía a dar el plan de una suscripción muerta. Por eso, antes de
 * vincular, **se le pregunta a Stripe cómo está ahora** (`suscripcionEnStripe`), y
 * una terminada no da nada.
 *
 * **Y una cuenta tiene una suscripción, no dos.** Con dos Checkout pagados a la
 * vez, el segundo aviso pisaba al primero: aquella seguía cobrando y sus avisos ya
 * no encontraban a nadie. Ahora el segundo no pisa (`vincularSuscripcion`): si la
 * guardada sigue viva, **la nueva se cancela en Stripe** y se deja escrito en el
 * registro; si está muerta, la nueva ocupa su sitio.
 */

import { NextResponse } from 'next/server';

import { DIAS_DE_GRACIA, planOf, type PlanId } from '@core/billing';
import { accesoDe } from '@server/billing';
import { cancelarEnStripe, suscripcionEnStripe } from '@server/billing/stripe';
import { verifyStripeSignature } from '@server/billing/stripe-signature';
import { textoAcotado } from '@server/request-body';
import {
  marcarImpago,
  planDeSuscripcion,
  vincularSuscripcion,
  type SetPlanResult,
} from '@server/users';

export const runtime = 'nodejs';

/** Los avisos que nos importan. Todo lo demás se acepta y se ignora. */
const PAGADO = 'checkout.session.completed';
const PAGADO_MAS_TARDE = 'checkout.session.async_payment_succeeded';
const CAMBIADA = 'customer.subscription.updated';
const BORRADA = 'customer.subscription.deleted';

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

/** Una cadena con algo dentro, o nulo. */
function texto(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * A quién le toca el pago.
 *
 * Sale de `client_reference_id` o de los metadatos de la sesión, que es lo que se
 * mandó al crearla. **No se busca por correo**: un correo se cambia, y dos
 * cuentas pueden acabar con el mismo si algún día se permite cambiarlo.
 */
function userIdOf(session: unknown): string | null {
  return texto(get(session, 'client_reference_id')) ?? texto(get(session, 'metadata', 'userId'));
}

/**
 * El plan de una sesión pagada, de los metadatos que escribimos al crearla.
 *
 * Es de fiar porque solo este servidor crea sesiones —hace falta la clave— y las
 * crea con el precio de ese mismo plan. El precio no viene en el aviso.
 */
function planDeLaSesion(session: unknown): PlanId | null {
  const guardado = get(session, 'metadata', 'plan');
  // Por `planOf`, que entiende los nombres viejos: una sesión abierta antes de
  // fundir Pro en Medio (adr/0104) dice `pro` y tiene que dar Medio, no nada. Lo
  // que no es un plan de pago no da nada: `planOf` lo deja en gratis.
  const plan = planOf(guardado);
  return plan.monthlyCents > 0 ? plan.id : null;
}

/**
 * Si el dinero de esta sesión ha entrado.
 *
 * `paid`, o `no_payment_required` —un periodo de prueba o un cobro diferido—. Con
 * `unpaid` la sesión está completa pero el dinero no: un adeudo bancario tarda
 * días, y para eso llega `async_payment_succeeded` cuando entra.
 */
function cobrada(session: unknown): boolean {
  const estado = get(session, 'payment_status');
  return estado === 'paid' || estado === 'no_payment_required';
}

/**
 * Qué contestarle a Stripe según lo que pasara al escribir.
 *
 * **Stripe reintenta lo que no contesta 2xx**, así que el estado no es
 * decoración: es lo que decide si ese evento vuelve mañana. Solo se pide
 * reintento cuando reintentar puede arreglarlo.
 *
 * Una cuenta que ya no está es el caso que enseñó esto: devolvía 500 y el evento
 * se quedaba en la cola de reintentos durante días sin que nunca fuera a salir
 * bien. Se vio al ejecutar el webhook por primera vez.
 */
/**
 * Que Stripe lo vuelva a mandar: **el único 500 de la ruta**, y solo para lo que
 * reintentar puede arreglar —no se ha podido escribir, o no se ha podido
 * preguntar a Stripe—.
 *
 * Una función y no una respuesta guardada: el cuerpo de una respuesta se lee una
 * vez, y la misma servida a dos avisos llegaría vacía al segundo.
 */
function reintentar(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 500 });
}

function respuestaDe(resultado: SetPlanResult, plan: PlanId): NextResponse {
  switch (resultado) {
    case 'ok':
      return NextResponse.json({ ok: true, plan });
    case 'no-existe':
      return NextResponse.json({ ignorado: 'esa cuenta ya no está' });
    default:
      // Aquí sí: no se ha podido escribir, y el reintento es lo que queremos.
      return reintentar('no guardado');
  }
}

/** Lo que hace un pago confirmado: plan, cliente y suscripción, juntos. */
async function alPagar(session: unknown): Promise<NextResponse> {
  if (!cobrada(session)) {
    // 200 a propósito: el aviso es de verdad, solo que el dinero aún no ha
    // entrado. Llegará otro cuando entre.
    return NextResponse.json({ ignorado: 'sin cobrar todavía' });
  }
  const userId = userIdOf(session);
  const plan = planDeLaSesion(session);
  const customerId = texto(get(session, 'customer'));
  const subscriptionId = texto(get(session, 'subscription'));
  if (userId === null || plan === null || customerId === null || subscriptionId === null) {
    // 200 a propósito: el evento venía firmado y es de verdad, así que
    // reintentarlo no lo va a arreglar. Un 500 haría que Stripe lo repitiera
    // durante días.
    return NextResponse.json({ ignorado: 'sin cuenta, sin plan o sin suscripción' });
  }

  // Cómo está ahora, y no cómo estaba al mandar el aviso.
  const ahora = await suscripcionEnStripe(subscriptionId);
  if (ahora.kind === 'no-se-sabe') {
    return reintentar('no se ha podido consultar');
  }
  if (ahora.kind === 'terminada') {
    // 200: es un aviso viejo de una suscripción que ya no cobra. Reintentarlo
    // no lo va a arreglar, y vincularla daría un plan que nadie paga.
    return NextResponse.json({ ignorado: 'esa suscripción ya ha terminado' });
  }
  // El plan, del precio que cobra hoy: si se cambió en el portal después del
  // pago, el aviso repetido devolvería el de entonces. Y una que ha dejado de
  // cobrar sin terminar —`unpaid`, `paused`— se vincula, para que su vuelta a
  // `active` encuentre a su dueño, pero sin plan de pago.
  const hoy = accesoDe(ahora.status) === 'quitar' ? 'gratis' : (ahora.plan ?? plan);
  const pago = { plan: hoy, customerId, subscriptionId };

  const vinculo = await vincularSuscripcion(userId, pago);
  if (vinculo.kind !== 'otra') {
    return respuestaDe(vinculo.kind, hoy);
  }
  return conOtraGuardada(userId, pago, vinculo.guardada);
}

/**
 * La cuenta ya tenía otra suscripción guardada: o esa está muerta y la nueva
 * ocupa su sitio, o esa sigue cobrando y la nueva se cancela.
 *
 * Cancelar la nueva y no la vieja porque la vieja es la que la cuenta conoce: la
 * que cancela el botón de «Cuenta» y la que encuentran los avisos. Quedarse con
 * la nueva dejaría la vieja cobrando sin que nada de aquí la viera.
 */
async function conOtraGuardada(
  userId: string,
  pago: { plan: PlanId; customerId: string; subscriptionId: string },
  guardada: string,
): Promise<NextResponse> {
  const vieja = await suscripcionEnStripe(guardada);
  if (vieja.kind === 'no-se-sabe') {
    return reintentar('no se ha podido consultar');
  }
  if (vieja.kind === 'terminada') {
    // Su baja aún no ha llegado, o se perdió. La nueva ocupa su sitio, solo si
    // sigue siendo esa la guardada: si ha cambiado entre medias, sale «otra» y se
    // reintenta.
    const vinculo = await vincularSuscripcion(userId, pago, { reemplaza: guardada });
    return vinculo.kind === 'otra'
      ? reintentar('ha cambiado entre medias')
      : respuestaDe(vinculo.kind, pago.plan);
  }

  if (!(await cancelarEnStripe(pago.subscriptionId))) {
    // Sin cancelar, la nueva sigue cobrando: que Stripe lo repita y se vuelva a
    // intentar.
    return reintentar('no se ha podido cancelar la que sobra');
  }
  // Al registro, con identificadores y nada más: es lo que hace falta para
  // devolver el primer cobro de la cancelada desde el panel de Stripe, que
  // cancelar no lo devuelve.
  console.warn(
    `[cobro] la cuenta ${userId} ya pagaba ${guardada}: se ha cancelado ${pago.subscriptionId}, que llegó después. Su primer cobro no se ha devuelto.`,
  );
  return NextResponse.json({ ignorado: 'ya tenía otra suscripción: la nueva se ha cancelado' });
}

/**
 * Lo que diga Stripe de una suscripción **hoy**, aplicado a quien la tenga.
 *
 * **No se fía del estado que trae el aviso** (adr/0114), igual que `alPagar`.
 * Stripe no garantiza el orden y reintenta durante días lo que no se contesta
 * 2xx: un `customer.subscription.updated` con `active` cuya primera entrega falló
 * llegaba después del `unpaid` y le devolvía el plan a quien había dejado de
 * pagar. El aviso solo dice **cuál**; cómo está, se le pregunta a Stripe.
 *
 * - **Terminada** —`canceled`, `incomplete_expired` o que ya no existe—: gratis,
 *   y se suelta. Da igual qué aviso fuera.
 * - **`unpaid` o `paused`**: gratis, sin soltar, para que su vuelta a `active`
 *   encuentre a su dueño.
 * - **`past_due`**: empieza el plazo de gracia (`marcarImpago`), y pasado
 *   `DIAS_DE_GRACIA` la cuenta se lee como gratis. Antes conservaba el plan sin
 *   plazo, y dependía de cómo estuviera configurado Stripe.
 * - **`active` o `trialing`**: el plan de su precio de hoy, y se acaba la gracia.
 * - **No se sabe**: 500, y Stripe lo reintenta.
 */
async function alCambiar(subscription: unknown): Promise<NextResponse> {
  const id = texto(get(subscription, 'id'));
  if (id === null) {
    return NextResponse.json({ ignorado: 'sin suscripción' });
  }

  const ahora = await suscripcionEnStripe(id);
  if (ahora.kind === 'no-se-sabe') {
    return reintentar('no se ha podido consultar');
  }
  if (ahora.kind === 'terminada') {
    return respuestaDe(await planDeSuscripcion(id, 'gratis', { soltar: true }), 'gratis');
  }

  const acceso = accesoDe(ahora.status);
  if (acceso === 'quitar') {
    return respuestaDe(await planDeSuscripcion(id, 'gratis', { soltar: false }), 'gratis');
  }
  if (acceso === 'esperar') {
    if (ahora.status !== 'past_due') {
      // `incomplete`: el primer cobro aún no ha entrado, y llegará otro aviso.
      return NextResponse.json({ ignorado: `estado ${ahora.status}` });
    }
    const marcada = await marcarImpago(id, new Date());
    return marcada === 'ok'
      ? NextResponse.json({ ok: true, gracia: DIAS_DE_GRACIA })
      : respuestaDe(marcada, 'gratis');
  }

  if (ahora.plan === null) {
    return NextResponse.json({ ignorado: 'precio que no es de ningún plan' });
  }
  return respuestaDe(await planDeSuscripcion(id, ahora.plan, { soltar: false }), ahora.plan);
}

export async function POST(request: Request): Promise<NextResponse> {
  const header = request.headers.get('stripe-signature');
  if (header === null || header === '') {
    // Sin cabecera no hay firma que comprobar: no se lee ni un byte del cuerpo.
    return NextResponse.json({ error: 'firma' }, { status: 400 });
  }

  const body = await textoAcotado(request);
  if (body === null) {
    // Ningún aviso de Stripe se acerca al tope, que es de 128 KB.
    return NextResponse.json({ error: 'cuerpo' }, { status: 400 });
  }

  const verdict = verifyStripeSignature({
    body,
    header,
    secret: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
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

  switch (type) {
    case PAGADO:
    case PAGADO_MAS_TARDE:
      return alPagar(object);
    // Los dos por el mismo camino: lo que manda es lo que diga Stripe hoy, no
    // qué aviso ha llegado.
    case CAMBIADA:
    case BORRADA:
      return alCambiar(object);
    default:
      // Todo lo demás se acepta y se ignora. Stripe manda decenas de tipos de
      // evento, y contestar error a los que no nos importan los pone en cola de
      // reintentos para siempre.
      return NextResponse.json({ ignorado: type });
  }
}
