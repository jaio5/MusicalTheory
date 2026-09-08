import type { ReactNode } from 'react';

/**
 * Lo que contesta un formulario: el error de arriba, o el «guardado» de después.
 *
 * Estaba escrito once veces entre las formas de la cuenta, el profesor, las
 * ideas y la grabadora, y lo importante no es el color: es que se **anuncie**.
 * Un mensaje que aparece a mitad de una pantalla no lo dice nadie si no se pide,
 * así que quien no ve la pantalla se queda pulsando «Guardar» sin saber que ya
 * está guardado —o que ha fallado—. Con la pieza suelta, ese atributo se olvida
 * a la tercera copia; y se olvidaba: de las once, cinco no lo llevaban.
 *
 * Los tres anuncios son los tres casos que hay de verdad en la aplicación, y no
 * un juego de opciones por si acaso. `mensaje` en nulo no pinta nada, para que
 * el sitio que lo usa no repita el `&&`.
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
  if (mensaje === null || mensaje === undefined || mensaje === false) {
    return null;
  }

  return (
    <p
      className={`text-sm ${tono === 'hecho' ? 'text-tube-bright' : 'text-oxblood-bright'} ${className}`}
      {...(anuncio === 'amable' ? { 'aria-live': 'polite' as const } : {})}
      {...(anuncio === 'urgente' ? { role: 'alert' } : {})}
    >
      {mensaje}
    </p>
  );
}
