'use client';

import Link from 'next/link';

import { Button, estiloBoton } from '@ui/Button';
import { Screen } from '@ui/Screen';

/**
 * Lo que se ve cuando una pantalla revienta al pintarse.
 *
 * Sin esto Next pinta el suyo: «This page couldn't load», en inglés, sin barra y
 * con un botón de recargar que no dice qué va a pasar. Se vio con una escala
 * guardada que ya no existía, y con un montaje en el modo equivocado: las dos
 * cosas están arregladas donde nacían, pero la siguiente que se cuele no tiene
 * por qué echar a nadie de la aplicación en otro idioma.
 *
 * **Volver a intentarlo es `retry`**, que en esta versión de Next vuelve a pedir
 * y a pintar lo que había dentro de la frontera. No promete nada: si lo que
 * falla es un dato guardado, falla otra vez, y por eso al lado hay salidas a
 * otras pantallas, las mismas que da la dirección que no existe.
 *
 * La comparten las tres fronteras —la del marco, la raíz y la global— para que
 * el tropiezo se diga igual donde caiga.
 */
export function Averia({ retry }: { readonly retry: () => void }) {
  return (
    <Screen
      title="Esta pantalla se ha roto"
      lead="Algo ha fallado al pintarla, y no es por nada que hayas hecho. Prueba otra vez; si vuelve a pasar, entra por otro sitio."
      ancho="lectura"
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => retry()}>Volver a intentarlo</Button>
        <Link href="/aprender" className={estiloBoton('quiet')}>
          Ir al camino
        </Link>
        <Link href="/" className={estiloBoton('quiet')}>
          La portada
        </Link>
      </div>
    </Screen>
  );
}
