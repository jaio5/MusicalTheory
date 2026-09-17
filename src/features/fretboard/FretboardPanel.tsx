'use client';

import { accidentalForScale, SCALES, scaleNotes, noteName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Fretboard } from './Fretboard';

/** Escala que se propone según el modo detectado, si no se ha elegido otra. */
export function FretboardPanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  /**
   * El acorde que hay elegido en el camino, para marcar sus notas en el mástil.
   *
   * El último del camino y no el que se está oyendo: el mástil se mira **antes**
   * de tocar, para ver dónde caen las notas del acorde que se va a hacer.
   */
  const elegido = useSessionStore((state) => state.path.at(-1) ?? null);

  return (
    // `grow`, para que el hueco del área llegue hasta el dibujo: el mástil se
    // acota con `max-h-full`, y un porcentaje no resuelve contra un padre de
    // alto automático —se quedaba en catorce píxeles—.
    <div className="flex min-h-0 grow flex-col">
      {activeKey === null ? (
        <p className="text-text-muted mt-6 shrink-0">
          Toca unas notas sueltas o elige una tonalidad arriba, y aquí sale la escala sobre el
          mástil.
        </p>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-text-muted text-sm">
              {SCALES[scaleId].name} de{' '}
              {noteName(activeKey.tonic, accidentalForScale(activeKey.tonic, scaleId))}:{' '}
              <span className="text-text font-mono">
                {scaleNotes(activeKey.tonic, scaleId)
                  .map((pitchClass) =>
                    noteName(pitchClass, accidentalForScale(activeKey.tonic, scaleId)),
                  )
                  .join(' · ')}
              </span>
            </p>
            {/* Con un acorde elegido, lo que dice el mástil ya no es la escala:
                es qué notas de la escala caen de pie sobre ese acorde. Se dice,
                porque el relleno solo no lo explica. */}
            <p className="text-text-muted text-sm">
              {elegido === null
                ? SCALES[scaleId].character
                : `Rellenas, las notas de ${elegido.symbol}: caen de pie. Las huecas entran de paso.`}
            </p>
          </div>

          {/* El alto lo pone el propio dibujo a partir de su proporción, y el
              hueco solo pone el techo. Estirándolo hasta el hueco, el mástil
              —casi cuatro veces más ancho que alto— se quedaba centrado con
              franjas muertas arriba y abajo; sin techo, en un área ancha y baja
              se salía por debajo. */}
          <div className="mt-3 flex min-h-0 grow flex-col">
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForScale(activeKey.tonic, scaleId)}
              scaleId={scaleId}
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
              chordNotes={elegido?.notes}
            />
          </div>
        </>
      )}
    </div>
  );
}
