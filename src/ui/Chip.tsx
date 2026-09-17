'use client';

import type { ReactNode } from 'react';

/**
 * El botón pequeño de esta aplicación: elegir una opción de una fila.
 *
 * Lo usan las respuestas de una pregunta, las pestañas del taller, los controles
 * del metrónomo, las preguntas de arranque del profesor y el botón de descargar
 * una grabación. Antes cada uno se escribía sus clases y salían de veintiséis, de
 * treinta y cuatro y de treinta y ocho píxeles de alto según el sitio.
 *
 * **Cuarenta y cuatro, y también de ancho.** Es el mínimo con el que un dedo
 * acierta, y aquí no es un número de guía de estilo: esta aplicación se usa con la
 * guitarra puesta, mirando de reojo y dando al botón sin apuntar. Lo que cambia
 * entre unos y otros es el relleno de los lados y la letra, no la medida.
 *
 * El ancho hacía falta decirlo aparte porque el alto lo fijaba el `min-h` y el
 * ancho lo ponía el contenido: los del metrónomo, que son **un solo glifo** —«−»
 * y «+»—, salían de cuarenta y dos con el relleno incluido. Dos píxeles de menos
 * en los dos únicos botones que se dan a ciegas mientras suena el clic.
 *
 * El estado va en `aria-pressed` y no solo en el color, porque un lector de
 * pantalla no ve el borde de latón. `acierto` y `fallo` son los dos colores que
 * necesita una respuesta ya contestada, y están aquí y no sueltos en la pregunta
 * porque son la misma pieza en otro estado, no otra pieza.
 *
 * **La letra es la sans, no la monoespaciada.** Lo era, y con eso las respuestas
 * de una pregunta, las pestañas del taller y los botones del metrónomo se leían
 * como la salida de un terminal. La monoespaciada de esta aplicación es para lo
 * que se alinea en columna y se compara dígito a dígito —cents, hercios,
 * compases, un cifrado— y una pastilla no es nada de eso. Lo que sí conserva la
 * mono es su contenido cuando *es* un dato: quien la usa pasa `font-mono` en
 * `className`, que es una decisión por sitio y no por componente.
 */
const TONOS = {
  normal: 'border-border text-text enabled:hover:border-brass-dim enabled:hover:bg-surface-raised',
  quiet: 'border-border text-text-muted enabled:hover:bg-surface-raised enabled:hover:text-text',
  acierto: 'border-tube-bright text-tube-bright',
  fallo: 'border-oxblood-bright text-oxblood-bright',
} as const;

export type ChipTone = keyof typeof TONOS;

export function Chip({
  children,
  onClick,
  pressed,
  disabled = false,
  tone = 'normal',
  title,
  className = '',
  ariaLabel,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  /** Si es una opción que queda marcada. Sin esto es un botón de acción. */
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  /** `quiet` para lo secundario de una fila; `acierto`/`fallo` para lo corregido. */
  readonly tone?: ChipTone;
  readonly title?: string;
  /** Para colocarlo en su fila —`ml-auto`— o cambiarle la letra. */
  readonly className?: string;
  readonly ariaLabel?: string;
}) {
  // Cuando la respuesta ya está corregida manda el color de la corrección, no el
  // de estar marcada: una opción elegida y fallada es roja, no de latón. La marca
  // sigue viajando en `aria-pressed`, que es lo que lee quien no ve el color.
  const corregido = tone === 'acierto' || tone === 'fallo';
  const marcado = pressed === true && !corregido;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={title}
      aria-label={ariaLabel}
      // **Lo corregido no se apaga.** Al contestar, las opciones se desactivan y
      // el `disabled:opacity-40` las dejaba todas al cuarenta por ciento: la
      // acertada en verde y la fallada en rojo son justo lo que hay que leer
      // entonces, y quedaban por debajo del contraste mínimo. Se apaga lo que ya
      // no dice nada —las opciones que ni eran ni se eligieron— y se queda a todo
      // color lo que corrige.
      className={`min-h-tap min-w-tap inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 enabled:active:translate-y-px disabled:cursor-default ${
        corregido ? '' : 'disabled:opacity-40'
      } ${
        marcado ? 'border-brass-bright text-brass-bright bg-surface-raised filo-latón' : TONOS[tone]
      } ${className}`}
    >
      {children}
    </button>
  );
}
