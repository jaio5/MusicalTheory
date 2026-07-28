import type { ReactNode } from 'react';

export interface PanelProps {
  readonly title: string;
  /** Identificador para enlazar el título con la región. */
  readonly id: string;
  /** Controles propios del panel, alineados con el título. */
  readonly actions?: ReactNode;
  readonly wide?: boolean;
  readonly children: ReactNode;
}

/**
 * Un panel del banco de trabajo.
 *
 * Cabecera de una línea y el contenido debajo: la idea es que quepan varios en
 * pantalla a la vez, no que cada uno ocupe una pantalla entera.
 */
export function Panel({ title, id, actions, wide = false, children }: PanelProps) {
  return (
    <section
      aria-labelledby={id}
      className={`border-border bg-surface flex flex-col rounded-lg border ${
        wide ? 'lg:col-span-2' : ''
      }`}
    >
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
