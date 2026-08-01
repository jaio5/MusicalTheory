'use client';

import Link from 'next/link';

import { planAfter, planOf, type PlanId } from '@core/billing';

/**
 * A dónde se va cuando hace falta un plan.
 *
 * Un único sitio decide la dirección y la frase. Antes cada candado se la
 * escribía: el enlace decía «Ver los planes» y llevaba a `/cuenta`, que es otra
 * pantalla —la de quién eres— y allí no hay ni una tarjeta ni un precio. Quien
 * pulsaba se quedaba a un salto de lo que había ido a ver.
 *
 * Está en `ui/` porque lo necesitan tres features —aprender, ideas y la cuenta—
 * y un feature no importa de otro.
 */
export function PlansLink({
  label = 'Ver los tres planes',
  className = '',
}: {
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <Link
      href="/planes"
      className={`text-brass-bright hover:text-brass font-mono text-xs underline ${className}`}
    >
      {label}
    </Link>
  );
}

/**
 * Si enseñar el enlace arregla algo.
 *
 * `plan_required` siempre: la frase acaba de decir en qué plan entra. El cupo
 * gastado solo si queda plan por encima, porque a quien ya está en el último no
 * hay nada que ofrecerle y mandarlo a la lista de precios es hacerle perder el
 * viaje. El resto de errores —el modelo caído, la petición mal formada— no los
 * arregla ningún plan.
 */
export function seArreglaConPlan(code: string | null, plan: PlanId | string): boolean {
  if (code === 'plan_required') {
    return true;
  }
  return code === 'quota_exhausted' && planAfter(planOf(plan).id) !== null;
}
