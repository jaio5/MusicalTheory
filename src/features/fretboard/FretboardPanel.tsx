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

  return (
    <div className="flex min-h-0 flex-col">
      {activeKey === null ? (
        <p className="text-text-muted mt-6 shrink-0">
          Toca unos compases o elige una tonalidad arriba, y aquí sale la escala sobre el mástil.
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
            <p className="text-text-muted text-sm">{SCALES[scaleId].character}</p>
          </div>

          {/* El alto lo pone el propio dibujo a partir de su proporción, no el
              hueco disponible. Estirándolo hasta el hueco, el mástil —casi
              cuatro veces más ancho que alto— se quedaba centrado con franjas
              muertas arriba y abajo. */}
          <div className="mt-3">
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForScale(activeKey.tonic, scaleId)}
              scaleId={scaleId}
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
            />
          </div>
        </>
      )}
    </div>
  );
}
