import type { ReactNode } from 'react';

/**
 * Un área del banco de trabajo: su cabecera fina y lo que hay dentro.
 *
 * La cabecera es **de veintiocho píxeles y lleva sus propios mandos**, que es la
 * idea entera: los controles de una cosa viven en esa cosa, y no en un ajustes
 * común donde hay que averiguar de qué es cada interruptor. Lo que antes era un
 * rótulo suelto encima de un bloque —un cartel para explicar algo que no se
 * entiende solo— aquí es el sitio donde están el nombre y los dos botones que
 * cambian lo que se ve debajo.
 *
 * **No lleva sombra ni esquinas redondeadas.** Un área no es una tarjeta: es una
 * parte de la pantalla, y se separa de la de al lado con el mismo borde de 1 px
 * que separa todo lo demás. Poner relieve a cada una convierte el banco en un
 * tablero de fichas.
 *
 * El `<section>` va con su nombre accesible aunque el título se vea: quien
 * navega por regiones necesita poder saltar de un área a otra, que es como se
 * usa esto con teclado.
 */
export function Area({
  titulo,
  icono,
  mandos,
  children,
  className = '',
  scroll = true,
}: {
  readonly titulo: string;
  /** El dibujo del área, si lo tiene. Es decoración que orienta. */
  readonly icono?: ReactNode;
  /** Los dos o tres controles de esta área, a la derecha de su nombre. */
  readonly mandos?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  /**
   * Si lo de dentro se desplaza cuando no cabe.
   *
   * En falso para lo que se dibuja entero y no hace scroll nunca —el mástil—,
   * que es una decisión que ya estaba tomada y aquí se respeta.
   */
  readonly scroll?: boolean;
}) {
  return (
    <section
      aria-label={titulo}
      className={`bg-surface flex min-h-0 min-w-0 flex-col ${className}`}
    >
      <header className="border-border text-text-muted flex h-7 shrink-0 items-center gap-2 border-b px-2">
        {icono !== undefined && (
          <span aria-hidden="true" className="shrink-0 opacity-70 [&_svg]:size-3.5">
            {icono}
          </span>
        )}
        <h2 className="min-w-0 truncate text-xs font-medium">{titulo}</h2>
        {mandos !== undefined && (
          <div className="ml-auto flex shrink-0 items-center gap-1">{mandos}</div>
        )}
      </header>

      {/* Columna flexible y no un bloque: lo que va dentro de un área suele ser
          una pieza que quiere ocupar el hueco —el lienzo del arreglo es un
          `grow`— y dentro de un bloque `grow` no significa nada, así que se
          quedaba con su alto natural y se salía por abajo. */}
      <div
        className={`flex min-h-0 grow flex-col ${scroll ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        {children}
      </div>
    </section>
  );
}
