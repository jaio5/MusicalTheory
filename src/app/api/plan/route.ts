/**
 * Cambiar de plan.
 *
 * La ruta no cobra: le pide al cobrador que empiece el cambio y devuelve lo que
 * el cobrador diga. Hoy el cobrador es el de mentira y contesta «listo» en el
 * momento; el día que sea Stripe contestará «ir-a-pagar» con una dirección, y
 * esta ruta no cambia ni una línea.
 *
 * Bajarse de plan se pide igual, con `plan: 'gratis'`.
 */

import { NextResponse } from 'next/server';

import { planOf, PLANS } from '@core/billing';
import { authAvailable } from '@server/auth';
import { billing } from '@server/billing';
import { currentSession } from '@server/entitlements';
import { readJsonBody } from '@server/request-body';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const cobrador = billing();
  return NextResponse.json({
    // El catálogo lo sirve el servidor para que la pantalla de planes no tenga
    // que traerse el dominio entero al navegador solo para pintar tres precios.
    plans: PLANS,
    billing: { name: cobrador.name, charges: cobrador.charges },
    accounts: authAvailable(),
  });
}

/**
 * A dónde ir a cambiar la tarjeta o ver las facturas.
 *
 * Es `PUT` y no `GET` porque abrir el portal **crea una sesión** en la pasarela:
 * no es una consulta, aunque lo parezca desde fuera. Un `GET` que crea algo lo
 * acaba creando un rastreador de enlaces.
 *
 * Devuelve 404 cuando no hay adónde ir, que es lo que pasa sin pasarela puesta y
 * también con una cuenta que nunca ha pagado. La pantalla no enseña el enlace en
 * ninguno de los dos casos, así que esto es la red de debajo.
 */
export async function PUT(): Promise<NextResponse> {
  const session = await currentSession();
  if (session === null) {
    return NextResponse.json(
      { error: { code: 'sin-cuenta', message: 'Entra con tu cuenta.' } },
      { status: 401 },
    );
  }

  const url = await billing().portal({
    userId: session.userId,
    email: session.account.email ?? '',
  });

  return url === null
    ? NextResponse.json(
        {
          error: {
            code: 'sin-portal',
            message: 'Aquí no hay facturas todavía: esta cuenta no ha pagado nada.',
          },
        },
        { status: 404 },
      )
    : NextResponse.json({ url });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await currentSession();
  if (session === null) {
    return NextResponse.json(
      {
        error: {
          code: 'sin-cuenta',
          message: 'Entra con tu cuenta para cambiar de plan.',
        },
      },
      { status: 401 },
    );
  }

  const pedido = await readJsonBody(request);

  // `planOf` cae a gratis con lo que no reconoce, así que hay que comprobar
  // aparte que el plan pedido existe de verdad: si no, pedir «premium» bajaría a
  // gratis sin decir nada, que es lo contrario de lo que quería quien lo pidió.
  const plan = PLANS.find((candidate) => candidate.id === pedido['plan']);
  if (plan === undefined) {
    return NextResponse.json(
      { error: { code: 'plan-desconocido', message: 'Ese plan no existe.' } },
      { status: 400 },
    );
  }

  if (plan.id === session.account.plan) {
    return NextResponse.json({ kind: 'listo', plan: plan.id });
  }

  const cobrador = billing();
  const result =
    plan.monthlyCents === 0
      ? await cobrador
          .cancel({ userId: session.userId })
          .then((r) => (r.ok ? { kind: 'listo' as const, plan: plan.id } : null))
      : await cobrador.start({
          userId: session.userId,
          email: session.account.email ?? '',
          plan: plan.id,
        });

  if (result === null || result.kind === 'error') {
    return NextResponse.json(
      {
        error: {
          code: 'no-guardado',
          message: 'No hemos podido cambiar el plan. Vuelve a intentarlo en un minuto.',
        },
      },
      { status: 502 },
    );
  }

  if (result.kind === 'ir-a-pagar') {
    return NextResponse.json(result);
  }

  return NextResponse.json({ kind: 'listo', plan: planOf(result.plan).id });
}
