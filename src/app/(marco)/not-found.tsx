import type { Metadata } from 'next';

import { LaDireccionNoExiste } from '../LaDireccionNoExiste';

export const metadata: Metadata = {
  title: 'Esta dirección no existe',
};

/**
 * Lo que no existe **dentro del marco**: una dirección inventada
 * (`[...resto]/page.tsx`) o la unidad o el plan que una página manda a
 * `notFound()`.
 *
 * Se pinta **dentro del layout de `(marco)`**, que ya puso el marco: cuando lo
 * contestaba el de la raíz, que montaba su propio `AppShell`, salían dos
 * cabeceras, dos micros y dos barras de abajo, una encima de otra. Medido en un
 * Chromium con `/planes/gratis` y `/aprender/no-existe`.
 */
export default function NoEncontradaEnElMarco() {
  return <LaDireccionNoExiste />;
}
