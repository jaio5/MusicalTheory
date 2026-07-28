'use client';

import {
  degreeOfChord,
  diatonicTriads,
  isHeptatonic,
  keyName,
  nextDegrees,
  progressionsFor,
  resolveDegree,
  resolveProgression,
  spanishNoteName,
  type HeptatonicScaleId,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

/**
 * Escala con la que se arman los acordes de la tonalidad. La escala elegida en
 * el mástil puede ser pentatónica o de blues, y sobre cinco o seis notas no se
 * pueden apilar terceras: en ese caso se usa la mayor o la menor natural, que
 * es de donde salen los acordes de esa tonalidad de todas formas.
 */
function harmonyScale(mode: 'major' | 'minor', scaleId: string): HeptatonicScaleId {
  if (isHeptatonic(scaleId as HeptatonicScaleId)) {
    return scaleId as HeptatonicScaleId;
  }
  return mode === 'major' ? 'major' : 'naturalMinor';
}

export function ComposePanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const history = useSessionStore((state) => state.noteHistory);
  const currentDegree = useSessionStore((state) => state.currentDegree);
  const actions = useSessionStore((state) => state.actions);

  if (activeKey === null) {
    return (
      <section
        aria-labelledby="componer"
        className="border-border bg-surface rounded-lg border p-6"
      >
        <h2 id="componer" className="font-display text-text text-2xl">
          Componer
        </h2>
        <p className="text-text-muted mt-4">
          Toca unos compases o elige una tonalidad, y aquí salen sus acordes y a dónde ir desde cada
          uno.
        </p>
      </section>
    );
  }

  const scale = harmonyScale(activeKey.mode, scaleId);
  const triads = diatonicTriads(activeKey.tonic, scale);
  const moves = currentDegree === null ? [] : nextDegrees(activeKey.mode, currentDegree);

  return (
    <section aria-labelledby="componer" className="border-border bg-surface rounded-lg border p-6">
      <h2 id="componer" className="font-display text-text text-2xl">
        Componer
      </h2>
      <p className="text-text-muted mt-2 text-sm">
        Acordes de {keyName(activeKey.tonic, activeKey.mode)}. Pulsa el que estés tocando y te digo
        a dónde suele ir.
      </p>

      <ul className="mt-6 flex flex-wrap gap-2">
        {triads.map((chord) => {
          const degree = degreeOfChord(activeKey.tonic, activeKey.mode, chord.root, chord.quality);
          const selected = degree !== null && degree === currentDegree;

          return (
            <li key={chord.symbol}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={degree === null}
                onClick={() => actions.setCurrentDegree(selected ? null : degree)}
                className={`rounded-md border px-4 py-3 text-left transition-colors disabled:opacity-40 ${
                  selected
                    ? 'border-brass-bright bg-surface-raised'
                    : 'border-border hover:border-brass-dim'
                }`}
              >
                <span
                  className={`block font-mono text-lg ${selected ? 'text-brass-bright' : 'text-text'}`}
                >
                  {chord.symbol}
                </span>
                <span className="text-text-muted block font-mono text-xs">{chord.roman}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {currentDegree !== null && (
        <div className="mt-8">
          <h3 className="text-text-muted text-xs tracking-widest uppercase">
            Desde {resolveDegree(activeKey.tonic, activeKey.mode, currentDegree).symbol}, lo
            habitual
          </h3>
          <ul className="mt-3 space-y-2">
            {moves.map((move) => {
              const chord = resolveDegree(activeKey.tonic, activeKey.mode, move.to);
              return (
                <li key={move.to} className="flex flex-wrap items-baseline gap-3">
                  <button
                    type="button"
                    onClick={() => actions.setCurrentDegree(move.to)}
                    className="text-brass-bright font-mono text-base underline-offset-4 hover:underline"
                  >
                    {chord.symbol}
                  </button>
                  <span className="text-text-muted font-mono text-xs">{move.to}</span>
                  <span className="text-text-muted text-sm">{move.why}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-text-muted text-xs tracking-widest uppercase">Progresiones que van</h3>
        <ul className="mt-3 space-y-2">
          {progressionsFor(activeKey.mode).map((progression) => (
            <li key={progression.id}>
              <p className="text-text font-mono text-sm">
                {resolveProgression(activeKey.tonic, activeKey.mode, progression.degrees)
                  .map((chord) => chord.symbol)
                  .join(' · ')}
              </p>
              <p className="text-text-muted text-sm">
                {progression.name}. {progression.note}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-text-muted text-xs tracking-widest uppercase">
            Lo último que has tocado
          </h3>
          {history.length > 0 && (
            <Button variant="quiet" onClick={() => actions.clearHistory()}>
              Empezar de cero
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-text-muted mt-3 text-sm">Todavía no ha sonado nada.</p>
        ) : (
          <p className="text-text mt-3 font-mono text-sm break-words">
            {history.map((note) => spanishNoteName(note.pitchClass)).join(' · ')}
          </p>
        )}
      </div>
    </section>
  );
}
