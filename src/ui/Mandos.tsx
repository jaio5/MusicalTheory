'use client';

import type { ReactNode } from 'react';

import { CARRIL, PIEZA, PIEZA_SIGUIENTE } from './Segmentado';

/**
 * Acciones que van juntas, **en una pieza con borde**: mover antes y después,
 * un pulso menos y uno más.
 *
 * Es el carril de `ui/Segmentado` con acciones en vez de opciones. Hacía falta
 * porque la otra manera de ponerlas eran `Chip` silenciosos sueltos —sin borde
 * hasta pasar el ratón, que a un metro y con el dedo no se pasa— y en el detalle
 * del acorde salían cuatro palabras flotando con cien píxeles de hueco entre
 * ellas: se leían como texto, no como mandos, y nada decía cuáles iban juntas.
 *
 * Entre dos mandos puede ir un **valor** —lo que dura el acorde entre el menos
 * y el más—, que es la manera de leer un paso a paso sin instrucciones: el
 * número en medio y lo que lo cambia a los lados.
 */
export function Mandos({
  etiqueta,
  children,
  className = '',
}: {
  /** El nombre del grupo, para quien no ve cómo se agrupan. */
  readonly etiqueta: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={`${CARRIL} ${className}`}>
      {children}
    </div>
  );
}

/** Un mando del grupo. El primero no lleva la raya de la izquierda. */
export function Mando({
  children,
  onClick,
  ariaLabel,
  disabled = false,
  primero = false,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly primero?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      // Crece para repartirse el ancho del grupo: dos mandos de una columna
      // estrecha valen lo mismo y se pulsan igual de fácil. Apagado no se
      // esconde, se atenúa: el sitio de «Antes» en el primer acorde sigue
      // diciendo que existe.
      className={`${PIEZA} ${primero ? '' : PIEZA_SIGUIENTE} text-text hover:bg-surface-raised disabled:text-text-muted grow disabled:cursor-default disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}

/** Lo que cambian los mandos de al lado, entre ellos. No se pulsa. */
export function ValorDelMando({ children }: { readonly children: ReactNode }) {
  return (
    <span className="border-border text-text bg-surface inline-flex min-w-16 items-center justify-center border-l px-3 font-mono text-sm tabular-nums">
      {children}
    </span>
  );
}
