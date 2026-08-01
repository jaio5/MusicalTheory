'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { can, monthlyAiRequests, planOf, priceLabel, type Plan } from '@core/billing';
import { changePlan, useAccount } from '@state/account';
import { Button } from '@ui/Button';

import { AccessForm } from './AccessForm';
import { ETIQUETAS } from './PlanCards';

/**
 * La ventana de pagar un plan concreto.
 *
 * Una pantalla por plan y no un botón en una lista: aquí se está a punto de gastar
 * dinero todos los meses, y eso merece una pantalla que diga qué plan, cuánto, y
 * qué se abre exactamente. Es también donde entra quien no tiene cuenta, porque no
 * hay a quién cobrarle sin cuenta y mandarle a otra dirección a registrarse le hace
 * perder el plan que había elegido.
 *
 * **No hay formulario de tarjeta, y no es un olvido.** Detrás del cambio de plan
 * hay una interfaz de facturación cuya única implementación de hoy no cobra nada
 * (`server/billing/fake.ts`). Pintar aquí unos campos de tarjeta que no llevan a
 * ninguna pasarela sería un decorado que se parece demasiado a un cobro de verdad.
 * Cuando haya pasarela, la respuesta del servidor traerá una dirección y esta
 * pantalla saldrá hacia ella; el hueco está hecho y está probado.
 */
export function Checkout({ plan }: { readonly plan: Plan }) {
  const router = useRouter();
  const { account, accounts, signedIn, refresh } = useAccount();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const actual = planOf(account.plan);
  const yaEsTuyo = actual.id === plan.id;
  const esSubida = plan.monthlyCents > actual.monthlyCents;

  async function activar(): Promise<void> {
    setError(null);
    setWorking(true);
    try {
      const result = await changePlan(plan.id);
      if (result.kind === 'ir-a-pagar') {
        // El día que haya pasarela, aquí se sale a pagar. Hoy no ocurre nunca.
        window.location.assign(result.url);
        return;
      }
      if (result.kind === 'error') {
        setError(result.message);
        return;
      }
      await refresh();
      setDone(true);
      // El plan lo lee el servidor al pintar, así que hay que pedirle que vuelva a
      // hacerlo: sin esto, el resto de la aplicación seguiría con el plan de antes.
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  if (done || yaEsTuyo) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-tube-bright font-mono text-xs tracking-widest uppercase">
            {done ? 'Plan activado' : 'Ya lo tienes'}
          </p>
          <h2 className="text-text mt-1 text-2xl">Tienes el plan {plan.name}</h2>
          <p className="text-text-muted mt-2 max-w-prose text-sm">
            {can(plan.id, 'grado-profesional')
              ? 'El Grado Profesional está abierto, y puedes empezar por el curso que quieras desde el camino.'
              : 'Ya puedes seguir por donde ibas.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/aprender"
            className="bg-brass text-background hover:bg-brass-bright inline-flex items-center justify-center rounded-md px-5 py-2.5 text-base"
          >
            Ir al camino
          </Link>
          <Link
            href="/cuenta"
            className="border-border text-text hover:border-brass-dim inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-base"
          >
            Ver mi cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Qué vas a contratar">
        <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
          Lo que vas a contratar
        </h2>

        <div className="border-border mt-3 border">
          <div className="border-border flex items-baseline justify-between gap-4 border-b px-4 py-3">
            <div>
              <p className="text-text text-lg">Plan {plan.name}</p>
              <p className="text-text-muted text-sm">{plan.claim}</p>
            </div>
            <p className="text-brass-bright shrink-0 font-mono text-lg">{priceLabel(plan.id)}</p>
          </div>

          <ul className="flex flex-col gap-1 px-4 py-3">
            {ETIQUETAS.filter(({ capability }) => can(plan.id, capability)).map(
              ({ capability, label }) => {
                // Lo que ya tenías no es lo que estás comprando. Marcarlo como
                // nuevo sería inflar la lista con cosas por las que ya pagabas.
                const nuevo = !can(actual.id, capability);
                return (
                  <li key={capability} className="flex items-baseline gap-2 text-sm">
                    <span aria-hidden="true" className="text-tube-bright">
                      ✓
                    </span>
                    <span className="text-text">{label}</span>
                    {nuevo && esSubida && (
                      <span className="text-brass-bright font-mono text-xs">nuevo</span>
                    )}
                  </li>
                );
              },
            )}
            <li className="text-text mt-1 flex items-baseline gap-2 text-sm">
              <span aria-hidden="true" className="text-tube-bright">
                ✓
              </span>
              <span>
                {monthlyAiRequests(plan.id, account.aiModel)} peticiones a la IA al mes
                {esSubida && (
                  <span className="text-text-muted">
                    {' '}
                    · ahora tienes {monthlyAiRequests(actual.id, account.aiModel)}
                  </span>
                )}
              </span>
            </li>
          </ul>
        </div>

        {!esSubida && (
          <p className="text-text-muted mt-2 text-sm">
            Vienes del plan {actual.name}. Comprueba que no pierdes nada que estés usando: lo que no
            entra en {plan.name} aparece tachado en la lista de planes.
          </p>
        )}
      </section>

      {!accounts ? (
        <p className="text-text-muted max-w-prose text-sm">
          Esta copia de la aplicación no tiene cuentas configuradas, así que no hay dónde guardar un
          plan. Todo lo que no es IA funciona igual y sin pagar nada.
        </p>
      ) : !signedIn ? (
        <section aria-label="Entrar para continuar">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Primero, tu cuenta
          </h2>
          <p className="text-text-muted mt-1 mb-3 max-w-prose text-sm">
            El plan va asociado a una cuenta. Al entrar te quedas aquí y sigues con el plan{' '}
            {plan.name}.
          </p>
          <AccessForm />
        </section>
      ) : (
        <section aria-label="Confirmar">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">Confirmar</h2>

          {/* Lo que sigue es la frase más importante de la pantalla y va antes del
              botón, no debajo en letra pequeña. */}
          <div className="border-brass-dim bg-surface-raised mt-3 border p-3">
            <p className="text-text text-sm">
              <strong>Aquí todavía no se cobra nada.</strong> No hay pasarela de pago enchufada: al
              confirmar, tu cuenta pasa al plan {plan.name} sin que se te cargue ningún importe y
              sin pedirte una tarjeta. El precio de arriba es el que costará cuando la haya.
            </p>
          </div>

          <div className="mt-4">
            <Button onClick={() => void activar()} disabled={working}>
              {working ? 'Un momento...' : `Activar el plan ${plan.name}`}
            </Button>
          </div>

          {error !== null && (
            <p className="text-oxblood-bright mt-3 text-sm" aria-live="polite">
              {error}
            </p>
          )}
        </section>
      )}

      <p className="text-text-muted text-xs">
        <Link href="/planes" className="hover:text-text underline">
          Volver a los tres planes
        </Link>
      </p>
    </div>
  );
}
