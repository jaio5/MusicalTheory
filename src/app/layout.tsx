import type { Metadata, Viewport } from 'next';

import { authAvailable } from '@server/auth';
import { currentAccount } from '@server/entitlements';
import { AccountProvider } from '@state/account';
import { GUION_TEMA } from '@state/theme';

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

/**
 * De borde a borde, y por eso hay que apartarse del hueco de la pantalla.
 *
 * Sin `viewportFit: 'cover'` el navegador encoge la ventana hasta el área segura:
 * no se recorta nada, pero la barra de abajo termina en una franja que pinta el
 * sistema y del color del sistema, y entonces esto vuelve a parecer una web con
 * un menú. Con `cover` el tapizado llega al canto de la pantalla.
 *
 * Lo que se paga es que `env(safe-area-inset-*)` deja de valer cero y hay que
 * usarlo: el relleno de abajo en la barra de pantallas, para que los iconos no
 * caigan bajo el indicador de inicio, y el de los lados en el marco, para el
 * hueco de la cámara cuando el teléfono se pone tumbado. Están los dos en
 * `AppShell`.
 */
export const viewport: Viewport = {
  viewportFit: 'cover',
};

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
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          El tema elegido, aplicado **antes de pintar**. Sin esto el navegador
          pinta el HTML con el tema por defecto y React lo cambia al arrancar: en
          una aplicación clara, quien había elegido oscuro se come un fogonazo
          blanco en cada carga.

          `suppressHydrationWarning` en el `<html>` porque este guion le toca el
          atributo antes de que React compare lo que hay con lo que esperaba.
        */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="antialiased">
        <AccountProvider account={account} accounts={authAvailable()}>
          {children}
        </AccountProvider>
      </body>
    </html>
  );
}
