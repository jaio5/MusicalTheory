import type { ReactNode, SelectHTMLAttributes } from 'react';

import { Chevron } from './Chevron';

export interface FieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  /** Oculta la etiqueta a la vista pero la deja para el lector de pantalla. */
  readonly compact?: boolean;
  /** `completo` llena la línea; `auto` se ciñe a lo que mide su contenido. */
  readonly ancho?: AnchoCampo;
  readonly children: ReactNode;
}

/**
 * Un desplegable con su etiqueta.
 *
 * En la barra de herramientas la etiqueta va oculta —no cabe— pero sigue
 * estando: un `<select>` sin nombre no lo sabe leer nadie.
 *
 * **El botón de la flecha es nuestro, no del sistema.** Un `<select>` sin tocar
 * dibuja su propio botón con los colores del sistema operativo, y sobre este
 * negro cálido eso era un rectángulo blanco que asomaba al pasar el cursor: lo
 * único de la pantalla que no parecía de esta aplicación. Con `appearance: none`
 * ese botón desaparece y la flecha se pinta como fondo, del mismo gris apagado
 * que el resto de los rótulos.
 *
 * Lo que sigue dibujando el sistema es **la lista que se despliega**, y eso no
 * hay CSS que lo cambie. Sale oscura porque el documento declara
 * `color-scheme: dark` en `globals.css`, que es la otra mitad de este arreglo.
 *
 * Alto de 44 px como todo lo que se pulsa, y hueco a la derecha para que el
 * nombre largo de una afinación no se meta debajo de la flecha.
 *
 * **El ancho se pide, no se hereda.** `completo` llena la línea y es lo que
 * quieren los desplegables que llevan texto —una afinación, un curso, un aparato
 * de sonido—; `auto` se ciñe a su contenido y es lo que necesita una barra de
 * herramientas, donde un desplegable de un solo dígito ocupando doce rem se come
 * el sitio de los botones de al lado y descuadra la fila entera.
 */
const ANCHOS_CAMPO = {
  completo: 'min-w-0 flex-1 basis-48',
  auto: 'w-auto',
} as const;

export type AnchoCampo = keyof typeof ANCHOS_CAMPO;
export function Field({
  label,
  compact = false,
  ancho = 'completo',
  children,
  className = '',
  ...props
}: FieldProps) {
  return (
    // Etiqueta y desplegable en la misma línea **mientras quepan**. En la columna
    // estrecha del camino no caben —«Empiezo por» más «El principio: 1º de
    // Elemental»— y el desplegable se quedaba aplastado contra el borde: por eso
    // envuelve, y al envolver el desplegable ocupa la línea entera.
    <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={compact ? 'sr-only' : 'text-text-muted shrink-0 text-xs'}>{label}</span>
      {/* La flecha es un elemento de verdad y no un `data:` de fondo: hereda
          `currentColor` en vez de llevar el gris transcrito a mano —que el test de
          tokens no puede ver dentro de una cadena codificada— y es exactamente el
          mismo dibujo que usa `ui/Disclosure`, importado y no copiado. */}
      <span className={`relative inline-flex items-center ${ANCHOS_CAMPO[ancho]}`}>
        <select
          aria-label={compact ? label : undefined}
          style={{ appearance: 'none' }}
          className={`border-border bg-surface text-text hover:border-brass-dim min-h-tap w-full cursor-pointer rounded-md border py-1.5 pr-9 pl-3 text-sm transition-colors ${className}`}
          {...props}
        >
          {children}
        </select>
        <Chevron className="text-text-muted pointer-events-none absolute right-3 size-3" />
      </span>
    </label>
  );
}
