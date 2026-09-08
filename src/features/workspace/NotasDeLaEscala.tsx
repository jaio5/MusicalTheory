'use client';

import { SCALES, scaleNoteNames } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

/**
 * Las notas de la escala que hay puesta, debajo del selector que la elige.
 *
 * Es el dato que la aplicación tenía y **no enseñaba en ningún sitio donde se
 * mira**: para saber qué notas caben en Do menor había que abrir el mástil, que
 * ocupa media pantalla y responde a otra pregunta —dónde están, no cuáles son—.
 * Aquí caben en un renglón, justo debajo del desplegable con el que se acaba de
 * elegir la escala, y llenan el hueco que la columna de tonalidad tenía vacío.
 *
 * Van en monoespaciada porque son datos que se comparan de un vistazo, y con la
 * alteración que les toca: la pentatónica menor de Do sale de Mi bemol, así que
 * se escribe con bemoles y no con sostenidos. Eso lo decide `accidentalForScale`,
 * y por eso se pide `scaleNoteNames` en vez de nombrar las notas a mano.
 *
 * Sin tonalidad no hay nada que enseñar, y entonces no ocupa sitio.
 */
export function NotasDeLaEscala() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);

  if (activeKey === null) {
    return null;
  }

  const notas = scaleNoteNames(activeKey.tonic, scaleId);

  return (
    <div className="w-full">
      <ol
        aria-label={`Notas de la escala ${SCALES[scaleId].name}`}
        className="flex flex-wrap justify-center gap-1"
      >
        {notas.map((nota, indice) => (
          <li
            key={`${nota}-${indice}`}
            className={`border-border min-w-8 rounded-md border px-1.5 py-1 text-center font-mono text-sm ${
              // La tónica va marcada: es la nota a la que todo vuelve, y en una
              // fila de siete iguales no hay forma de saber por dónde empieza.
              indice === 0 ? 'border-brass-dim text-brass-bright bg-surface-raised' : 'text-text'
            }`}
          >
            {nota}
          </li>
        ))}
      </ol>
      <p className="text-text-muted mt-2 text-center text-xs text-balance">
        {SCALES[scaleId].character}
      </p>
    </div>
  );
}
