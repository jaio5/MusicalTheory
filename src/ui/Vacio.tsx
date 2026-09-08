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
 * El icono va apagado a propósito: es decoración que orienta, y si pesa más que
 * el texto se convierte en lo que se mira.
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
          className={`border-border bg-surface text-brass flex items-center justify-center rounded-full border opacity-80 ${
            discreto ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6'
          }`}
        >
          {icono}
        </span>
      )}
      <p className={`text-text font-medium ${discreto ? 'text-sm' : 'text-base'}`}>{titulo}</p>
      {children !== undefined && (
        <p className={`text-text-muted max-w-sm text-balance ${discreto ? 'text-xs' : 'text-sm'}`}>
          {children}
        </p>
      )}
      {accion !== undefined && <div className={discreto ? '' : 'mt-1'}>{accion}</div>}
    </div>
  );
}
