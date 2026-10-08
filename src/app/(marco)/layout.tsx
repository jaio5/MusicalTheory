import type { ReactNode } from 'react';

import { LanzadorDelRecorrido } from '@features/tour';
import { authAvailable } from '@server/auth';
import { currentAccount } from '@server/entitlements';
import { AccountProvider } from '@state/account';

import { AppShell } from '../AppShell';

/**
 * El marco común, **puesto una vez para todas las pantallas de trabajo**.
 *
 * Estuvo dentro de cada `page.tsx`, y eso parecía lo mismo y no lo era: cada
 * página montaba su propio `AppShell`, así que al navegar el marco entero se
 * desmontaba y se volvía a montar. Con él se iba el botón del micro de la barra,
 * que es quien lo sujeta, y el micro se cerraba **con la barra diciendo que
 * seguía escuchando**: el primer clic en ella no paraba nada. Medido en un
 * Chromium, de `/afinar` a `/aprender` con el micro abierto: la pista terminada
 * y el botón encendido.
 *
 * Un layout de Next no se desmonta al ir de una de sus páginas a otra, que es
 * justo lo que hace falta: la barra, el micro y lo que se haya cargado del
 * espacio de trabajo siguen ahí.
 *
 * **La portada no está dentro**, y por eso esto es un grupo y no el layout
 * raíz: la portada pinta su propia sala, sin barra, y no tiene por qué descargar
 * la barra ni el micro. El paréntesis del nombre hace que `(marco)` no salga en
 * la dirección. El `force-dynamic` del layout raíz vale también aquí: lo hereda.
 *
 * **El recorrido de la primera visita vive aquí, al lado del marco y no dentro.**
 * Aquí porque sale la primera vez que se entra en cualquier pantalla de trabajo,
 * y no en la portada; y porque, como el marco, no se desmonta al navegar, que es
 * lo que le deja ir de una pantalla a otra sin perderse. Al lado y no dentro de
 * `AppShell` porque no es parte de la barra: es un diálogo que se pone encima de
 * todo, y la barra no tiene por qué saber que existe.
 *
 * **Y la cuenta se lee aquí**, una vez, y se baja por el árbol para que ninguna
 * pantalla tenga que pedirla con un `fetch` al montar: quien entra pagando no
 * debe ver medio segundo de candados antes de que se abran solos. Estuvo en el
 * layout raíz, y con ella la portada —que no la usa— hacía dos consultas a
 * Postgres en cada visita con la sesión abierta y descargaba el proveedor.
 */
export default async function Marco({ children }: { children: ReactNode }) {
  const account = await currentAccount();
  return (
    <AccountProvider account={account} accounts={authAvailable()}>
      <AppShell>{children}</AppShell>
      <LanzadorDelRecorrido />
    </AccountProvider>
  );
}
