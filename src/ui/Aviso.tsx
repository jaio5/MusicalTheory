import type { ReactNode } from 'react';

/**
 * Lo que contesta un formulario: el error de arriba, o el «guardado» de después.
 *
 * Estaba escrito once veces entre las formas de la cuenta, el profesor, las
 * ideas —ya retiradas— y la grabadora, y lo importante no es el color: es que
 * se **anuncie**.
 * Un mensaje que aparece a mitad de una pantalla no lo dice nadie si no se pide,
 * así que quien no ve la pantalla se queda pulsando «Guardar» sin saber que ya
 * está guardado —o que ha fallado—. Con la pieza suelta, ese atributo se olvida
 * a la tercera copia; y se olvidaba: de las once, cinco no lo llevaban.
 *
 * Los tres anuncios son los tres casos que hay de verdad en la aplicación, y no
 * un juego de opciones por si acaso.
 *
 * **La región está montada antes de que haya nada que decir** (`docs/ESTILO.md`).
 * Un lector de pantalla anuncia lo que *entra* en una región que ya estaba; una
 * que nace con el texto dentro no se lee en todos, y era justo lo que hacía esto:
 * devolvía nulo sin mensaje y aparecía entera con el error puesto. Así que sin
 * mensaje se pinta la caja vacía, y vacía no ocupa: `empty:sr-only` la saca del
 * flujo —ni alto ni hueco en la columna del formulario— sin sacarla del árbol de
 * accesibilidad, que es lo que haría un `hidden`. Solo `ninguno` sigue sin pintar
 * nada: sin anuncio no hay región que tener preparada.
 */
export function Aviso({
  mensaje,
  tono = 'error',
  anuncio = 'amable',
  className = '',
}: {
  readonly mensaje: ReactNode;
  /** `hecho` para lo que salió bien; `error` es lo que se supone si no se dice. */
  readonly tono?: 'error' | 'hecho';
  /**
   * `amable` interrumpe al lector de pantalla cuando termine la frase que iba
   * diciendo; `urgente` le corta, y es para lo que impide seguir; `ninguno` es
   * para cuando ya se está dentro de una caja que anuncia —dos regiones vivas
   * anidadas se leen dos veces o ninguna—.
   */
  readonly anuncio?: 'amable' | 'urgente' | 'ninguno';
  readonly className?: string;
}) {
  const vacio = mensaje === null || mensaje === undefined || mensaje === false;
  if (vacio && anuncio === 'ninguno') {
    return null;
  }

  return (
    <p
      className={`text-sm empty:sr-only ${tono === 'hecho' ? 'text-tube-bright' : 'text-oxblood-bright'} ${className}`}
      {...(anuncio === 'amable' ? { 'aria-live': 'polite' as const } : {})}
      {...(anuncio === 'urgente' ? { role: 'alert' } : {})}
    >
      {vacio ? null : mensaje}
    </p>
  );
}
