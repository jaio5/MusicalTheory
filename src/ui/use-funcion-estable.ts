'use client';

import { useCallback, useRef } from 'react';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

/**
 * Una función que no cambia de identidad y siempre llama a la última versión.
 *
 * El patrón `useEvent` de React, con nombre propio para no confundirlo con
 * `useEstable` del afinador, que es otra cosa: un estado que no parpadea.
 *
 * Existe por las filas del lienzo: van con `memo`, y lo que se les pasa tiene que ser la
 * misma función de un pintado a otro ([adr/0059](../../docs/adr/0059-memo-a-mano-y-no-el-compilador.md)).
 * Los gestos del lienzo leen el pulso y el reproductor, que cambian a cada rato;
 * con `useCallback` y sus dependencias cambiarían también, y con ellos todas las
 * filas se repintarían. Se llaman solo desde un evento, así que leer la última
 * versión es leer lo que hay en pantalla.
 */
export function useFuncionEstable<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(fn);
  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
