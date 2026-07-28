'use client';

import { AddPanel, Dock } from '@features/dock';
import { MicButton } from '@features/workspace';

import { DOCK_PANELS } from './panels';

/**
 * La pantalla.
 *
 * Arriba, lo único que está siempre: el botón de escuchar y el menú de paneles.
 * Debajo, el banco de trabajo, que cada uno se monta como quiera. La página no
 * hace scroll; lo hacen los paneles por dentro.
 */
export function Workspace() {
  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface flex shrink-0 items-center gap-3 border-b px-3 py-1.5">
        <MicButton />
        <span className="ml-auto">
          <AddPanel />
        </span>
      </header>

      <Dock panels={DOCK_PANELS} />
    </div>
  );
}
