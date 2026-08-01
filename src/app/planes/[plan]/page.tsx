import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PAID_PLANS, planOf, priceLabel } from '@core/billing';
import { Checkout } from '@features/account';

import { AppShell } from '../../AppShell';

/**
 * La ventana de pago de un plan.
 *
 * Solo existe para los planes **de pago**: `/planes/gratis` no es una compra, es lo
 * que tienes, y ofrecer una ventana de pago para el plan gratis sería una pantalla
 * que no puede terminar en nada. Un identificador que no sea uno de los tres da 404,
 * que es la verdad: esa dirección no existe.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ plan: string }>;
}): Promise<Metadata> {
  const { plan: id } = await params;
  const plan = PAID_PLANS.find((candidate) => candidate.id === planOf(id).id);
  if (plan === undefined) {
    return { title: 'Plan no encontrado · Caos ordenado' };
  }
  return {
    title: `Plan ${plan.name} · Caos ordenado`,
    description: `${plan.name}, ${priceLabel(plan.id)}. ${plan.claim}`,
  };
}

/** Las tres direcciones se conocen de antemano, así que se generan las tres. */
export function generateStaticParams(): Array<{ plan: string }> {
  return PAID_PLANS.map((plan) => ({ plan: plan.id }));
}

export default async function PlanConcreto({ params }: { params: Promise<{ plan: string }> }) {
  const { plan: id } = await params;
  // `planOf` acepta los nombres viejos, así que un enlace guardado a
  // /planes/estudiante sigue llevando a Básico en vez de a un 404.
  const plan = PAID_PLANS.find((candidate) => candidate.id === planOf(id).id);
  if (plan === undefined) {
    notFound();
  }

  return (
    <AppShell>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 md:p-8">
          <h1 className="text-text mb-6 text-3xl">Plan {plan.name}</h1>
          <Checkout plan={plan} />
        </div>
      </div>
    </AppShell>
  );
}
