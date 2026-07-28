import type { ReactNode } from 'react';

export interface PanelProps {
  readonly title: string;
  /** Identificador para enlazar el título con la región. */
  readonly id: string;
  /** Controles propios del panel, alineados con el título. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Un bloque con su título de una línea y el contenido debajo.
 *
 * Cada pantalla monta varios: la cabecera es lo que deja saber de un vistazo
 * qué es cada cosa sin tener que leerla entera.
 */
export function Panel({ title, id, actions, children }: PanelProps) {
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
