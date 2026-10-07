'use client';

import { Averia } from './Averia';

/**
 * La frontera de errores de la raíz: atrapa lo que se rompa por debajo del layout
 * raíz y fuera del marco —la portada, o el propio marco—.
 *
 * Aquí ya no hay barra, así que la sala la pone esta misma caja: sin el alto de
 * la ventana, `Screen` —que desplaza dentro de lo que le den— no tendría dónde
 * desplazarse. Lo que se rompe **dentro** de una pantalla de trabajo lo coge
 * antes `(marco)/error.tsx`, que deja la barra puesta.
 */
export default function ErrorDeLaRaiz({ retry }: { readonly retry: () => void }) {
  return (
    <div className="fondo-sala h-dvh">
      <Averia retry={retry} />
    </div>
  );
}
