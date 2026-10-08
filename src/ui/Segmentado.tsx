'use client';

import type { ReactNode } from 'react';

/**
 * Elegir **una** de pocas opciones que se excluyen: rítmica o punteo, entrar o
 * crear la cuenta, partitura o bloques.
 *
 * Había cuatro maneras de pintar «esto está elegido» —un `Chip` marcado, un
 * `Button` primario, un segmentado cuadrado escrito a mano y la píldora de la
 * navegación— y la del botón primario era la peor: la opción elegida salía con
 * el mismo latón macizo que la acción de al lado, y no se sabía cuál de las dos
 * se pulsaba para hacer algo. Aquí la elegida lleva la marca del `Chip` —letra de
 * latón sobre la superficie alzada y su piloto encendido—, que dice «está puesto»
 * y no «púlsame»; el latón macizo queda para la acción.
 *
 * **Unidas en una pieza**, con el borde común y un solo radio por fuera. Sueltas,
 * dos opciones que se excluyen se leían como dos acciones independientes.
 *
 * El estado va en `aria-pressed` de cada botón, dentro de un `group` con nombre:
 * es lo que ya hacían las filas de `Chip` y lo que un lector de pantalla anuncia
 * como «conmutador, pulsado». Un `radiogroup` pediría moverse con flechas y una
 * sola parada del tabulador, y quien use esto con la guitarra puesta da al botón
 * que ve, no recorre un grupo.
 */
/**
 * El carril: hundido —el fondo de la pared y la sombra por dentro— para que lo
 * que sube a la superficie alzada se lea como una tecla abajo y las demás
 * arriba, un selector de un aparato y no una fila de botones. Lo comparte
 * `ui/Mandos`, que es la misma pieza con acciones en vez de opciones.
 */
export const CARRIL =
  'border-border bg-background inline-flex w-fit overflow-hidden rounded-md border shadow-[var(--sombra-hueco)]';

/**
 * Cada pieza del carril, sin borde propio: lo pone el grupo.
 *
 * **El aro del foco, hacia dentro** (`-outline-offset-3`). El de la casa va tres
 * píxeles por fuera, y aquí por fuera está el `overflow-hidden` del carril, que
 * lo recorta: con el tabulador no se veía cuál de las piezas tenía el foco.
 */
export const PIEZA =
  'min-h-tap min-w-tap ease-salida inline-flex cursor-pointer items-center justify-center gap-1.5 px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:-outline-offset-3';

/** Entre dos piezas, una raya del color del borde, que las une en vez de separarlas. */
export const PIEZA_SIGUIENTE = 'border-border border-l';

export interface OpcionSegmentada<T extends string> {
  readonly valor: T;
  readonly texto: ReactNode;
  /** Lo que se lee al pararse encima, si el texto no lo dice todo. */
  readonly title?: string;
}

export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
  className = '',
}: {
  /** El nombre del grupo, para quien no ve cómo se agrupan. */
  readonly etiqueta: string;
  readonly opciones: readonly OpcionSegmentada<T>[];
  readonly valor: T;
  readonly onCambiar: (valor: T) => void;
  readonly className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={`${CARRIL} ${className}`}>
      {opciones.map((opcion, i) => {
        const elegida = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={elegida}
            title={opcion.title}
            onClick={() => onCambiar(opcion.valor)}
            className={`${PIEZA} ${i > 0 ? PIEZA_SIGUIENTE : ''} ${
              elegida
                ? 'text-brass-bright bg-surface-raised filo-latón piloto'
                : 'text-text-muted hover:bg-surface-raised hover:text-text'
            }`}
          >
            {opcion.texto}
          </button>
        );
      })}
    </div>
  );
}
