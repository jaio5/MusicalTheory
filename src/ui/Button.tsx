import type { ButtonHTMLAttributes, MouseEvent, MouseEventHandler } from 'react';

export type ButtonVariant = 'primary' | 'quiet' | 'danger';
export type ButtonSize = 'normal' | 'compacto';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  /**
   * Que está trabajando: se dibuja la ruedecilla, se marca `aria-busy` y **el
   * botón deja de hacer caso sin dejar de existir**.
   *
   * Hace falta porque lo que más tarda aquí son las llamadas al modelo, que
   * pueden pasarse varios segundos: cambiar el rótulo a «Pensando…» y nada más
   * deja dudando de si se ha pulsado o si aquello se ha quedado colgado.
   *
   * **Con `aria-disabled` y no con `disabled`, a propósito.** Quien lo usaba lo
   * apagaba con `disabled` mientras trabajaba, y un botón que se apaga con el foco
   * dentro lo suelta: el navegador lo manda al `<body>`, el lector de pantalla
   * deja de decir dónde estás y el siguiente tabulador empieza otra vez por
   * arriba. Pasaba al entrar, al cambiar la contraseña y al pedir el enlace de la
   * olvidada. Así el foco se queda donde estaba, se anuncia «no disponible» y el
   * clic se ignora —también el que manda el formulario al pulsar Intro, que el
   * navegador escribe como un clic en este botón—.
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
 * Lo que hace que un botón trabaje **sin soltar el foco**: `aria-busy`,
 * `aria-disabled` y un clic que no hace nada.
 *
 * Suelto para el botón que no es un `Button` —el redondo del micro— y que
 * también se queda pensando mientras el navegador pide permiso: si lo apagara
 * con `disabled` perdería el foco igual que los formularios. El porqué entero
 * está en `cargando`.
 */
export function mientrasTrabaja<T extends Element>(
  cargando: boolean,
  onClick?: MouseEventHandler<T>,
): {
  readonly 'aria-busy': true | undefined;
  readonly 'aria-disabled': true | undefined;
  readonly onClick: MouseEventHandler<T> | undefined;
} {
  return {
    'aria-busy': cargando || undefined,
    'aria-disabled': cargando || undefined,
    // `preventDefault` y no solo no llamar a nadie: en un botón de enviar, el
    // clic es lo que manda el formulario, y cancelarlo es lo que lo para.
    onClick: cargando ? (evento: MouseEvent<T>) => evento.preventDefault() : onClick,
  };
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
 * - **La transición es de 150 ms**, con la curva de la casa (`ease-salida`), y el
 *   hundido de 75: por debajo no se percibe y por encima se nota lenta al
 *   encadenar acordes. El paso del ratón solo cambia lo que **se puede** pulsar
 *   (`not-disabled:`, que vale también para un enlace con pinta de botón; `enabled:` no lo haría): un botón apagado que se enciende al pasar por encima miente. Y
 *   `not-aria-disabled:` por lo mismo: el que trabaja tampoco se enciende.
 * - **`cursor-pointer`, siempre.** Un `<button>` no lo trae de serie, y sin él la
 *   mitad de la interfaz no se siente pulsable aunque lo sea.
 *
 * Cuarenta y cuatro píxeles de alto, como todo lo que se pulsa aquí. El `gap`
 * está en la base y no en cada sitio: **todos los botones llevan ya icono y
 * texto**, y ese hueco escrito a mano quince veces acaba siendo quince huecos.
 */
const BASE =
  'inline-flex min-h-tap cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 font-semibold tracking-[0.005em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-salida active:translate-y-px active:duration-75 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 aria-disabled:cursor-progress aria-disabled:active:translate-y-0';

// La letra y el relleno de los lados van aparte de la base: con los dos en ella,
// un `className` que quisiera otra medida dependía del orden en que Tailwind
// ordena sus clases, y no de lo que pedía quien lo escribía.
const TAMANOS: Record<ButtonSize, string> = {
  normal: 'px-5 text-base',
  compacto: 'px-4 text-sm',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brass text-background filo-luz not-disabled:not-aria-disabled:hover:bg-brass-bright not-disabled:not-aria-disabled:hover:filo-luz-alto',
  /**
   * Lo secundario: la otra salida, la que no es la de la pantalla.
   *
   * Con fondo propio y no solo borde: un contorno de 1,3:1 sobre la pared es una
   * caja que no se sabe si es un botón o un recuadro. El fondo de superficie dice
   * «esto es una pieza» y el borde se enciende al pasar.
   */
  quiet:
    'border border-border bg-surface text-text filo-luz not-disabled:not-aria-disabled:hover:border-brass-dim not-disabled:not-aria-disabled:hover:text-brass-bright not-disabled:not-aria-disabled:hover:bg-surface-raised',
  /**
   * Lo que borra, lo que descarta y lo que cierra una cuenta.
   *
   * Va en contorno y no relleno **a propósito**: un botón rojo macizo pesa más
   * que el que confirma, y en esta aplicación destruir nunca es la acción
   * principal. Se enciende al pasar por encima, que es cuando ya hay intención.
   */
  danger:
    'border border-border bg-surface text-oxblood-bright not-disabled:not-aria-disabled:hover:border-oxblood-bright not-disabled:not-aria-disabled:hover:bg-oxblood/20',
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
  onClick,
  children,
  ...props
}: ButtonProps) {
  const trabajando = mientrasTrabaja(cargando, onClick);
  return (
    <button
      // Sin esto, un botón dentro de un formulario lo enviaría sin querer.
      type={type ?? 'button'}
      className={estiloBoton(variant, className, tamano)}
      {...props}
      // Después de `props`, para que un `aria-disabled` de fuera no le quite la
      // marca a un botón que está trabajando, ni lo deje sin ella si no trabaja.
      {...trabajando}
      aria-disabled={trabajando['aria-disabled'] ?? props['aria-disabled']}
    >
      {cargando && <Ruedecilla />}
      {children}
    </button>
  );
}
