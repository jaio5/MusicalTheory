import type { Metadata } from 'next';

import { authAvailable } from '@server/auth';
import { currentAccount } from '@server/entitlements';
import { AccountProvider } from '@state/account';

import './globals.css';

/**
 * Nada de prerenderizado, y esto no es una precaución: es un fallo que ya estaba
 * puesto.
 *
 * El layout lee la cuenta. Si al construir no están `DATABASE_URL` ni
 * `AUTH_SECRET`, `authAvailable()` dice que no, nadie toca la cookie y Next
 * concluye —con razón, con lo que ve— que estas páginas son estáticas. Luego se
 * arranca el contenedor con las variables puestas y se sirve ese HTML: todo el
 * mundo entra como anónimo hasta que el JavaScript despierta. Es exactamente el
 * camino del contenedor que documenta DESPLIEGUE.md, donde se construye sin
 * variables y se corre con ellas.
 *
 * Lo que cuesta: el marco de las páginas se genera en cada petición en vez de una
 * vez. Son unos kilobytes de HTML y ninguna consulta cuando no hay cuentas, y todo
 * lo que hay dentro son componentes de cliente que arrancan pidiendo el micrófono.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Caos ordenado',
  description:
    'Escucha la guitarra por el micro, afina, enseña la escala sobre el mástil y detecta la tonalidad de lo que estás tocando.',
};

/**
 * El layout es el único componente de servidor que lee la cuenta.
 *
 * La lee aquí y la baja por el árbol para que ninguna pantalla tenga que pedirla
 * con un `fetch` al montar: quien entra pagando no debe ver medio segundo de
 * candados antes de que se abran solos.
 *
 * Leer la sesión hace que esta página se sirva en cada petición en vez de
 * quedarse cacheada. Es el precio de saber quién eres antes de pintar, y en esta
 * aplicación no cambia nada más: todas las pantallas son componentes de cliente
 * que arrancan pidiendo el micrófono.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();

  return (
    <html lang="es">
      <body className="antialiased">
        <AccountProvider account={account} accounts={authAvailable()}>
          {children}
        </AccountProvider>
      </body>
    </html>
  );
}
