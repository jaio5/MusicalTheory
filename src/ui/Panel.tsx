import type { ReactNode } from 'react';

export interface PanelProps {
  readonly title: string;
  /** Identificador para enlazar el título con la región. */
  readonly id: string;
  /** Controles propios del panel, alineados con el título. */
  readonly actions?: ReactNode;
  /**
   * Que el título no se vea, pero siga nombrando la región.
   *
   * Para cuando la pantalla ya lo ha dicho: el afinador vive en una pantalla que
   * se llama «Afinar», y encima del aparato ponía otra franja de cuarenta y
   * cuatro píxeles con la palabra «Afinador». Eso es chapa, no información. El
   * nombre sigue estando para quien no ve la pantalla, que es lo que hace falta.
   */
  readonly rotuloOculto?: boolean;
  readonly children: ReactNode;
}

/**
 * Un bloque con su título de una línea y el contenido debajo.
 *
 * Cada pantalla monta varios: la cabecera es lo que deja saber de un vistazo
 * qué es cada cosa sin tener que leerla entera.
 */
export function Panel({ title, id, actions, rotuloOculto = false, children }: PanelProps) {
  // Sin franja: el título se queda como nombre de la región y nada más. Si hay
  // controles propios siguen haciendo falta, así que la franja vuelve.
  if (rotuloOculto && actions === undefined) {
    return (
      <section aria-labelledby={id} className="superficie flex flex-col overflow-hidden">
        <h2 id={id} className="sr-only">
          {title}
        </h2>
        <div className="p-4">{children}</div>
      </section>
    );
  }

  return (
    <section aria-labelledby={id} className="superficie flex flex-col overflow-hidden">
      <header className="border-border bg-surface-raised min-h-tap flex items-center justify-between gap-3 border-b px-4">
        <h2 id={id} className="rotulo">
          {title}
        </h2>
        {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
