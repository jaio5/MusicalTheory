'use client';

/**
 * Dónde ha dejado cada uno al profesor.
 *
 * Vive fuera de los componentes porque **cada pantalla monta su propio muñeco**
 * —el camino, la unidad y el repaso—, y sin un sitio compartido, moverlo en una
 * pantalla y encontrarlo en la esquina de siempre en la siguiente sería como si
 * no lo hubieras movido.
 *
 * En `localStorage` y no en IndexedDB, por lo mismo que el avance del temario:
 * son treinta bytes que hay que leer antes de pintar, y para eso lo síncrono es
 * una ventaja, no un problema.
 *
 * Se lee con `useSyncExternalStore`, que es lo que React trae justo para esto:
 * el servidor pinta el sitio por defecto, el navegador el guardado, y la
 * diferencia entre los dos la resuelve React sin que haya que meter estado en un
 * efecto ni un primer fotograma en blanco.
 */

export type LadoTutor = 'izquierda' | 'derecha';

export interface SitioTutor {
  readonly lado: LadoTutor;
  /**
   * A qué altura, en tanto por ciento del alto de la ventana.
   *
   * En porcentaje y no en píxeles para que al girar el móvil o cambiar el tamaño
   * de la ventana siga a la misma altura relativa en vez de quedarse fuera de la
   * pantalla o pegado al borde.
   */
  readonly alto: number;
}

/**
 * Abajo del todo y a la derecha.
 *
 * Estuvo a tres cuartos de altura, y ahí flotaba justo encima del camino de
 * unidades en un teléfono y encima de las medallas en un escritorio: el muñeco
 * tapaba lo que se había venido a leer. Bajarlo al borde arregló la altura pero
 * no el lado: en el camino, la esquina de abajo a la izquierda es donde acaba la
 * lista de medallas, y allí el muñeco se comía dos renglones de texto.
 *
 * A la derecha no. Las tres pantallas donde sale —el camino, la unidad y el
 * repaso— tienen la columna ancha a la izquierda y aire a la derecha, y ese es
 * además el rincón donde todo el mundo espera encontrar un ayudante flotante.
 * Sigue arrastrándose a donde cada uno quiera.
 */
export const SITIO_POR_DEFECTO: SitioTutor = { lado: 'derecha', alto: 90 };

const CLAVE = 'caos-ordenado:sitio-del-profesor';

let actual: SitioTutor = SITIO_POR_DEFECTO;
let leido = false;
const oyentes = new Set<() => void>();

function limpiar(valor: unknown): SitioTutor {
  if (typeof valor !== 'object' || valor === null) {
    return SITIO_POR_DEFECTO;
  }
  const record = valor as Record<string, unknown>;
  const lado = record['lado'] === 'derecha' ? 'derecha' : 'izquierda';
  const alto =
    typeof record['alto'] === 'number' && Number.isFinite(record['alto'])
      ? record['alto']
      : SITIO_POR_DEFECTO.alto;

  // Entre el 5 y el 90 por ciento: más arriba se mete debajo de la cabecera y más
  // abajo se esconde tras la barra de navegación del móvil.
  return { lado, alto: Math.min(90, Math.max(5, alto)) };
}

function leer(): SitioTutor {
  if (leido || typeof localStorage === 'undefined') {
    return actual;
  }
  leido = true;
  try {
    const guardado = localStorage.getItem(CLAVE);
    actual = guardado === null ? SITIO_POR_DEFECTO : limpiar(JSON.parse(guardado));
  } catch {
    // Un JSON roto o el almacenamiento bloqueado: se queda el sitio de siempre,
    // que es mejor que no pintar el muñeco.
    actual = SITIO_POR_DEFECTO;
  }
  return actual;
}

export function suscribirseAlSitio(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function sitioDelTutor(): SitioTutor {
  return leer();
}

/** El de siempre para el servidor: allí no hay ventana donde haberlo movido. */
export function sitioDelTutorEnServidor(): SitioTutor {
  return SITIO_POR_DEFECTO;
}

export function moverTutor(sitio: SitioTutor): void {
  actual = limpiar(sitio);
  leido = true;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // Sin permiso para guardar, se queda movido hasta que se recargue. Que no se
    // pueda recordar no es motivo para no dejarlo mover.
  }
  for (const oyente of oyentes) {
    oyente();
  }
}

/**
 * A qué lado se va al soltarlo.
 *
 * Solo hay dos sitios posibles, y es a propósito: un muñeco que se queda donde lo
 * sueltes acaba en mitad de la pantalla tapando justo lo que estabas leyendo. Se
 * pega al borde más cercano —el de la izquierda si su centro está en la mitad
 * izquierda— y conserva la altura, que es lo que de verdad se elige.
 */
export function ladoMasCercano(centroX: number, anchoVentana: number): LadoTutor {
  return centroX < anchoVentana / 2 ? 'izquierda' : 'derecha';
}
