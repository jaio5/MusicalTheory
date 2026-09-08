import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgottenForm } from '@features/account';
import { authAvailable } from '@server/auth';
import { mailer } from '@server/mail';
import { Screen } from '@ui/Screen';

import { AppShell } from '../AppShell';

export const metadata: Metadata = {
  title: 'Contraseña olvidada · Caos ordenado',
  description: 'Pon una contraseña nueva con un enlace que te mandamos al correo.',
};

/**
 * Recuperar la contraseña.
 *
 * Una sola dirección para las dos mitades del trámite: sin `?vale=` pide el
 * correo, y con él pide la contraseña nueva. Quien vuelve del buzón no está
 * empezando nada, está terminando lo de hace un minuto.
 *
 * Si esta copia no manda correo, se dice aquí en vez de enseñar un formulario
 * que no puede terminar en nada.
 */
export default async function Olvidada({
  searchParams,
}: {
  searchParams: Promise<{ vale?: string }>;
}) {
  const { vale } = await searchParams;
  const puede = authAvailable() && mailer().sends;

  return (
    <AppShell>
      <Screen
        title={vale === undefined ? 'Contraseña olvidada' : 'Contraseña nueva'}
        lead={
          vale === undefined
            ? 'Te mandamos un enlace al correo. Caduca en una hora y solo vale una vez.'
            : 'Escríbela dos veces. Al cambiarla se cierran las sesiones que hubiera abiertas en otros aparatos.'
        }
        back={{ href: '/cuenta', label: 'Entrar' }}
        ancho="lectura"
      >
        {puede ? (
          <ForgottenForm {...(vale === undefined ? {} : { vale })} />
        ) : (
          <p className="text-text-muted max-w-prose text-sm">
            Esta copia de la aplicación no manda correo, así que no se puede recuperar la contraseña
            desde aquí. Si sabes la que tienes, se cambia en{' '}
            <Link href="/cuenta#contrasena" className="enlace">
              tu cuenta
            </Link>
            .
          </p>
        )}
      </Screen>
    </AppShell>
  );
}
