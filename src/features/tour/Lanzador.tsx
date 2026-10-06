'use client';

import { usePathname } from 'next/navigation';
import { lazy, Suspense } from 'react';

import { useRecorrido } from '@state/recorrido';

/**
 * El recorrido llega **solo a quien le toca**.
 *
 * Lo monta el marco, que está en todas las pantallas de trabajo, y quien ya lo ha
 * visto —casi todo el mundo, casi siempre— no tiene por qué descargarlo: el
 * recorrido con sus pasos va en su propio trozo y se pide aquí, al saber que
 * hace falta. Es lo mismo que hace componer con lo que no se ve al entrar
 * ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md)).
 *
 * En el servidor se da por visto, así que el HTML sale igual para todos y no hay
 * nada que corregir al hidratar; el navegador lo pide después, si toca.
 */
const Recorrido = lazy(() =>
  import('./Recorrido').then((modulo) => ({ default: modulo.Recorrido })),
);

/**
 * **Un trámite no se interrumpe con una visita guiada.** Quien llega del correo a
 * `/olvidada?vale=…` viene a cambiar la contraseña, y el recorrido, al acabar,
 * le devolvía a la ruta sin la consulta: sin el vale, la pantalla le pedía el
 * correo otra vez. En estas rutas no empieza; sale en la siguiente pantalla de
 * trabajo que abra. Uno ya empezado no pasa por aquí: sus pasos nunca llevan a
 * un trámite.
 */
const TRAMITES = ['/olvidada', '/registro', '/cuenta', '/planes'];

function esTramite(ruta: string): boolean {
  return TRAMITES.some((tramite) => ruta === tramite || ruta.startsWith(`${tramite}/`));
}

export function LanzadorDelRecorrido() {
  const estado = useRecorrido();
  const ruta = usePathname();
  if (estado.visto || (estado.origen === null && esTramite(ruta))) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <Recorrido estado={estado} />
    </Suspense>
  );
}
