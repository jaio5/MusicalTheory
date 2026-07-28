'use client';

import { useMemo, useState } from 'react';

import {
  judgeChords,
  suggestChordSymbols,
  type ChordJudgement,
  type ParsedChord,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

const VERDICT_STYLE: Readonly<Record<ChordJudgement['verdict'], string>> = {
  diatonic: 'text-tube-bright',
  colour: 'text-brass-bright',
  outside: 'text-oxblood-bright',
};

const VERDICT_LABEL: Readonly<Record<ChordJudgement['verdict'], string>> = {
  diatonic: 'Entra',
  colour: 'Color',
  outside: 'Fuera',
};

export interface ChordSearchProps {
  /** Se llama al aceptar un acorde, para meterlo en el camino. */
  readonly onPick: (chord: ParsedChord) => void;
}

/**
 * Buscar un acorde y ver, mientras escribes, cuáles pueden ser y si pegan.
 *
 * Con teclear la fundamental basta: escribes «A» y salen A, Am, A7 y las demás,
 * cada una con su veredicto. Así se puede probar un acorde raro sin saber cómo
 * se escribe ni si tiene sitio en la tonalidad.
 */
export function ChordSearch({ onPick }: ChordSearchProps) {
  const activeKey = useSessionStore(selectActiveKey);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);
  const [text, setText] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const matches = useMemo(() => suggestChordSymbols(text), [text]);

  const judgements = useMemo(() => {
    if (activeKey === null || matches.length === 0) {
      return [];
    }
    return judgeChords(matches, {
      tonic: activeKey.tonic,
      mode: activeKey.mode,
      styleId,
      playedNotes: history.map((note) => note.pitchClass),
    });
  }, [matches, activeKey, styleId, history]);

  // El resaltado se corrige durante el render y no en un efecto: si la lista se
  // acorta al escribir, pintarla una vez con el índice fuera de rango sería un
  // parpadeo con la fila equivocada marcada.
  const index = Math.min(highlighted, Math.max(matches.length - 1, 0));

  function choose(chord: ParsedChord | undefined): void {
    if (chord === undefined) {
      return;
    }
    onPick(chord);
    setText('');
    setHighlighted(0);
  }

  return (
    <div>
      <label className="block">
        <span className="sr-only">Buscar un acorde</span>
        <input
          type="text"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="acordes-encontrados"
          aria-autocomplete="list"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlighted(Math.min(index + 1, matches.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlighted(Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(matches[index]);
            } else if (event.key === 'Escape') {
              setText('');
            }
          }}
          placeholder="Buscar acorde: A, F#m7, Bb…"
          className="border-border bg-background text-text placeholder:text-text-muted w-full border px-2 py-1 font-mono text-sm"
        />
      </label>

      {text.trim() !== '' && matches.length === 0 && (
        <p className="text-text-muted mt-1 text-xs">
          No conozco ese acorde. Empieza por la fundamental: A, C#, Bb…
        </p>
      )}

      {matches.length > 0 && (
        <ul
          id="acordes-encontrados"
          role="listbox"
          aria-label="Acordes encontrados"
          className="mt-1"
        >
          {matches.map((chord, position) => {
            const judgement = judgements[position];
            return (
              <li key={chord.symbol} role="option" aria-selected={position === index}>
                <button
                  type="button"
                  onClick={() => choose(chord)}
                  onMouseEnter={() => setHighlighted(position)}
                  className={`flex w-full items-baseline gap-2 px-2 py-1 text-left ${
                    position === index ? 'bg-surface-raised' : ''
                  }`}
                >
                  <span className="text-text w-16 shrink-0 font-mono text-sm">{chord.symbol}</span>
                  {judgement === undefined ? (
                    <span className="text-text-muted truncate text-xs">{chord.shape.name}</span>
                  ) : (
                    <>
                      <span
                        className={`w-12 shrink-0 font-mono text-xs ${VERDICT_STYLE[judgement.verdict]}`}
                      >
                        {VERDICT_LABEL[judgement.verdict]}
                      </span>
                      <span className="text-text-muted truncate text-xs">
                        {judgement.label ?? chord.shape.name}
                      </span>
                      {judgement.fit > 0.5 && (
                        <span className="text-tube-bright ml-auto shrink-0 text-xs">
                          suena ahora
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {matches.length > 0 && activeKey === null && (
        <p className="text-text-muted mt-1 text-xs">Elige una tonalidad y te digo si pegan.</p>
      )}
    </div>
  );
}
