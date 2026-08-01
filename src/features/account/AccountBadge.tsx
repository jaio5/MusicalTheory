'use client';

import Link from 'next/link';

import { useAccount } from '@state/account';

/**
 * Quién eres, en la barra de arriba.
 *
 * Un enlace y nada más: aquí no cabe un menú, y lo que hace falta saber de un
 * vistazo es si estás dentro y con qué plan. El correo se recorta por el arroba
 * —`javier@…`— porque el nombre entero no cabe y la parte que reconoce uno es la
 * de delante.
 */
export function AccountBadge() {
  const { accounts, signedIn, account, planName } = useAccount();

  if (!accounts) {
    return null;
  }

  if (!signedIn) {
    return (
      <Link
        href="/cuenta"
        title="Crear una cuenta para llevarte el avance a otro aparato"
        className="border-border text-text-muted hover:text-text shrink-0 border px-3 py-1 font-mono text-xs"
      >
        Entrar
      </Link>
    );
  }

  const corto = account.email?.split('@')[0] ?? 'tu cuenta';

  return (
    <Link
      href="/cuenta"
      title={`${account.email} · plan ${planName}`}
      className="border-brass-dim text-brass-bright hover:border-brass-bright shrink-0 border px-3 py-1 font-mono text-xs"
    >
      {corto}
      {/* El plan solo cabe en pantalla ancha; el correo es lo que identifica. */}
      <span className="text-text-muted hidden sm:inline"> · {planName}</span>
    </Link>
  );
}
