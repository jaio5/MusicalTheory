'use client';

import { useState } from 'react';

import { ComposePanel } from '@features/compose';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { LearnPanel } from '@features/learn';
import { SessionsPanel } from '@features/sessions';
import { SuggestPanel } from '@features/suggest';
import { Tuner } from '@features/tuner';

type ExtraId = 'tuner' | 'fretboard' | 'suggest' | 'compose' | 'learn' | 'ideas' | 'sessions';

const EXTRAS: ReadonlyArray<{ id: ExtraId; name: string; render: () => React.ReactElement }> = [
  { id: 'fretboard', name: 'Mástil', render: FretboardPanel },
  { id: 'tuner', name: 'Afinador', render: Tuner },
  { id: 'suggest', name: 'Sugerencias', render: SuggestPanel },
  { id: 'compose', name: 'Componer', render: ComposePanel },
  { id: 'learn', name: 'Aprender', render: LearnPanel },
  { id: 'ideas', name: 'Ideas', render: IdeasPanel },
  { id: 'sessions', name: 'Sesiones', render: SessionsPanel },
];

/**
 * Lo que no cabe en la pantalla principal, en un cajón que se abre encima.
 *
 * Es la forma de tener todo disponible sin que la pantalla crezca: se abre uno
 * cada vez, se usa y se cierra. Nada de esto empuja a las tres columnas.
 */
export function ExtrasDrawer() {
  const [open, setOpen] = useState<ExtraId | null>(null);
  const current = EXTRAS.find((extra) => extra.id === open) ?? null;

  return (
    <div className="ml-auto flex items-center gap-1">
      {EXTRAS.map((extra) => (
        <button
          key={extra.id}
          type="button"
          onClick={() => setOpen(open === extra.id ? null : extra.id)}
          aria-pressed={open === extra.id}
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            open === extra.id
              ? 'border-brass-bright text-brass-bright'
              : 'border-border text-text-muted hover:text-text'
          }`}
        >
          {extra.name}
        </button>
      ))}

      {current !== null && (
        <div
          role="dialog"
          aria-label={current.name}
          className="border-border bg-background fixed inset-x-2 top-16 bottom-2 z-30 overflow-y-auto rounded-lg border p-3 shadow-2xl sm:inset-x-auto sm:right-2 sm:w-[min(46rem,calc(100vw-1rem))]"
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="border-border text-text-muted hover:text-text rounded-md border px-2 py-1 text-xs"
            >
              Cerrar
            </button>
          </div>
          <current.render />
        </div>
      )}
    </div>
  );
}
