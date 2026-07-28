'use client';

import { useMemo, useRef, useState } from 'react';

import { chordVoicings } from '@core/instrument';
import {
  accidentalForKey,
  noteName,
  suggestChords,
  suggestTransitions,
  type ParsedChord,
} from '@core/music';
import { selectActiveKey, useSessionStore, type PathChord } from '@state/session-store';
import { ChordDiagram } from '@ui/ChordDiagram';
import { prefersReducedMotion } from '@ui/motion';

import { ChordSearch } from './ChordSearch';

function fromSearch(chord: ParsedChord): PathChord {
  return {
    symbol: chord.symbol,
    label: chord.shape.name,
    root: chord.root,
    notes: chord.notes,
    why: 'Lo has buscado tú.',
  };
}

/** Los intervalos del acorde respecto a su fundamental, para buscar formas. */
function relativeIntervals(chord: PathChord): number[] {
  return chord.notes.map((note) => (note - chord.root + 12) % 12).sort((a, b) => a - b);
}

/**
 * El camino: en qué acorde estás, cómo se hace y a dónde puedes ir.
 *
 * Va partido en dos columnas de la pantalla: a la izquierda, en una barra
 * estrecha, el acorde con sus diagramas; en el centro, la lista de siguientes
 * con su buscador. Las dos llevan su propio scroll para que la pantalla no
 * crezca.
 */

export function ChordFocus() {
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const actions = useSessionStore((state) => state.actions);
  const current = path.at(-1) ?? null;

  const voicings = useMemo(
    () =>
      current === null ? [] : chordVoicings(current.root, relativeIntervals(current), { limit: 4 }),
    [current],
  );

  const { sliderRef, shape, goToShape, onSliderScroll } = useSlider(
    voicings.length,
    current?.symbol ?? '',
  );
  const accidental =
    activeKey === null ? 'sharp' : accidentalForKey(activeKey.tonic, activeKey.mode);

  return (
    <div className="flex h-full flex-col">
      {current !== null && (
        <div className="border-border flex shrink-0 items-baseline gap-2 border-b px-3 py-1.5">
          <span className="font-display text-brass-bright truncate text-2xl leading-none">
            {current.symbol}
          </span>
          <span className="text-text-muted font-mono text-[10px]">{current.label}</span>
        </div>
      )}

      {activeKey === null ? (
        <p className="text-text-muted p-2 text-xs">Elige una tonalidad en la rueda.</p>
      ) : current === null ? (
        <p className="text-text-muted p-2 text-xs">
          Elige un acorde de la lista y te enseño cómo se hace.
        </p>
      ) : (
        <div className="min-h-0 grow overflow-y-auto">
          <p className="text-text-muted px-2 pt-1.5 font-mono text-[10px]">
            {current.notes.map((note) => noteName(note, accidental)).join(' · ')}
          </p>

          {voicings.length === 0 ? (
            <p className="text-text-muted p-2 text-xs">
              No cabe en cuatro trastes con la fundamental al bajo.
            </p>
          ) : (
            <>
              {/* Las formas se pasan deslizando, no apiladas: en una barra
                  estrecha, cuatro diagramas en columna no caben. */}
              <ul
                ref={sliderRef}
                aria-label="Formas de hacer el acorde"
                onScroll={onSliderScroll}
                className="flex snap-x snap-mandatory overflow-x-auto"
              >
                {voicings.map((voicing) => (
                  <li
                    key={voicing.frets.join('-')}
                    className="flex w-full shrink-0 snap-center flex-col items-center px-2 py-1"
                  >
                    <ChordDiagram
                      frets={voicing.frets}
                      position={voicing.position}
                      label={`${current.symbol}, ${voicing.name.toLowerCase()}`}
                    />
                    <span className="text-text-muted mt-0.5 text-center text-[9px]">
                      {voicing.name}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-center gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => goToShape(shape - 1)}
                  disabled={shape === 0}
                  aria-label="Forma anterior"
                  className="text-text-muted hover:text-text px-1 text-sm disabled:opacity-30"
                >
                  ‹
                </button>
                <span className="flex gap-1" aria-hidden="true">
                  {voicings.map((voicing, index) => (
                    <span
                      key={voicing.frets.join('-')}
                      className={`block h-1 w-1 rounded-full ${
                        index === shape ? 'bg-brass-bright' : 'bg-border'
                      }`}
                    />
                  ))}
                </span>
                <span className="sr-only">
                  Forma {shape + 1} de {voicings.length}
                </span>
                <button
                  type="button"
                  onClick={() => goToShape(shape + 1)}
                  disabled={shape >= voicings.length - 1}
                  aria-label="Forma siguiente"
                  className="text-text-muted hover:text-text px-1 text-sm disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </>
          )}

          <p className="text-text-muted border-border border-t px-2 py-1.5 text-[11px]">
            {current.why}
          </p>
        </div>
      )}

      {path.length > 0 && (
        <div className="border-border flex shrink-0 items-center gap-1 border-t p-1">
          <ol
            aria-label="Progresión"
            className="flex min-w-0 grow items-center gap-1 overflow-x-auto"
          >
            {path.map((chord, index) => (
              <li key={`${chord.symbol}-${index}`} className="flex shrink-0 items-center gap-1">
                {index > 0 && <span className="text-text-muted text-[10px]">→</span>}
                <button
                  type="button"
                  onClick={() => actions.trimPath(index)}
                  className={`rounded px-1 py-0.5 font-mono text-[11px] ${
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
          <button
            type="button"
            onClick={() => actions.clearPath()}
            aria-label="Limpiar la progresión"
            title="Limpiar"
            className="text-text-muted hover:text-oxblood-bright shrink-0 px-1 text-xs"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Un carrusel que se pasa deslizando.
 *
 * El scroll horizontal con puntos de anclaje lo hace el navegador solo; esto
 * únicamente sigue en cuál está para pintar los puntos y mover con las flechas.
 */
function useSlider(count: number, resetKey: string) {
  const ref = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [trackedKey, setTrackedKey] = useState(resetKey);

  // Al cambiar de acorde se vuelve a la primera forma. Se ajusta durante el
  // render, que es lo que React recomienda para esto.
  if (trackedKey !== resetKey) {
    setTrackedKey(resetKey);
    setIndex(0);
  }

  function go(next: number): void {
    const list = ref.current;
    if (list === null || next < 0 || next >= count) {
      return;
    }
    list.scrollTo({
      left: list.clientWidth * next,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    setIndex(next);
  }

  function onScroll(): void {
    const list = ref.current;
    if (list === null || list.clientWidth === 0) {
      return;
    }
    setIndex(Math.round(list.scrollLeft / list.clientWidth));
  }

  return { sliderRef: ref, shape: index, goToShape: go, onSliderScroll: onScroll } as const;
}

export function NextChords() {
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const actions = useSessionStore((state) => state.actions);
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
        <ChordSearch onPick={(chord) => actions.pushChord(fromSearch(chord))} />
      </div>

      <p className="text-text-muted px-3 pt-2 text-[10px] tracking-widest uppercase">
        {current === null ? 'Por dónde empezar' : `Desde ${current.symbol}`}
      </p>

      <ul className="min-h-0 grow overflow-y-auto p-2">
        {options.map((option) => (
          <li key={option.symbol}>
            <button
              type="button"
              onClick={() => actions.pushChord(option)}
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
