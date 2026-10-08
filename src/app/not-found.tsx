import type { Metadata } from 'next';

import { LaDireccionNoExiste } from './LaDireccionNoExiste';

export const metadata: Metadata = {
  // Del mismo segmento que el layout raíz: su plantilla no le llega.
  title: 'Esta dirección no existe · Caos ordenado',
};

/**
 * Lo que no existe **fuera del marco**, que ya casi no es nada: las direcciones
 * inventadas las recoge `(marco)/[...resto]` y se pintan con la barra puesta.
 * Queda para lo que se quede fuera de esa, y sin Next contestaría la suya, en
 * inglés y sin salida.
 *
 * **Sin `AppShell`, a propósito.** Lo llevaba, y como este fichero cuelga del
 * layout raíz, la barra, el micro y el menú de la cuenta viajaban en el paquete
 * de todas las rutas, la portada incluida.
 */
export default function NoEncontrada() {
  return (
    <main id="contenido" className="fondo-sala min-h-dvh">
      <LaDireccionNoExiste />
    </main>
  );
}
