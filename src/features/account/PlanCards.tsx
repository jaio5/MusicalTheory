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
  type PlanId,
} from '@core/billing';
import { useAccount } from '@state/account';
import { estiloBoton } from '@ui/Button';

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

/**
 * Cómo se llama cada permiso en la pantalla, y en qué orden se leen.
 *
 * **Primero lo que distingue a un plan de los otros dos, y luego lo que
 * comparten.** Al revés, las tres columnas empezaban con las mismas tres líneas
 * —preguntar al profesor, los seis cursos, el avance guardado— y **lo que las
 * diferencia caía por debajo del pliegue**: medido a 1314 por 606, había que
 * desplazarse para poder elegir. Una tabla de precios en la que las tres
 * columnas se leen igual no ayuda a decidir nada.
 *
 * Y están las ocho, no seis. Faltaban **guardar tus canciones** y **las salidas
 * de lo que tocas**, que son justo lo que prometen los reclamos de Básico y de
 * Pro: la tarjeta de Pro no enseñaba su propia razón de ser.
 */
export const ETIQUETAS: ReadonlyArray<{ capability: Capability; label: string }> = [
  { capability: 'ideas', label: 'Ideas de progresión de la IA' },
  { capability: 'versiones', label: 'Salidas de lo que tocas' },
  { capability: 'profesor-con-progreso', label: 'Un profesor que sabe por dónde vas' },
  { capability: 'grado-profesional', label: 'Los seis cursos del Grado Profesional' },
  { capability: 'repaso', label: 'El repaso de lo que fallaste' },
  { capability: 'canciones', label: 'Guardar tus canciones en la cuenta' },
  { capability: 'sincronizar', label: 'El avance guardado en tu cuenta' },
  { capability: 'profesor', label: 'Preguntar al profesor' },
];

/**
 * El que se recomienda, y **por lo que hace y no por lo que elige la gente**.
 *
 * Es Medio porque es donde entra la IA que propone mientras compones, que es la
 * mitad del nombre de esta aplicación: con Básico se aprende y se guarda, y a
 * partir de Medio la aplicación **te contesta mientras escribes**.
 *
 * No dice «el más elegido» ni «el más popular» a propósito: **no se ha vendido
 * ni uno**, así que sería inventarse un dato. Los documentos de este proyecto
 * hablan solo de lo que se puede comprobar, y la pantalla también.
 */
const RECOMENDADO: PlanId = 'medio';

export function PlanCards() {
  const { account } = useAccount();

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PAID_PLANS.map((plan) => (
        <li key={plan.id}>
          <PlanCard
            plan={plan}
            current={planOf(account.plan).id === plan.id}
            recomendado={plan.id === RECOMENDADO}
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
  recomendado,
  model,
}: {
  readonly plan: Plan;
  readonly current: boolean;
  /** Si es el que la pantalla recomienda. */
  readonly recomendado: boolean;
  /** El modelo que hay puesto: de su precio sale el cupo que se enseña. */
  readonly model: string;
}) {
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      aria-current={current}
      className={`flex h-full flex-col p-5 ${current ? 'superficie-viva' : 'superficie'}`}
    >
      <header>
        {/* Arriba del nombre y no al lado: al lado se lee como parte del
            nombre del plan, y esto no lo es.

            **El hueco se reserva en las tres**, aunque solo una lo llene: sin
            esto, la tarjeta recomendada bajaba su nombre y su precio y las tres
            cabeceras dejaban de estar a la misma altura, que es lo que permite
            comparar precios de un vistazo. */}
        <div className="mb-1 min-h-9">
          {recomendado && (
            <p className="text-brass-bright font-mono text-xs">
              El que recomendamos
              <span className="text-text-muted block font-sans text-xs">
                Es donde entra la IA que propone mientras compones.
              </span>
            </p>
          )}
        </div>
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
          <p className="text-brass-bright text-sm font-medium">Es el que tienes</p>
        ) : (
          <Link href={`/planes/${plan.id}`} className={estiloBoton('primary', 'w-full')}>
            Elegir {plan.name}
          </Link>
        )}
      </div>
    </article>
  );
}
