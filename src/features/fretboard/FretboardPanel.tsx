'use client';

import {
  accidentalForKey,
  SCALE_IDS,
  SCALES,
  scaleNotes,
  spanishNoteName,
  type ScaleId,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Fretboard } from './Fretboard';

/** Escala que se propone según el modo detectado, si no se ha elegido otra. */
export function FretboardPanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  const actions = useSessionStore((state) => state.actions);

  return (
    <section aria-labelledby="mastil" className="border-border bg-surface rounded-lg border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="mastil" className="font-display text-text text-2xl">
          Mástil
        </h2>

        <label className="flex items-center gap-2">
          <span className="text-text-muted text-sm">Escala</span>
          <select
            className="border-border bg-background text-text rounded-md border px-3 py-2"
            value={scaleId}
            onChange={(event) => actions.setScale(event.target.value as ScaleId)}
          >
            {SCALE_IDS.map((id) => (
              <option key={id} value={id}>
                {SCALES[id].name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeKey === null ? (
        <p className="text-text-muted mt-6">
          Toca unos compases o elige una tonalidad arriba, y aquí sale la escala sobre el mástil.
        </p>
      ) : (
        <>
          <p className="text-text-muted mt-2 text-sm">
            {SCALES[scaleId].name} de{' '}
            {spanishNoteName(activeKey.tonic, accidentalForKey(activeKey.tonic, activeKey.mode))}:{' '}
            <span className="text-text font-mono">
              {scaleNotes(activeKey.tonic, scaleId)
                .map((pitchClass) =>
                  spanishNoteName(pitchClass, accidentalForKey(activeKey.tonic, activeKey.mode)),
                )
                .join(' · ')}
            </span>
          </p>

          <div className="mt-4 overflow-x-auto">
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForKey(activeKey.tonic, activeKey.mode)}
              scaleId={scaleId}
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
            />
          </div>

          <p className="text-text-muted mt-4 text-sm">{SCALES[scaleId].character}</p>
        </>
      )}
    </section>
  );
}
