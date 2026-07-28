'use client';

import { useMemo, useState } from 'react';

import { chordVoicings } from '@core/instrument';
import {
  accidentalForKey,
  keyName,
  noteName,
  suggestChords,
  suggestTransitions,
  type ChordSuggestion,
  type ParsedChord,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { ChordDiagram } from '@ui/ChordDiagram';

import { ChordSearch } from './ChordSearch';

/** Lo que hace falta para pintar un acorde, venga de donde venga. */
interface Chord {
  readonly symbol: string;
  readonly label: string;
  readonly root: ChordSuggestion['root'];
  readonly notes: readonly ChordSuggestion['root'][];
  readonly why: string;
}

function fromSearch(chord: ParsedChord): Chord {
  return {
    symbol: chord.symbol,
    label: chord.shape.name,
    root: chord.root,
    notes: chord.notes,
    why: 'Lo has buscado tú.',
  };
}

/** Los intervalos del acorde respecto a su fundamental, para buscar formas. */
function relativeIntervals(chord: Chord): number[] {
  return chord.notes.map((note) => (note - chord.root + 12) % 12).sort((a, b) => a - b);
}

/**
 * El camino: en qué acorde estás, cómo se hace y a dónde puedes ir.
 *
 * Va partido en dos columnas de la pantalla: a la izquierda el acorde con sus
 * diagramas, y en el centro la lista de siguientes con su buscador. Las dos
 * llevan su propio scroll para que la pantalla no crezca.
 */
export function usePath() {
  const [path, setPath] = useState<readonly Chord[]>([]);
  return { path, setPath, current: path.at(-1) ?? null } as const;
}

export interface ChordFocusProps {
  readonly path: readonly Chord[];
  readonly onTrim: (index: number) => void;
  readonly onClear: () => void;
}

export function ChordFocus({ path, onTrim, onClear }: ChordFocusProps) {
  const activeKey = useSessionStore(selectActiveKey);
  const current = path.at(-1) ?? null;

  const voicings = useMemo(
    () =>
      current === null ? [] : chordVoicings(current.root, relativeIntervals(current), { limit: 4 }),
    [current],
  );

  if (activeKey === null) {
    return (
      <p className="text-text-muted p-4 text-sm">Elige una tonalidad en la rueda y empezamos.</p>
    );
  }

  const accidental = accidentalForKey(activeKey.tonic, activeKey.mode);

  if (current === null) {
    return (
      <p className="text-text-muted p-4 text-sm">
        Estás en {keyName(activeKey.tonic, activeKey.mode)}. Elige un acorde de la lista y te enseño
        cómo se hace.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-baseline justify-between gap-2 border-b p-3">
        <span className="font-display text-brass-bright text-3xl leading-none">
          {current.symbol}
        </span>
        <span className="text-text-muted font-mono text-xs">{current.label}</span>
      </div>

      <div className="min-h-0 grow overflow-y-auto p-3">
        <p className="text-text-muted font-mono text-xs">
          {current.notes.map((note) => noteName(note, accidental)).join(' · ')}
        </p>
        <p className="text-text-muted mt-1 text-xs">{current.why}</p>

        {voicings.length === 0 ? (
          <p className="text-text-muted mt-3 text-xs">
            No cabe en cuatro trastes con la fundamental al bajo.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {voicings.map((voicing) => (
              <figure key={voicing.frets.join('-')}>
                <ChordDiagram
                  frets={voicing.frets}
                  position={voicing.position}
                  label={`${current.symbol}, ${voicing.name.toLowerCase()}`}
                />
                <figcaption className="text-text-muted mt-0.5 text-center text-[9px]">
                  {voicing.name}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {path.length > 0 && (
        <div className="border-border border-t p-2">
          <div className="flex items-center justify-between gap-2">
            <ol aria-label="Progresión" className="flex flex-wrap items-center gap-1">
              {path.map((chord, index) => (
                <li key={`${chord.symbol}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <span className="text-text-muted text-xs">→</span>}
                  <button
                    type="button"
                    onClick={() => onTrim(index)}
                    className={`rounded px-1.5 py-0.5 font-mono text-xs ${
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
            <Button variant="quiet" className="px-2 py-1 text-xs" onClick={onClear}>
              Limpiar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface NextChordsProps {
  readonly path: readonly Chord[];
  readonly onPick: (chord: Chord) => void;
}

export function NextChords({ path, onPick }: NextChordsProps) {
  const activeKey = useSessionStore(selectActiveKey);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);

  const current = path.at(-1) ?? null;
  const playedNotes = useMemo(() => history.map((note) => note.pitchClass), [history]);

  const options = useMemo(() => {
    if (activeKey === null) {
      return [];
    }
    const base = { tonic: activeKey.tonic, mode: activeKey.mode, styleId, playedNotes };
    return current === null
      ? suggestChords({ ...base, limit: 14 })
      : suggestTransitions({ ...base, from: current, limit: 14 });
  }, [activeKey, styleId, playedNotes, current]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b p-2">
        <ChordSearch onPick={(chord) => onPick(fromSearch(chord))} />
      </div>

      <p className="text-text-muted px-3 pt-2 text-[10px] tracking-widest uppercase">
        {current === null ? 'Por dónde empezar' : `Desde ${current.symbol}`}
      </p>

      <ul className="min-h-0 grow overflow-y-auto p-2">
        {options.map((option) => (
          <li key={option.symbol}>
            <button
              type="button"
              onClick={() => onPick(option)}
              aria-label={`${option.symbol}, ${option.label}`}
              className="hover:bg-surface-raised flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left"
            >
              <span className="text-text w-16 shrink-0 font-mono text-sm">{option.symbol}</span>
              <span className="text-text-muted w-14 shrink-0 font-mono text-[10px]">
                {option.label}
              </span>
              <span className="text-text-muted truncate text-xs">
                {'motionWhy' in option &&
                typeof option.motionWhy === 'string' &&
                option.motionWhy !== ''
                  ? option.motionWhy
                  : option.why}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { Chord };
