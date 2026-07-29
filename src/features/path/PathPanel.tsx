'use client';

import { useMemo } from 'react';

import { chordVoicings } from '@core/instrument';
import {
  accidentalForKey,
  HARMONIC_ROLES,
  noteName,
  scaleNotes,
  suggestChords,
  suggestTransitions,
  type HarmonicRole,
  type ParsedChord,
  type PitchClass,
} from '@core/music';
import { selectActiveKey, useSessionStore, type PathChord } from '@state/session-store';
import { ChordDiagram } from '@ui/ChordDiagram';

import { ChordSearch } from './ChordSearch';

/**
 * La letra del papel que hace el acorde: T, S o D.
 *
 * En gris y sin color a propósito. El punto de al lado ya está usando el verde,
 * el ámbar y el rojo para otra cosa —si el acorde entra en la tonalidad o se
 * sale— y dos códigos de color en la misma fila no se leen, se adivinan.
 *
 * La letra sola no enseña nada a quien empieza, así que el nombre entero y lo
 * que significa van en el título, y el lector de pantalla lee el nombre, no la
 * inicial.
 */
function RoleBadge({ role }: { role: HarmonicRole }) {
  const info = HARMONIC_ROLES[role];
  return (
    <span
      title={`${info.name}. ${info.what} ${info.goes}`}
      className="border-border text-text-muted mt-0.5 shrink-0 rounded border px-1 font-mono text-xs"
    >
      <span aria-hidden="true">{info.short}</span>
      <span className="sr-only">{info.name}</span>
    </span>
  );
}

function fromSearch(chord: ParsedChord): PathChord {
  return {
    symbol: chord.symbol,
    label: chord.shape.name,
    root: chord.root,
    notes: chord.notes,
    why: 'Lo has buscado tú.',
  };
}

/**
 * Verde si es seguro, ámbar si trae una nota de fuera y rojo si trae más.
 *
 * Es la lectura rápida que hace falta mientras tocas: no da tiempo a leer el
 * porqué de cada acorde, pero sí a ver de qué color es el que vas a pisar.
 */
function safetyColour(notes: readonly PitchClass[], inKey: ReadonlySet<PitchClass>): string {
  const outside = notes.filter((note) => !inKey.has(note)).length;
  if (outside === 0) {
    return 'bg-tube-bright';
  }
  return outside === 1 ? 'bg-brass-bright' : 'bg-oxblood-bright';
}

/** Los intervalos del acorde respecto a su fundamental, para buscar formas. */
function relativeIntervals(chord: PathChord): number[] {
  return chord.notes.map((note) => (note - chord.root + 12) % 12).sort((a, b) => a - b);
}

/**
 * El camino: en qué acorde estás, de cuántas maneras se hace y a dónde puedes
 * ir. Son tres piezas sueltas porque la pantalla de componer las coloca en
 * sitios distintos.
 */

/** En qué acorde estás y cómo has llegado. */
export function CurrentChord() {
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const actions = useSessionStore((state) => state.actions);
  const current = path.at(-1) ?? null;
  const accidental =
    activeKey === null ? 'sharp' : accidentalForKey(activeKey.tonic, activeKey.mode);

  if (activeKey === null) {
    return (
      <p className="text-text-muted flex h-full items-center justify-center p-6 text-center text-sm">
        Elige una tonalidad en la rueda y empezamos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {current === null ? (
        <p className="text-text-muted py-10 text-center text-sm">
          Elige un acorde de la lista y te enseño cómo se hace, traste a traste.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-brass-bright text-4xl leading-none">
              {current.symbol}
            </span>
            <span className="text-text-muted font-mono text-xs">{current.label}</span>
            <span className="text-text-muted ml-auto font-mono text-xs">
              {current.notes.map((note) => noteName(note, accidental)).join(' · ')}
            </span>
          </div>
          <p className="text-text-muted text-sm">{current.why}</p>
        </>
      )}

      {path.length > 0 && (
        <div className="border-border flex items-center gap-1 border-t pt-2">
          <ol
            aria-label="Progresión"
            className="flex min-w-0 grow items-center gap-1 overflow-x-auto"
          >
            {path.map((chord, index) => (
              <li key={`${chord.symbol}-${index}`} className="flex shrink-0 items-center gap-1">
                {index > 0 && <span className="text-text-muted text-xs">→</span>}
                <button
                  type="button"
                  onClick={() => actions.trimPath(index)}
                  className={`px-1 py-0.5 font-mono text-sm ${
                    index === path.length - 1
                      ? 'text-brass-bright'
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
            className="text-text-muted hover:text-oxblood-bright shrink-0 px-1 text-sm"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Todas las maneras de hacer el acorde a lo largo del mástil.
 *
 * Se enseñan a la vez y no de una en una: la gracia es ver que el mismo acorde
 * vive en cinco sitios distintos, y eso no se ve pasando páginas.
 */
export function Voicings() {
  const path = useSessionStore((state) => state.path);
  const current = path.at(-1) ?? null;

  const voicings = useMemo(
    () =>
      current === null ? [] : chordVoicings(current.root, relativeIntervals(current), { limit: 6 }),
    [current],
  );

  if (current === null) {
    return null;
  }

  if (voicings.length === 0) {
    return (
      <p className="text-text-muted p-3 text-sm">
        No cabe en cuatro trastes con la fundamental al bajo. Prueba otra forma del acorde.
      </p>
    );
  }

  return (
    <ul aria-label={`Formas de hacer ${current.symbol}`} className="flex flex-wrap gap-3 p-3">
      {voicings.map((voicing) => (
        <li key={voicing.frets.join('-')} className="flex flex-col items-center">
          <ChordDiagram
            frets={voicing.frets}
            position={voicing.position}
            label={`${current.symbol}, ${voicing.name.toLowerCase()}`}
          />
          <span className="text-text-muted mt-1 text-center text-xs">{voicing.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function NextChords() {
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const actions = useSessionStore((state) => state.actions);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);

  const current = path.at(-1) ?? null;
  const playedNotes = useMemo(() => history.map((note) => note.pitchClass), [history]);

  const inKey = useMemo(
    () =>
      new Set<PitchClass>(
        activeKey === null
          ? []
          : scaleNotes(activeKey.tonic, activeKey.mode === 'major' ? 'major' : 'naturalMinor'),
      ),
    [activeKey],
  );

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

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 pt-2">
        <p className="text-text-muted text-xs tracking-widest uppercase">
          {current === null ? 'Por dónde empezar' : `Desde ${current.symbol}`}
        </p>
        {/* Lo que significan los puntos, al lado de los puntos: preguntarse qué
            era el ámbar y no tenerlo delante es perder el hilo de lo que tocas. */}
        <p aria-hidden="true" className="text-text-muted flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="bg-tube-bright block h-2 w-2 rounded-full" />
            entra
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-brass-bright block h-2 w-2 rounded-full" />
            color
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-oxblood-bright block h-2 w-2 rounded-full" />
            fuera
          </span>
        </p>
        {/* Lo mismo con las letras: T, S y D no significan nada hasta que
            alguien te las traduce, y tenerlo delante evita ir a buscarlo. */}
        <p aria-hidden="true" className="text-text-muted flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="border-border rounded border px-1 font-mono">T</span>
            reposo
          </span>
          <span className="flex items-center gap-1">
            <span className="border-border rounded border px-1 font-mono">S</span>
            salida
          </span>
          <span className="flex items-center gap-1">
            <span className="border-border rounded border px-1 font-mono">D</span>
            tensión
          </span>
        </p>
      </div>

      <ul className="min-h-0 grow overflow-y-auto p-2">
        {options.map((option) => (
          <li key={option.symbol}>
            <button
              type="button"
              onClick={() => actions.pushChord(option)}
              aria-label={`${option.symbol}, ${option.label}`}
              className="hover:bg-surface-raised flex w-full items-baseline gap-3 px-3 py-2 text-left"
            >
              {/* Marcado como señal para que el verde y el rojo sigan ahí
                  mientras grabas: es lo único que da tiempo a mirar tocando. */}
              <span
                aria-hidden="true"
                data-senal
                className={`mt-1 block h-2 w-2 shrink-0 rounded-full ${safetyColour(option.notes, inKey)}`}
              />
              <span className="text-text w-16 shrink-0 font-mono text-base">{option.symbol}</span>
              <span className="text-text-muted w-14 shrink-0 font-mono text-xs">
                {option.label}
              </span>
              <RoleBadge role={option.role} />
              <span className="min-w-0 grow">
                <span className="text-text-muted line-clamp-2 block text-sm leading-snug">
                  {'motionWhy' in option &&
                  typeof option.motionWhy === 'string' &&
                  option.motionWhy !== ''
                    ? option.motionWhy
                    : option.why}
                </span>
                {/* Por qué se puede cambiar por otro. Va debajo y más pequeño
                    que el porqué del acorde: primero se entiende qué es, y
                    después por dónde se puede sustituir. */}
                {option.substitution !== null ? (
                  <span className="text-text-muted mt-0.5 block text-xs leading-snug opacity-80">
                    Vale por {option.substitution.of}. {option.substitution.why}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
