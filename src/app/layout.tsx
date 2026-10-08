import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { GUION_TEMA } from '@state/theme';

import { ContarVisitas } from './ContarVisitas';
import { CLASES_DE_FUENTES } from './fuentes';
import './globals.css';

/**
 * Nada de prerenderizado, y esto no es una precaución: lo piden dos cosas.
 *
 * **La política de seguridad con número de un solo uso.** `proxy.ts` pone uno
 * nuevo en cada petición, y Next solo se lo pone a sus guiones al pintar en el
 * servidor: una página generada al construir no tiene petición ni cabecera de
 * donde sacarlo, y su JavaScript lo bloquearía la propia política
 * (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`,
 * «Forcing dynamic rendering»).
 *
 * **Y la cuenta**, que la lee el layout de `(marco)` y hereda esto. Si al
 * construir no están `DATABASE_URL` ni `AUTH_SECRET`, `authAvailable()` dice que
 * no, nadie toca la cookie y Next concluye —con razón, con lo que ve— que esas
 * páginas son estáticas. Luego se arranca el contenedor con las variables
 * puestas y se sirve ese HTML: todo el mundo entra como anónimo hasta que el
 * JavaScript despierta. Es exactamente el camino del contenedor que documenta
 * DESPLIEGUE.md, donde se construye sin variables y se corre con ellas.
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

/**
 * El nombre va una vez, aquí, y cada página pone solo el suyo: «Afinar» sale
 * «Afinar · Caos ordenado». Estaba escrito a mano en cada página. La portada
 * y el `not-found` de la raíz son de este mismo segmento y la plantilla no les
 * llega: escriben el título entero.
 */
export const metadata: Metadata = {
  title: { default: 'Caos ordenado', template: '%s · Caos ordenado' },
  description:
    'Escucha la guitarra por el micro, afina, enseña la escala sobre el mástil y detecta la tonalidad de lo que estás tocando.',
};

/**
 * El documento: la lengua, las letras y el tema antes de pintar.
 *
 * **La cuenta no se lee aquí**, sino en el layout de `(marco)`: aquí cuelga
 * también la portada, que no la usa, y leerla eran dos consultas a Postgres por
 * visita a la portada con la sesión abierta.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
    El número de un solo uso que ha puesto `proxy.ts`.

    Sin él, este guion —el que aplica el tema antes de pintar— lo bloquea la
    política de seguridad, y quien tenga el tema claro se come un fogonazo
    oscuro en cada carga. Los guiones de Next se lo ponen ellos: les basta con
    encontrar un número en la cabecera.
  */
  const numero = (await headers()).get('x-nonce') ?? undefined;

  return (
    // Las variables de las tres letras van en el `<html>` y no en el `<body>`:
    // `globals.css` las lee desde `:root`, y la barra de desplazamiento y lo que
    // pinta el navegador fuera del `<body>` también cuentan.
    <html lang="es" className={CLASES_DE_FUENTES} suppressHydrationWarning>
      <head>
        {/*
          El tema elegido, aplicado **antes de pintar**. Sin esto el navegador
          pinta el HTML con el tema por defecto y React lo cambia al arrancar: en
          una aplicación que parte del oscuro, quien había elegido el claro se come
          un fogonazo oscuro en cada carga.

          `suppressHydrationWarning` en el `<html>` porque este guion le toca el
          atributo antes de que React compare lo que hay con lo que esperaba.
        */}
        <script nonce={numero} dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="antialiased">
        {children}
        {/* Una visita por pantalla, sin cookies ni nadie de fuera (adr/0110). */}
        <ContarVisitas />
      </body>
    </html>
  );
}
