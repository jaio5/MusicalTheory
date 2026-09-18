import type { ReactNode } from 'react';

import { Chevron } from './Chevron';

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
 *
 * **Y se pliega a una tira.** Con las cinco áreas abiertas la pantalla se lee
 * como un panel de control: cinco cosas pidiendo la mirada a la vez y ninguna
 * mandando. Plegada, un área queda en una tira con su icono —lo justo para
 * saber que está ahí y volver a abrirla de un clic— y le devuelve el sitio a lo
 * que se está haciendo. Lo que decide cuáles vienen plegadas es el espacio de
 * trabajo, que trae su reparto de fábrica.
 */
export function Area({
  titulo,
  icono,
  mandos,
  children,
  className = '',
  scroll = true,
  plegada = false,
  onPlegar,
  atajo,
  pliegue = 'vertical',
  sinCabecera = false,
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
  /** Si está plegada a su tira. Lo decide quien la monta. */
  readonly plegada?: boolean;
  /** Plegarla y desplegarla. Sin esto, el área no se pliega. */
  readonly onPlegar?: () => void;
  /**
   * La tecla que la pliega y la devuelve, si la tiene.
   *
   * Un área que se puede esconder **tiene que decir cómo se devuelve**
   * ([adr/0031](../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)), y la
   * tira plegada es justo donde se busca: es lo único que queda en pantalla de
   * ella. Va en el `title` y en `aria-keyshortcuts`.
   */
  readonly atajo?: string;
  /**
   * Hacia dónde se pliega: una columna deja una tira de pie y una fila deja una
   * barra tumbada.
   */
  readonly pliegue?: 'vertical' | 'horizontal';
  /**
   * Sin cabecera, para cuando algo de fuera ya la hace.
   *
   * En estrecho las áreas se eligen con pestañas, y la pestaña marcada ya dice
   * el nombre: repetirlo justo debajo son veintiocho píxeles y una palabra de
   * más en la pantalla donde menos sitio hay.
   */
  readonly sinCabecera?: boolean;
}) {
  if (plegada && onPlegar !== undefined) {
    const depie = pliegue === 'vertical';
    return (
      <button
        type="button"
        onClick={onPlegar}
        aria-expanded={false}
        aria-label={`Desplegar ${titulo}`}
        title={atajo === undefined ? `Desplegar ${titulo}` : `Desplegar ${titulo} · ${atajo}`}
        aria-keyshortcuts={atajo}
        // La tira mide lo mismo que una cabecera, para que plegar no mueva de
        // sitio las líneas de la pantalla. Y lleva `size-tap` de fondo: es un
        // botón, y aquí los botones se pulsan con el dedo.
        className={`bg-surface border-border text-text-muted hover:text-brass-bright hover:bg-surface-raised flex shrink-0 cursor-pointer items-center justify-center gap-2 transition-colors ${
          depie ? 'min-w-tap w-7 flex-col border-r py-2' : 'min-h-tap w-full border-t px-2'
        } ${className}`}
      >
        <span aria-hidden="true" className="[&_svg]:size-3.5">
          {icono}
        </span>
        <span
          aria-hidden="true"
          className={`text-xs whitespace-nowrap ${depie ? '[writing-mode:vertical-rl]' : ''}`}
        >
          {titulo}
        </span>
      </button>
    );
  }

  return (
    <section
      aria-label={titulo}
      className={`bg-surface flex min-h-0 min-w-0 flex-col ${className}`}
    >
      {sinCabecera ? null : (
        <header className="border-border text-text-muted flex h-7 shrink-0 items-center gap-2 border-b px-2">
          {icono !== undefined && (
            <span aria-hidden="true" className="shrink-0 opacity-70 [&_svg]:size-3.5">
              {icono}
            </span>
          )}
          <h2 className="min-w-0 truncate text-xs font-medium">{titulo}</h2>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {mandos}
            {onPlegar !== undefined && (
              <button
                type="button"
                onClick={onPlegar}
                aria-expanded
                aria-label={`Plegar ${titulo}`}
                title={atajo === undefined ? `Plegar ${titulo}` : `Plegar ${titulo} · ${atajo}`}
                aria-keyshortcuts={atajo}
                className="hover:text-brass-bright inline-flex cursor-pointer items-center px-1"
              >
                <Chevron className={`size-3 ${pliegue === 'vertical' ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
        </header>
      )}

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
