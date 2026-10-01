import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'quiet' | 'danger';
export type ButtonSize = 'normal' | 'compacto';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  /**
   * Que está trabajando: se dibuja la ruedecilla y se marca `aria-busy`.
   *
   * No desactiva el botón por su cuenta —eso lo decide quien lo usa, y a veces
   * hay que poder cancelar—, pero sí dice que hay algo en marcha. Hace falta
   * porque lo que más tarda aquí son las llamadas al modelo, que pueden pasarse
   * varios segundos: cambiar el rótulo a «Pensando…» y nada más deja dudando de
   * si se ha pulsado o si aquello se ha quedado colgado.
   */
  readonly cargando?: boolean;
  /**
   * `compacto` para el botón que va dentro de una caja o al lado de un texto
   * pequeño: 14 px en vez de 16. **Solo cambia la letra y el relleno de los
   * lados**: el alto sigue siendo el de pulsar.
   *
   * Existe porque quien lo quería pequeño lo pedía con `text-xs` en `className`,
   * y los botones salían de 12, 14 y 16 px con el mismo alto.
   */
  readonly tamano?: ButtonSize;
}

/**
 * La ruedecilla, **solo para quien acepta movimiento**.
 *
 * La regla global de `prefers-reduced-motion` congela toda animación a
 * 0,01 ms, así que una ruedecilla ahí no gira: se queda un arco parado que
 * parece un símbolo raro. Con `motion-safe` no se dibuja siquiera, y quien pide
 * menos movimiento se queda con el rótulo —«Pensando…»—, que dice lo mismo.
 */
function Ruedecilla() {
  return (
    <span
      aria-hidden="true"
      className="hidden size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current motion-safe:inline-block"
    />
  );
}

/**
 * El botón de la aplicación.
 *
 * Cuatro cosas que no se ven por separado y juntas hacen que parezca un aparato
 * y no una página:
 *
 * - **Se hunde al pulsarlo** (`active:translate-y-px`). Un botón que no se mueve
 *   deja dudando de si se ha pulsado, y aquí se pulsa mirando de reojo.
 * - **Tiene un filo de luz arriba** (`inset` en la sombra). Es lo que hace que el
 *   latón parezca metal y no un rectángulo de color, y es la misma idea que el
 *   resto de la interfaz: un amplificador, no un formulario.
 * - **La transición es de 150 ms.** Por debajo no se percibe y por encima se nota
 *   lenta al encadenar acordes.
 * - **`cursor-pointer`, siempre.** Un `<button>` no lo trae de serie, y sin él la
 *   mitad de la interfaz no se siente pulsable aunque lo sea.
 *
 * Cuarenta y cuatro píxeles de alto, como todo lo que se pulsa aquí. El `gap`
 * está en la base y no en cada sitio: **todos los botones llevan ya icono y
 * texto**, y ese hueco escrito a mano quince veces acaba siendo quince huecos.
 */
const BASE =
  'inline-flex min-h-tap cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0';

// La letra y el relleno de los lados van aparte de la base: con los dos en ella,
// un `className` que quisiera otra medida dependía del orden en que Tailwind
// ordena sus clases, y no de lo que pedía quien lo escribía.
const TAMANOS: Record<ButtonSize, string> = {
  normal: 'px-5 text-base',
  compacto: 'px-4 text-sm',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brass text-background filo-luz hover:bg-brass-bright hover:filo-luz-alto',
  quiet:
    'border border-border text-text hover:border-brass-dim hover:text-brass-bright hover:bg-surface-raised',
  /**
   * Lo que borra, lo que descarta y lo que cierra una cuenta.
   *
   * Va en contorno y no relleno **a propósito**: un botón rojo macizo pesa más
   * que el que confirma, y en esta aplicación destruir nunca es la acción
   * principal. Se enciende al pasar por encima, que es cuando ya hay intención.
   */
  danger:
    'border border-border text-oxblood-bright hover:border-oxblood-bright hover:bg-oxblood/20',
};

/**
 * El mismo aspecto, para un enlace.
 *
 * Ocho `<Link>` con pinta de botón llevaban la cadena copiada, y al ganar `Button`
 * el alto de dedo y el hundido se quedaron atrás: eran botones de 40 px que no se
 * movían al pulsarlos. Se exporta el estilo en vez de un componente envoltorio
 * porque quien lo usa es `next/link`, y `ui/` no debe conocerlo.
 */
export function estiloBoton(
  variant: ButtonVariant = 'primary',
  className = '',
  tamano: ButtonSize = 'normal',
): string {
  return `${BASE} ${TAMANOS[tamano]} ${VARIANTS[variant]} ${className}`;
}

export function Button({
  variant = 'primary',
  className = '',
  type,
  cargando = false,
  tamano = 'normal',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // Sin esto, un botón dentro de un formulario lo enviaría sin querer.
      type={type ?? 'button'}
      aria-busy={cargando || undefined}
      className={estiloBoton(variant, className, tamano)}
      {...props}
    >
      {cargando && <Ruedecilla />}
      {children}
    </button>
  );
}
