'use client';

import { useState } from 'react';

import {
  keyName,
  noteName,
  STYLES,
  suggestChords,
  type ChordFamily,
  type ChordSuggestion,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Panel } from '@ui/Panel';

/** Cómo de lejos queda cada familia de lo evidente. */
const RAREZA: Readonly<Record<ChordFamily, { label: string; rank: 0 | 1 | 2 }>> = {
  diatonic: { label: 'de la tonalidad', rank: 0 },
  power: { label: 'quinta', rank: 0 },
  seventh: { label: 'cuatríada', rank: 1 },
  suspended: { label: 'suspendido', rank: 1 },
  added: { label: 'con color', rank: 1 },
  borrowed: { label: 'prestado', rank: 1 },
  secondaryDominant: { label: 'dominante secundaria', rank: 2 },
  tritoneSub: { label: 'sustituto tritonal', rank: 2 },
  diminished: { label: 'disminuido de paso', rank: 2 },
  neapolitan: { label: 'napolitano', rank: 2 },
  altered: { label: 'alterado', rank: 2 },
};

const RANK_STYLE = ['text-text-muted', 'text-brass', 'text-oxblood-bright'] as const;

export function SuggestPanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);
  const [onlyStrange, setOnlyStrange] = useState(false);

  const style = STYLES[styleId];

  if (activeKey === null) {
    return (
      <Panel id="sugerencias" title="Sugerencias">
        <p className="text-text-muted text-sm">
          Elige una tonalidad arriba o toca unos compases, y te digo qué acordes caben.
        </p>
      </Panel>
    );
  }

  const playedNotes = history.map((note) => note.pitchClass);
  const all = suggestChords({
    tonic: activeKey.tonic,
    mode: activeKey.mode,
    styleId,
    playedNotes,
    limit: 24,
  });

  const suggestions = (
    onlyStrange ? all.filter((item) => RAREZA[item.family].rank > 0) : all
  ).slice(0, 10);

  return (
    <Panel
      id="sugerencias"
      title="Sugerencias"
      actions={
        <label className="text-text-muted flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            className="accent-brass"
            checked={onlyStrange}
            onChange={(event) => setOnlyStrange(event.target.checked)}
          />
          Solo los raros
        </label>
      }
    >
      <p className="text-text-muted text-xs">
        {keyName(activeKey.tonic, activeKey.mode)} · {style.name}. {style.summary}
      </p>

      <ul className="mt-3 space-y-1.5">
        {suggestions.map((suggestion) => (
          <Suggestion
            key={suggestion.symbol}
            suggestion={suggestion}
            listening={playedNotes.length > 0}
          />
        ))}
      </ul>

      <details className="mt-4">
        <summary className="text-text-muted cursor-pointer text-xs">
          Qué se puede hacer en {style.name.toLowerCase()}
        </summary>
        <ul className="text-text-muted mt-2 space-y-1 text-xs">
          {style.tips.map((tip) => (
            <li key={tip} className="border-brass-dim border-l pl-3">
              {tip}
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

function Suggestion({
  suggestion,
  listening,
}: {
  readonly suggestion: ChordSuggestion;
  readonly listening: boolean;
}) {
  const rareza = RAREZA[suggestion.family];

  return (
    <li className="flex items-baseline gap-2">
      <span className="text-text w-20 shrink-0 font-mono text-sm">{suggestion.symbol}</span>
      <span className="text-text-muted w-16 shrink-0 font-mono text-xs">{suggestion.label}</span>
      <span className={`shrink-0 text-xs ${RANK_STYLE[rareza.rank]}`}>{rareza.label}</span>
      {listening && suggestion.fit > 0.6 && (
        <span className="text-tube-bright shrink-0 text-xs" title="Encaja con lo que estás tocando">
          · encaja
        </span>
      )}
      <span className="text-text-muted truncate text-xs" title={suggestion.why}>
        {suggestion.why}
      </span>
      <span className="sr-only">
        Notas: {suggestion.notes.map((note) => noteName(note)).join(', ')}.
      </span>
    </li>
  );
}
