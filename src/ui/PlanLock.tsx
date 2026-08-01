'use client';

import Link from 'next/link';

import { needsPlanMessage, type Plan } from '@core/billing';

/**
 * El candado que dice cómo se abre.
 *
 * Un candado que solo dice «no puedes» es una pared. Este dice qué falta, cuánto
 * cuesta y lleva al sitio donde se cambia, que son las tres cosas que se van a
 * preguntar a continuación.
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
  compact = false,
}: {
  /** El plan más barato que lo incluye, o nulo si no lo incluye ninguno. */
  readonly needed: Plan | null;
  /** El sujeto de la frase, escrito entero: «Las ideas de la IA». */
  readonly what: string;
  readonly signedIn: boolean;
  readonly compact?: boolean;
}) {
  return (
    <div
      className={`border-brass-dim bg-surface-raised border ${compact ? 'px-2 py-1.5' : 'p-3'}`}
      role="note"
    >
      <p className={`text-text ${compact ? 'text-xs' : 'text-sm'}`}>
        {needsPlanMessage(needed, what)}
      </p>
      <Link
        href="/cuenta"
        className="text-brass-bright hover:text-brass mt-1 inline-block font-mono text-xs underline"
      >
        {signedIn ? 'Ver los planes' : 'Crear una cuenta o entrar'}
      </Link>
    </div>
  );
}
