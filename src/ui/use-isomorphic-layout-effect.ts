import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` en el navegador y `useEffect` en el servidor.
 *
 * Hace falta cuando algo tiene que estar colocado **antes** del primer pintado
 * —una rueda cuyos dos anillos se solaparían durante un fotograma, por
 * ejemplo—. `useLayoutEffect` a secas avisa por consola al renderizar en
 * servidor, donde no hay layout que medir.
 */
export const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;
