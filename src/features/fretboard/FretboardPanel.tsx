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
    <div className="flex h-full min-h-0 flex-col">
      {activeKey === null ? (
        <p className="text-text-muted mt-6 shrink-0">
          Toca unos compases o elige una tonalidad arriba, y aquí sale la escala sobre el mástil.
        </p>
      ) : (
        <>
          <p className="text-text-muted mt-2 shrink-0 text-sm">
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

          {/* El dibujo se queda con el alto que sobre y se encoge hasta caber:
              un mástil que hay que arrastrar para ver el traste doce no sirve
              con la guitarra en las manos. */}
          <div className="mt-4 min-h-0 grow">
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForScale(activeKey.tonic, scaleId)}
              scaleId={scaleId}
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
            />
          </div>

          <p className="text-text-muted mt-3 shrink-0 text-sm">{SCALES[scaleId].character}</p>
        </>
      )}
    </div>
  );
}
