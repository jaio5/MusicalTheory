import type { ReactNode } from 'react';

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
 */
export default function Marco({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
