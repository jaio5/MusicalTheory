'use client';

import { useState } from 'react';

import { judgeChord, parseChordSymbol, type ChordJudgement, type ParsedChord } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

const VERDICT_STYLE: Readonly<Record<ChordJudgement['verdict'], string>> = {
  diatonic: 'text-tube-bright',
  colour: 'text-brass-bright',
  outside: 'text-oxblood-bright',
};

const VERDICT_LABEL: Readonly<Record<ChordJudgement['verdict'], string>> = {
  diatonic: 'Entra',
  colour: 'Cabe como color',
  outside: 'Se va fuera',
};

export interface ChordSearchProps {
  /** Se llama al aceptar el acorde buscado, para meterlo en el camino. */
  readonly onPick: (chord: ParsedChord) => void;
}

/**
 * Buscar un acorde y preguntar si pega.
 *
 * Escribes el cifrado y te dice si entra en la tonalidad, si es un color con
 * uso conocido o si se va fuera, y cuánto encaja con lo que estás tocando.
 */
export function ChordSearch({ onPick }: ChordSearchProps) {
  const activeKey = useSessionStore(selectActiveKey);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);
  const [text, setText] = useState('');

  const parsed = text.trim() === '' ? null : parseChordSymbol(text);
  const judgement =
    parsed === null || activeKey === null
      ? null
      : judgeChord(parsed, {
          tonic: activeKey.tonic,
          mode: activeKey.mode,
          styleId,
          playedNotes: history.map((note) => note.pitchClass),
        });

  return (
    <div>
      <label className="block">
        <span className="sr-only">Buscar un acorde</span>
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Buscar acorde: F#m7, Bb, Csus4…"
          className="border-border bg-background text-text placeholder:text-text-muted w-full rounded-md border px-2 py-1.5 font-mono text-sm"
        />
      </label>

      {text.trim() !== '' && parsed === null && (
        <p className="text-text-muted mt-2 text-xs">
          No conozco ese acorde. Prueba con algo como <span className="font-mono">Am7</span>,{' '}
          <span className="font-mono">Bb</span> o <span className="font-mono">E7#9</span>.
        </p>
      )}

      {parsed !== null && judgement !== null && (
        <button
          type="button"
          onClick={() => onPick(parsed)}
          className="border-border hover:border-brass-dim mt-2 w-full rounded-md border p-2 text-left"
        >
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-text font-mono text-sm">{parsed.symbol}</span>
            <span className={`text-xs ${VERDICT_STYLE[judgement.verdict]}`}>
              {VERDICT_LABEL[judgement.verdict]}
            </span>
            {judgement.label !== null && (
              <span className="text-text-muted font-mono text-[10px]">{judgement.label}</span>
            )}
            {judgement.fit > 0.5 && (
              <span className="text-tube-bright text-[10px]">· encaja con lo que tocas</span>
            )}
          </span>
          <span className="text-text-muted mt-1 block text-xs">{judgement.why}</span>
        </button>
      )}

      {parsed !== null && activeKey === null && (
        <p className="text-text-muted mt-2 text-xs">
          Elige una tonalidad y te digo si {parsed.symbol} pega.
        </p>
      )}
    </div>
  );
}
