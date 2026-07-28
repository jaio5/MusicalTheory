'use client';

import type { ReactNode } from 'react';

import { usePanelChrome } from './panel-chrome';

export interface PanelProps {
  readonly title: string;
  /** Identificador para enlazar el título con la región. */
  readonly id: string;
  /** Controles propios del panel, alineados con el título. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Un panel del banco de trabajo.
 *
 * Dentro del dock se dibuja pelado: la pestaña ya dice cómo se llama, y una
 * cabecera repitiéndolo justo debajo es ruido. Fuera del dock lleva su cabecera
 * de una línea.
 */
export function Panel({ title, id, actions, children }: PanelProps) {
  const chrome = usePanelChrome();

  if (!chrome) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {actions !== undefined && (
          <div className="border-border flex shrink-0 items-center justify-end gap-2 border-b px-3 py-1">
            {actions}
          </div>
        )}
        <div className="min-h-0 grow overflow-auto p-3">{children}</div>
      </div>
    );
  }

  return (
    <section aria-labelledby={id} className="border-border bg-surface flex flex-col border">
      <header className="border-border flex min-h-11 items-center justify-between gap-3 border-b px-4">
        <h2 id={id} className="text-text-muted font-mono text-xs tracking-widest uppercase">
          {title}
        </h2>
        {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
