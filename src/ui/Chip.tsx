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
 * **Lo marcado lleva su piloto** (`.piloto` de `globals.css`): letra de latón vivo
 * sobre la superficie alzada y una luz encendida debajo. Era un borde de latón
 * vivo, y al lado de un botón principal relleno del mismo latón no se sabía cuál
 * de los dos estaba puesto y cuál se pulsaba. El estado va además en
 * `aria-pressed`, porque un lector de pantalla no ve la luz.
 *
 * `quiet` va sin borde hasta que se pasa por encima: es lo secundario de una fila,
 * y seis contornos iguales en fila se leen como una rejilla, no como opciones.
 * **Las respuestas de una pregunta no son eso**: fueron `quiet` y salían como el
 * texto más gris y pequeño de la pantalla, sin borde ni fondo hasta pasar el
 * ratón, que a un metro y con el dedo no se pasa. Para ellas está `opcion`: el
 * borde fuerte de un control, fondo de superficie y la letra de leer, que es lo
 * que dice «esto se elige». `acierto` y `fallo` son los dos colores que
 * necesita una respuesta ya contestada, y están aquí y no sueltos en la pregunta
 * porque son la misma pieza en otro estado, no otra pieza; llevan el mismo fondo
 * que `opcion`, que es de donde vienen.
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
  normal:
    'border-border bg-surface text-text enabled:hover:border-brass-dim enabled:hover:bg-surface-raised',
  quiet:
    'border-transparent text-text-muted enabled:hover:border-border enabled:hover:bg-surface-raised enabled:hover:text-text',
  opcion:
    'border-border-strong bg-surface text-text enabled:hover:border-brass-dim enabled:hover:bg-surface-raised',
  acierto: 'border-tube-bright bg-surface text-tube-bright',
  fallo: 'border-oxblood-bright bg-surface text-oxblood-bright',
} as const;

export type ChipTone = keyof typeof TONOS;
export type ChipSize = 'normal' | 'compacto' | 'grande';

// 14 y 13 px, y el relleno de los lados que cuadra con cada uno. El alto no
// entra: es `min-h-tap` en los dos. `grande` es la respuesta de una pregunta:
// la letra de leer y un relleno que la sube a 58 px, porque es lo único que hay
// que pulsar en su pantalla y se pulsa desde un metro. Va aquí y no en un
// `text-base` de `className`, que perdía contra el `text-sm` de la pieza.
//
// **Los 13 del compacto, en `rem`.** Iban en píxeles y eran la única letra de la
// pieza que no crecía con la del navegador: al 200 %, la normal pasaba a 28 y la
// compacta se quedaba en 13 (WCAG 1.4.4).
const TAMANOS: Record<ChipSize, string> = {
  normal: 'px-3.5 text-sm',
  compacto: 'px-3 text-[0.8125rem]',
  grande: 'px-3 py-4 text-base',
};

export function Chip({
  children,
  onClick,
  pressed,
  disabled = false,
  tone = 'normal',
  title,
  atajo,
  className = '',
  ariaLabel,
  tamano = 'normal',
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  /** Si es una opción que queda marcada. Sin esto es un botón de acción. */
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  /**
   * `quiet` para lo secundario de una fila; `opcion` para una respuesta entre
   * varias; `acierto`/`fallo` para lo corregido.
   */
  readonly tone?: ChipTone;
  readonly title?: string;
  /**
   * La tecla que hace esto, si la hay.
   *
   * Sale en el `title` y en `aria-keyshortcuts`, que son los dos sitios donde se
   * busca: el ratón parándose encima y el lector de pantalla al llegar al botón.
   * Un atajo que no se anuncia en ninguno de los dos no existe para nadie que no
   * se haya leído el código.
   */
  readonly atajo?: string;
  /** Para colocarlo en su fila —`ml-auto`— o cambiarle la letra. */
  readonly className?: string;
  readonly ariaLabel?: string;
  /**
   * `compacto` para una fila apretada: una letra menos, el mismo alto de dedo;
   * `grande` para una respuesta, a 16 px y más alta. Es lo que hace que nadie
   * tenga que pasar `text-xs` ni `text-base` en `className`.
   */
  readonly tamano?: ChipSize;
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
      title={atajo === undefined ? title : `${title ?? ariaLabel ?? ''} · ${atajo}`.trim()}
      aria-keyshortcuts={atajo}
      aria-label={ariaLabel}
      // **Lo corregido no se apaga.** Al contestar, las opciones se desactivan y
      // el `disabled:opacity-40` las dejaba todas al cuarenta por ciento: la
      // acertada en verde y la fallada en rojo son justo lo que hay que leer
      // entonces, y quedaban por debajo del contraste mínimo. Se apaga lo que ya
      // no dice nada —las opciones que ni eran ni se eligieron— y se queda a todo
      // color lo que corrige.
      className={`min-h-tap min-w-tap ease-salida inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 enabled:active:translate-y-px disabled:cursor-default ${
        corregido ? '' : 'disabled:opacity-40'
      } ${
        marcado
          ? 'border-brass-dim text-brass-bright bg-surface-raised filo-latón piloto'
          : TONOS[tone]
      } ${TAMANOS[tamano]} ${className}`}
    >
      {children}
    </button>
  );
}
