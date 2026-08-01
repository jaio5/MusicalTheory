'use client';

import Link from 'next/link';

import {
  can,
  dailyAiRequests,
  monthlyAiRequests,
  PAID_PLANS,
  planOf,
  priceLabel,
  type Capability,
  type Plan,
} from '@core/billing';
import { useAccount } from '@state/account';

/**
 * Los tres planes de pago, uno al lado del otro.
 *
 * Solo los de pago: el plan gratis no es una opción que se elija, es lo que
 * tienes, y ponerlo aquí como una cuarta columna haría que la decisión pareciera
 * de cuatro cuando es de tres. Lo que hay sin pagar se cuenta aparte, en prosa.
 *
 * Lo que enseña cada tarjeta sale de la tabla de permisos, no de una lista escrita
 * a mano: si mañana Medio deja de incluir el repaso, esto lo dice sin que nadie se
 * acuerde de venir a cambiarlo. Una tabla de precios que miente es peor que no
 * tenerla, y la forma de que mienta es escribirla dos veces.
 *
 * Y no se paga desde aquí: cada tarjeta lleva a su ventana. Un botón que cobra
 * dentro de una lista de tres se pulsa por error.
 */

/** Cómo se llama cada permiso en la pantalla, y en qué orden se leen. */
export const ETIQUETAS: ReadonlyArray<{ capability: Capability; label: string }> = [
  { capability: 'profesor', label: 'Preguntar al profesor' },
  { capability: 'grado-profesional', label: 'Los seis cursos del Grado Profesional' },
  { capability: 'sincronizar', label: 'El avance guardado en tu cuenta' },
  { capability: 'repaso', label: 'El repaso de lo que fallaste' },
  { capability: 'ideas', label: 'Ideas de progresión de la IA' },
  { capability: 'profesor-con-progreso', label: 'Un profesor que sabe por dónde vas' },
];

export function PlanCards() {
  const { account } = useAccount();

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PAID_PLANS.map((plan) => (
        <li key={plan.id}>
          <PlanCard
            plan={plan}
            current={planOf(account.plan).id === plan.id}
            model={account.aiModel}
          />
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  plan,
  current,
  model,
}: {
  readonly plan: Plan;
  readonly current: boolean;
  /** El modelo que hay puesto: de su precio sale el cupo que se enseña. */
  readonly model: string;
}) {
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      aria-current={current}
      className={`flex h-full flex-col border p-4 ${
        current ? 'border-brass-bright bg-surface-raised' : 'border-border bg-surface'
      }`}
    >
      <header>
        <h3
          id={`plan-${plan.id}`}
          className={`text-xl ${current ? 'text-brass-bright' : 'text-text'}`}
        >
          {plan.name}
        </h3>
        <p className="text-text mt-1 font-mono text-lg">{priceLabel(plan.id)}</p>
        <p className="text-text-muted mt-2 text-sm">{plan.claim}</p>
      </header>

      <ul className="mt-4 flex grow flex-col gap-1">
        {ETIQUETAS.map(({ capability, label }) => {
          const incluido = can(plan.id, capability);
          return (
            <li
              key={capability}
              className={`flex items-baseline gap-2 text-sm ${
                incluido ? 'text-text' : 'text-text-muted line-through'
              }`}
            >
              {/* El símbolo lleva su significado al lado en el texto, así que el
                  lector de pantalla no necesita leerlo. */}
              <span aria-hidden="true" className={incluido ? 'text-tube-bright' : ''}>
                {incluido ? '✓' : '·'}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
        {/* El cupo no está escrito en la tabla de planes: se calcula desde el
            precio del plan y el del modelo. Así el número que se promete aquí es
            exactamente el dinero que hay para gastar, y no puede separarse de él. */}
        <li className="text-brass-bright mt-2 font-mono text-sm">
          {monthlyAiRequests(plan.id, model)} peticiones a la IA al mes
          <span className="text-text-muted block text-xs">
            hasta {dailyAiRequests(plan.id, model)} en un mismo día
          </span>
        </li>
      </ul>

      <div className="mt-4">
        {current ? (
          <p className="text-brass-bright font-mono text-sm">Es el que tienes</p>
        ) : (
          <Link
            href={`/planes/${plan.id}`}
            className="bg-brass text-background hover:bg-brass-bright inline-flex w-full items-center justify-center rounded-md px-5 py-2.5 text-base transition-colors"
          >
            Elegir {plan.name}
          </Link>
        )}
      </div>
    </article>
  );
}
