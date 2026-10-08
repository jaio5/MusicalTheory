import type { ReactNode } from 'react';

/**
 * Lo que se ve cuando todavía no hay nada.
 *
 * Era una línea de texto gris en mitad de una pantalla negra, y así estaban seis
 * sitios: «Elige una tonalidad en la rueda y empezamos», centrada en cuatrocientos
 * píxeles de nada. Dice lo que hay que hacer, sí, pero no **dónde**, y quien
 * acaba de entrar mira una pantalla vacía con una frase flotando.
 *
 * Aquí lleva tres cosas y las tres hacen falta:
 *
 * - **Un dibujo**, que es lo que hace que el hueco parezca a propósito y no un
 *   fallo de carga.
 * - **Un título corto** con lo que falta, no con lo que no hay.
 * - **La acción, si la hay.** «Elige una tonalidad» sin ofrecer dónde elegirla es
 *   la manera más corta de dejar a alguien parado; es la misma lección que ya
 *   había costado un `defaultOpen` en `ui/Disclosure`.
 *
 * El icono va en un hueco y no en una pastilla: es decoración que orienta, y si
 * pesa más que el texto se convierte en lo que se mira.
 */
export function Vacio({
  icono,
  titulo,
  children,
  accion,
  tono = 'normal',
}: {
  /** Un icono de `ui/icons`, o cualquier dibujo. */
  readonly icono?: ReactNode;
  readonly titulo: string;
  /** Qué hay que hacer, en una o dos frases. */
  readonly children?: ReactNode;
  /** El botón o el enlace que lleva a hacerlo. */
  readonly accion?: ReactNode;
  /**
   * `normal` es el que ocupa una pantalla; `discreto`, el que vive al final de
   * una columna que ya tiene contenido encima.
   *
   * Dos y no cuatro: la diferencia real es si esto **es** la pantalla o es lo
   * último de ella. Con el tamaño de pantalla en una columna estrecha, la acción
   * se iba por debajo del pliegue, y una invitación que hay que buscar
   * desplazándose no invita a nada.
   */
  readonly tono?: 'normal' | 'discreto';
}) {
  const discreto = tono === 'discreto';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        discreto ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10'
      }`}
    >
      {icono !== undefined && (
        <span
          aria-hidden="true"
          // Un hueco redondo con el dibujo dentro, como el zócalo de un piloto
          // apagado: dice «aquí irá algo» sin pesar más que el título.
          className={`hueco text-brass flex items-center justify-center rounded-full ${
            discreto ? 'size-11 [&_svg]:size-5' : 'size-16 [&_svg]:size-7'
          }`}
        >
          {icono}
        </span>
      )}
      {/* El título en la letra de los titulares: es lo que falta, dicho como se
          dice el nombre de una pantalla, y no una línea más de texto. */}
      <p
        className={`titular text-text ${discreto ? 'text-base' : 'text-xl'} ${discreto ? '' : 'mt-1'}`}
      >
        {titulo}
      </p>
      {children !== undefined && (
        <p className="text-text-muted max-w-sm text-balance">{children}</p>
      )}
      {/* **Con todo el ancho y la acción centrada dentro.** Sin `w-full`, este div
          en una columna `items-center` encogía a lo que midiera su contenido, y una
          acción que se reparte el ancho —los cuatro botones de
          `ui/EmpezarPorTonalidad`, con su `@container`— se quedaba en 42 px cada
          uno y salían montados. Medido en `/aprender/e1-grados`. Con un botón suelto
          no cambia nada: `justify-center` lo deja donde estaba. */}
      {accion !== undefined && (
        <div className={`flex w-full justify-center ${discreto ? '' : 'mt-1'}`}>{accion}</div>
      )}
    </div>
  );
}
