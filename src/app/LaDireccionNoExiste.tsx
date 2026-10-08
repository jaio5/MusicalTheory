import Link from 'next/link';

import { estiloBoton } from '@ui/Button';
import { Screen } from '@ui/Screen';

/**
 * Lo que se dice ante una dirección que no lleva a ninguna parte: qué ha pasado
 * y por dónde se sigue.
 *
 * Lo pintan los dos `not-found.tsx`, el de la raíz y el de `(marco)`, y por eso
 * vive aparte: estaba copiado en los dos. Las tres salidas son las tres cosas
 * que se vienen a hacer aquí, y la primera es el camino: quien llega perdido
 * casi nunca quería la portada.
 */
export function LaDireccionNoExiste() {
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
