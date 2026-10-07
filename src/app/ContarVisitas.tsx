'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { contar } from '@state/metricas';

/**
 * Una visita por pantalla abierta, para saber qué se usa y si alguien vuelve.
 *
 * En el layout raíz y no en el del marco: la portada también cuenta, y es la
 * puerta por la que entra casi todo el mundo. No pinta nada y pesa lo que pesa
 * `state/metricas.ts`, que es un `sendBeacon`
 * ([adr/0110](../../docs/adr/0110-contar-sin-seguir.md)).
 */
export function ContarVisitas() {
  const ruta = usePathname();
  useEffect(() => {
    contar('visita', ruta);
  }, [ruta]);
  return null;
}
