'use client';

import { lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * **Lo que no se ve al entrar llega después** ([adr/0058](../../../../docs/adr/0058-componer-se-descarga-por-partes.md)).
 *
 * Se entra por `Escribir` con el área de abajo cerrada
 * ([adr/0109](../../../../docs/adr/0109-lo-que-se-da-por-hecho-al-empezar.md)),
 * así que el lienzo va en el paquete de entrada y lo que llega después es lo
 * demás: tocando, el ensayo, el mástil y los tres paneles de abajo. Estuvo al
 * revés —el ADR 0058 se escribió cuando se entraba por `Tocando`— y quien volvía
 * veía tres pantallas seguidas: la vacía, «Abriendo el lienzo…» y el lienzo.
 *
 * Cada uno es aquí una promesa de su módulo —del módulo y no del índice, por lo
 * mismo que las pantallas (adr/0045)— y pedir la misma dos veces no descarga
 * nada: el empaquetador guarda lo que ya trajo.
 */
const CARGAS = {
  tocando: () => import('@features/arrange/TocarParaEscribir'),
  ensayo: () => import('@features/arrange/Ensayo'),
  mastil: () => import('@features/fretboard/FretboardPanel'),
  salidas: () => import('@features/salidas/SalidasPanel'),
  canciones: () => import('@features/songs/SongsPanel'),
  sesiones: () => import('@features/sessions/SessionsPanel'),
} as const;

type Carga = keyof typeof CARGAS;

/** Trae el código de esas piezas sin pintarlas, para que no haya que esperarlo al pulsar. */
export function precargar(...cuales: readonly Carga[]): void {
  for (const cual of cuales) {
    void CARGAS[cual]();
  }
}

/**
 * `React.lazy` sobre una exportación con nombre.
 *
 * Con `lazy` y `Suspense` de React y no con `next/dynamic`, que es lo mismo por
 * dentro: `next/dynamic` solo es el de producción después de que el compilador
 * de Next lo reescriba, y en Vitest se resuelve a la versión del Pages Router
 * —otro cargador—, así que los tests probarían una pieza que no es la que se
 * sirve (adr/0058).
 */
function diferido<K extends string, M extends Record<K, ComponentType>>(
  cargar: () => Promise<M>,
  nombre: K,
): LazyExoticComponent<M[K]> {
  return lazy(() => cargar().then((modulo) => ({ default: modulo[nombre] })));
}

export const TocarParaEscribir = diferido(CARGAS.tocando, 'TocarParaEscribir');
export const Ensayo = diferido(CARGAS.ensayo, 'Ensayo');
export const FretboardPanel = diferido(CARGAS.mastil, 'FretboardPanel');
export const RotulosDelMastil = diferido(CARGAS.mastil, 'RotulosDelMastil');
export const SalidasPanel = diferido(CARGAS.salidas, 'SalidasPanel');
export const SongsPanel = diferido(CARGAS.canciones, 'SongsPanel');
export const SessionsPanel = diferido(CARGAS.sesiones, 'SessionsPanel');

/**
 * Lo que ocupa el sitio mientras llega el código.
 *
 * Casi nunca se ve: tocando y el ensayo se piden en cuanto la pantalla se queda
 * quieta, y los de abajo al pasar por su pastilla. Pero cuando se ve —una red
 * lenta, un atajo de teclado nada más entrar— dice qué viene, en vez de un hueco
 * que parece un fallo.
 */
export function Abriendo({ que }: { readonly que: string }) {
  return (
    <p role="status" className="text-text-muted m-auto p-6 text-center">
      Abriendo {que}…
    </p>
  );
}

/**
 * Pide tocando y el ensayo **en cuanto la pantalla se queda quieta**.
 *
 * Son los dos espacios a los que se pasa desde el lienzo: pedirlos al pulsar
 * dejaría un «Abriendo…» justo cuando se va a tocar. En reposo no compiten con
 * la hidratación, que es lo que la división viene a aligerar.
 */
export function usePrecargarEnReposo(): void {
  useEffect(() => {
    const traer = () => precargar('tocando', 'ensayo');
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(traer);
      return () => window.cancelIdleCallback(id);
    }
    // Safari no tiene `requestIdleCallback`: un plazo corto hace de reposo.
    const id = window.setTimeout(traer, 200);
    return () => window.clearTimeout(id);
  }, []);
}
