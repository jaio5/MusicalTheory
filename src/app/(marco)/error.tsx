'use client';

import { Averia } from '../Averia';

/**
 * Lo que se rompe dentro de una pantalla de trabajo, **con la barra puesta**.
 *
 * La frontera de la raíz envuelve también el layout del marco, así que sin esta
 * una pantalla rota se llevaba la barra por delante: sin navegación, sin el botón
 * del micro y sin la cuenta. Aquí la avería ocupa el sitio de la pantalla y lo
 * demás sigue funcionando, micro abierto incluido.
 */
export default function ErrorDeUnaPantalla({ retry }: { readonly retry: () => void }) {
  return <Averia retry={retry} />;
}
