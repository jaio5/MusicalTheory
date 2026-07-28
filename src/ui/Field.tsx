import type { ReactNode, SelectHTMLAttributes } from 'react';

export interface FieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  /** Oculta la etiqueta a la vista pero la deja para el lector de pantalla. */
  readonly compact?: boolean;
  readonly children: ReactNode;
}

/**
 * Un desplegable con su etiqueta.
 *
 * En la barra de herramientas la etiqueta va oculta —no cabe— pero sigue
 * estando: un `<select>` sin nombre no lo sabe leer nadie.
 */
export function Field({ label, compact = false, children, className = '', ...props }: FieldProps) {
  return (
    <label className="flex items-center gap-2">
      <span className={compact ? 'sr-only' : 'text-text-muted text-xs'}>{label}</span>
      <select
        aria-label={compact ? label : undefined}
        className={`border-border bg-background text-text rounded-md border px-2 py-1.5 text-sm ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
