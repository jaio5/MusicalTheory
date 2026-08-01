'use client';

import { needsPlanMessage, type Plan } from '@core/billing';

import { PlansLink } from './PlansLink';

/**
 * El candado que dice cómo se abre.
 *
 * Un candado que solo dice «no puedes» es una pared. Este dice qué falta, cuánto
 * cuesta y lleva al sitio donde se cambia, que son las tres cosas que se van a
 * preguntar a continuación.
 *
 * Lleva a `/planes`, donde están las tres tarjetas con lo que incluye cada una,
 * y no a `/cuenta`: quien se topa con un candado no viene a mirar quién es,
 * viene a ver qué tiene que pagar para abrirlo.
 *
 * Está en `ui/` y no dentro de un feature porque lo necesitan tres —aprender,
 * ideas y la cuenta—, y un feature no importa de otro. Es tonto a propósito: no
 * sabe quién eres, se lo dicen. La frase la escribe `core/billing`, que es la
 * misma que usan las rutas al rechazar una petición, y por eso la pantalla no
 * puede prometer lo que el servidor niega.
 */
export function PlanLock({
  needed,
  what,
  signedIn,
  plural = false,
  compact = false,
}: {
  /** El plan más barato que lo incluye, o nulo si no lo incluye ninguno. */
  readonly needed: Plan | null;
  /** El sujeto de la frase, escrito entero: «Las ideas de la IA». */
  readonly what: string;
  readonly signedIn: boolean;
  /** Si ese sujeto es plural, para que el verbo concuerde. */
  readonly plural?: boolean;
  readonly compact?: boolean;
}) {
  return (
    <div
      className={`border-brass-dim bg-surface-raised border ${compact ? 'px-2 py-1.5' : 'p-3'}`}
      role="note"
    >
      <p className={`text-text ${compact ? 'text-xs' : 'text-sm'}`}>
        {needsPlanMessage(needed, what, plural)}
      </p>
      <PlansLink className="mt-1 inline-block" />
      {/* Sin cuenta hace falta una, pero no se manda a otra pantalla a por ella:
          se entra desde la misma ventana del plan, sin perder por dónde ibas. */}
      {!signedIn && (
        <p className="text-text-muted mt-1 text-xs">
          El plan va con una cuenta, y se entra desde ahí mismo.
        </p>
      )}
    </div>
  );
}
