import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PAID_PLANS, planOf, priceLabel } from '@core/billing';
import { Checkout, ElPlanEntreLosTres } from '@features/account';
import { billing } from '@server/billing';
import { Screen } from '@ui/Screen';

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
      {/* El marco común y no uno propio: esta pantalla llevaba su `h1` en la sans,
          la columna centrada y la vuelta como un enlace de doce píxeles al final,
          y era la única de las nueve que no se parecía a las demás (adr/0060).
          Es de `lectura`: un plan se lee y se confirma. **Lo que se compara va al
          lado** (`aside`), los tres planes con el que miras encendido: sin eso, a
          1920 la pantalla usaba el 40 % del ancho, y para dudar entre dos había
          que volver a la lista y perder el que se había elegido. */}
      <Screen
        title={`Plan ${plan.name}`}
        back={{ href: '/planes', label: 'Planes' }}
        ancho="lectura"
        aside={<ElPlanEntreLosTres plan={plan} />}
      >
        {/* Si se cobra de verdad lo decide el cobrador que haya puesto, y se
            pregunta aquí porque `server/` solo lo abre `app/`. */}
        {/* Media pantalla como mucho, desde `md`: con `lectura` lo principal mide lo
            que mide su contenido, y el resumen mide 44 rem. A 769 px dejaba al
            lado una columna de doscientos y los precios saliéndose por el borde. */}
        <div className="md:max-w-[calc(50vw-3rem)]">
          <Checkout plan={plan} charges={billing().charges} />
        </div>
      </Screen>
    </AppShell>
  );
}
