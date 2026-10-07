import type { Metadata } from 'next';
import Link from 'next/link';

import { estiloBoton } from '@ui/Button';
import { Screen } from '@ui/Screen';

export const metadata: Metadata = {
  title: 'Esta dirección no existe · Caos ordenado',
};

/**
 * Lo que no existe **dentro del marco**: la unidad o el plan que una página de
 * `(marco)` manda a `notFound()`.
 *
 * Hace falta aparte del `not-found.tsx` de la raíz, que monta su propio
 * `AppShell` porque cubre también las direcciones que no casan con nada, y ésas
 * no pasan por el layout de `(marco)`. Un `notFound()` de una página de dentro,
 * en cambio, se pinta **dentro de ese layout**, que ya puso el marco: con el de la
 * raíz salían dos cabeceras, dos micros y dos barras de abajo, una encima de otra.
 * Medido en un Chromium con `/planes/gratis` y `/aprender/no-existe`.
 *
 * Dice lo mismo que el de la raíz, porque es el mismo tropiezo.
 */
export default function NoEncontradaEnElMarco() {
  return (
    <Screen
      title="Esta dirección no existe"
      lead="Puede que el enlace sea viejo, que la pantalla se llame ahora de otra forma o que se haya colado una letra de más. Lo que había antes sigue estando: solo hay que entrar por otro sitio."
      ancho="lectura"
    >
      <div className="flex flex-wrap gap-2">
        <Link href="/aprender" className={estiloBoton('primary')}>
          Ir al camino
        </Link>
        <Link href="/componer" className={estiloBoton('quiet')}>
          Componer
        </Link>
        <Link href="/" className={estiloBoton('quiet')}>
          La portada
        </Link>
      </div>
    </Screen>
  );
}
