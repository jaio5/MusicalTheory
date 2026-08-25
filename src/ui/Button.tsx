import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'quiet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

/**
 * El botón de la aplicación.
 *
 * Tres cosas que no se ven por separado y juntas hacen que parezca un aparato y
 * no una página:
 *
 * - **Se hunde al pulsarlo** (`active:translate-y-px`). Un botón que no se mueve
 *   deja dudando de si se ha pulsado, y aquí se pulsa mirando de reojo.
 * - **Tiene un filo de luz arriba** (`inset` en la sombra). Es lo que hace que el
 *   latón parezca metal y no un rectángulo de color, y es la misma idea que el
 *   resto de la interfaz: un amplificador, no un formulario.
 * - **La transición es de 150 ms.** Por debajo no se percibe y por encima se nota
 *   lenta al encadenar acordes.
 *
 * Cuarenta y cuatro píxeles de alto, como todo lo que se pulsa aquí.
 */
const BASE =
  'inline-flex min-h-tap items-center justify-center rounded-md px-5 py-2.5 text-base transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brass text-background filo-luz hover:bg-brass-bright hover:filo-luz-alto',
  quiet:
    'border border-border text-text hover:border-brass-dim hover:text-brass-bright hover:bg-surface-raised',
};

/**
 * El mismo aspecto, para un enlace.
 *
 * Ocho `<Link>` con pinta de botón llevaban la cadena copiada, y al ganar `Button`
 * el alto de dedo y el hundido se quedaron atrás: eran botones de 40 px que no se
 * movían al pulsarlos. Se exporta el estilo en vez de un componente envoltorio
 * porque quien lo usa es `next/link`, y `ui/` no debe conocerlo.
 */
export function estiloBoton(variant: ButtonVariant = 'primary', className = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`;
}

export function Button({ variant = 'primary', className = '', type, ...props }: ButtonProps) {
  return (
    <button
      // Sin esto, un botón dentro de un formulario lo enviaría sin querer.
      type={type ?? 'button'}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
