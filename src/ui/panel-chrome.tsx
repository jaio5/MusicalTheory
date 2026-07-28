'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * ¿El panel se dibuja su propia cabecera?
 *
 * Dentro del dock la pestaña ya lleva el nombre, así que repetirlo debajo sobra.
 * Se resuelve con un contexto y no con una prop porque quien lo sabe —el dock—
 * y quien lo necesita —el `Panel` de dentro de cada feature— están separados por
 * varios componentes, y encadenar la prop obligaría a tocar los once paneles.
 *
 * Viniendo de Angular: es lo mismo que un servicio provisto en un componente
 * padre, salvo que aquí el valor viaja por el árbol de render y no por el
 * inyector.
 */
const PanelChromeContext = createContext(true);

export function usePanelChrome(): boolean {
  return useContext(PanelChromeContext);
}

export function PanelChrome({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <PanelChromeContext value={enabled}>{children}</PanelChromeContext>;
}
