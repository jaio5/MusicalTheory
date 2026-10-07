'use client';

import { Averia } from './Averia';
import { CLASES_DE_FUENTES } from './fuentes';
import './globals.css';

/**
 * Cuando lo que se rompe es **el layout raíz**, que es el que lee la cuenta.
 *
 * Es el caso que no cubre `error.tsx`: con la base de datos caída,
 * `currentAccount()` lanza antes de que haya `<html>`, y Next pinta su página en
 * inglés y sin estilos. Ésta sustituye al layout entero, así que trae lo suyo:
 * el `<html>` en español, las tres letras y la hoja de estilos. **El tema no**:
 * lo aplica un guion del layout raíz, que aquí no está, y se ve el de casa.
 *
 * El título va con `<title>` y no con `metadata`, que en una frontera de errores
 * no se puede exportar.
 */
export default function ErrorGlobal({ retry }: { readonly retry: () => void }) {
  return (
    <html lang="es" className={CLASES_DE_FUENTES}>
      <body className="antialiased">
        <title>Algo se ha roto · Caos ordenado</title>
        <div className="fondo-sala h-dvh">
          <Averia retry={retry} />
        </div>
      </body>
    </html>
  );
}
