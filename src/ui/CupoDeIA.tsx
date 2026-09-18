'use client';

import Link from 'next/link';

import { useAccount } from '@state/account';

/**
 * Lo que te queda de IA, en la barra de arriba.
 *
 * **Se ve antes de gastarlo**, que es lo que pide
 * [adr/0033](../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md): quien
 * paga tiene derecho a saber cuánto le queda sin entrar en su cuenta, y a quien
 * le quedan dos peticiones le cambia lo que pide. Estaba solo **dentro** de los
 * paneles que lo gastan, así que para saberlo había que abrir el que ibas a
 * usar.
 *
 * **Solo con cuenta**, y no es un olvido: sin ella el servidor cuenta por
 * dirección, así que no hay número que prometer. Es la misma regla que ya sigue
 * el profesor.
 *
 * Vive en `ui/` porque lo miran dos sitios que no se conocen —el profesor y
 * componer— y un feature no importa de otro.
 */
export function CupoDeIA({ className = '' }: { readonly className?: string }) {
  const { account, signedIn } = useAccount();

  if (!signedIn || account.aiLeftToday === null) {
    return null;
  }

  const agotado = account.aiLeftToday === 0;

  return (
    <Link
      href="/cuenta#suscripcion"
      // Enlace y no texto: el número solo sirve si desde él se puede hacer algo,
      // y lo que se hace con «no me queda» es mirar el plan.
      title={
        agotado
          ? 'Se te han acabado las peticiones a la IA de hoy'
          : 'Peticiones a la IA que te quedan'
      }
      className={`min-h-tap inline-flex items-center font-mono text-xs tabular-nums ${
        agotado ? 'text-oxblood-bright' : 'text-text-muted hover:text-brass-bright'
      } ${className}`}
    >
      {agotado ? 'Sin IA hoy' : `IA: ${account.aiLeftToday}`}
      {account.aiLeftMonth !== null && !agotado && (
        <span className="opacity-70">&nbsp;·&nbsp;{account.aiLeftMonth}</span>
      )}
    </Link>
  );
}
