'use client';

import { useMemo, useState } from 'react';

import { chordVoicings } from '@core/instrument';
import {
  accidentalForKey,
  keyName,
  noteName,
  spanishNoteName,
  suggestChords,
  suggestTransitions,
  type ChordSuggestion,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { ChordDiagram } from '@ui/ChordDiagram';
import { Panel } from '@ui/Panel';

/**
 * El camino: en qué acorde estás, cómo se hace y a dónde puedes ir.
 *
 * Es el panel que convierte la aplicación en algo que se juega: eliges un
 * acorde, te enseña las formas de hacerlo sobre el mástil y te propone el
 * siguiente. Encadenando se construye la progresión.
 */
export function PathPanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);

  const [path, setPath] = useState<readonly ChordSuggestion[]>([]);

  const current = path.at(-1) ?? null;
  const playedNotes = useMemo(() => history.map((note) => note.pitchClass), [history]);

  const options = useMemo(() => {
    if (activeKey === null) {
      return [];
    }
    const base = { tonic: activeKey.tonic, mode: activeKey.mode, styleId, playedNotes };
    return current === null
      ? suggestChords({ ...base, limit: 8 })
      : suggestTransitions({ ...base, from: current, limit: 8 });
  }, [activeKey, styleId, playedNotes, current]);

  const voicings = useMemo(
    () =>
      current === null ? [] : chordVoicings(current.root, relativeIntervals(current), { limit: 4 }),
    [current],
  );

  if (activeKey === null) {
    return (
      <Panel id="camino" title="El camino">
        <p className="text-text-muted text-sm">
          Elige una tonalidad arriba y empezamos: te propongo un acorde, te enseño cómo se hace y te
          digo a dónde puedes ir desde él.
        </p>
      </Panel>
    );
  }

  const accidental = accidentalForKey(activeKey.tonic, activeKey.mode);

  return (
    <Panel
      id="camino"
      title="El camino"
      wide
      actions={
        path.length > 0 && (
          <Button variant="quiet" onClick={() => setPath([])}>
            Empezar de nuevo
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted text-xs">{keyName(activeKey.tonic, activeKey.mode)}</span>
        {path.length > 0 && (
          <ol aria-label="Progresión" className="flex flex-wrap items-center gap-1">
            {path.map((chord, index) => (
              <li key={`${chord.symbol}-${index}`} className="flex items-center gap-1">
                {index > 0 && <span className="text-text-muted text-xs">→</span>}
                <button
                  type="button"
                  onClick={() => setPath(path.slice(0, index + 1))}
                  className={`rounded px-2 py-0.5 font-mono text-sm ${
                    index === path.length - 1
                      ? 'bg-surface-raised text-brass-bright'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {chord.symbol}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {current !== null && (
        <div className="border-border mt-4 border-t pt-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-brass-bright text-3xl">{current.symbol}</span>
            <span className="text-text-muted font-mono text-xs">{current.label}</span>
            <span className="text-text-muted font-mono text-xs">
              {current.notes.map((note) => noteName(note, accidental)).join(' · ')}
            </span>
          </div>
          <p className="text-text-muted mt-1 text-xs">{current.why}</p>

          {voicings.length === 0 ? (
            <p className="text-text-muted mt-3 text-xs">
              Este acorde no cabe en cuatro trastes con la fundamental al bajo. Se puede tocar, pero
              no como una posición cerrada.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-4">
              {voicings.map((voicing) => (
                <figure key={voicing.frets.join('-')}>
                  <ChordDiagram
                    frets={voicing.frets}
                    position={voicing.position}
                    label={`${current.symbol}, ${voicing.name.toLowerCase()}`}
                  />
                  <figcaption className="text-text-muted mt-1 text-center text-[10px]">
                    {voicing.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border-border mt-4 border-t pt-4">
        <h3 className="text-text-muted text-xs tracking-widest uppercase">
          {current === null ? 'Por dónde empezar' : 'Y desde aquí'}
        </h3>

        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {options.map((option) => (
            <li key={option.symbol}>
              <button
                type="button"
                onClick={() => setPath([...path, option])}
                // Sin esto el nombre accesible sale pegado —«CIEstá en la
                // tonalidad»— porque son tres tramos sin espacio entre ellos.
                aria-label={`${option.symbol}, ${option.label}`}
                className="hover:border-brass-dim border-border flex w-full items-baseline gap-2 rounded-md border px-2 py-1.5 text-left"
              >
                <span className="text-text w-16 shrink-0 font-mono text-sm">{option.symbol}</span>
                <span className="text-text-muted w-14 shrink-0 font-mono text-[10px]">
                  {option.label}
                </span>
                <span className="text-text-muted truncate text-xs">
                  {'motionWhy' in option && typeof option.motionWhy === 'string'
                    ? option.motionWhy
                    : option.why}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {playedNotes.length > 0 && (
          <p className="text-text-muted mt-3 text-xs">
            Contando lo que estás tocando:{' '}
            {[...new Set(playedNotes)].map((note) => spanishNoteName(note, accidental)).join(' · ')}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** Los intervalos del acorde respecto a su fundamental, para buscar formas. */
function relativeIntervals(chord: ChordSuggestion): number[] {
  return chord.notes.map((note) => (note - chord.root + 12) % 12).sort((a, b) => a - b);
}
