/**
 * Criterio 1: la sintaxis funcional, enlace a enlace (`enlace.ts`).
 */
import { enlace } from './enlace';
import { enlaceDeVuelta, enlacesNuevos, esDudoso, juntar, type Hecho, type Juicio } from './juicio';

export function sintaxis(j: Juicio): Hecho {
  const vuelta = enlaceDeVuelta(j);
  return juntar([
    ...enlacesNuevos(j).map((k) => ({
      hecho: enlace(j, k),
      peso: esDudoso(j, k - 1) ? 0.5 : 1,
    })),
    ...(vuelta === null ? [] : [{ hecho: enlace({ ...j, cancion: vuelta }, 1, true), peso: 1 }]),
  ]);
}
