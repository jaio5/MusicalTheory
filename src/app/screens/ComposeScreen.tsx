'use client';

import { useState } from 'react';

import { keyName } from '@core/music';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { CurrentChord, NextChords, Voicings } from '@features/path';
import { RecordStage } from '@features/recorder';
import { SessionsPanel } from '@features/sessions';
import { KeyPanel } from '@features/wheel';
import { Settings } from '@features/workspace';
import { selectActiveKey, useSessionStore } from '@state/session-store';

type ExtraId = 'fretboard' | 'ideas' | 'sessions';

const EXTRAS: ReadonlyArray<{ id: ExtraId; name: string; render: () => React.ReactElement }> = [
  { id: 'fretboard', name: 'Mástil', render: FretboardPanel },
  { id: 'ideas', name: 'Ideas', render: IdeasPanel },
  { id: 'sessions', name: 'Sesiones', render: SessionsPanel },
];

/**
 * Componer: la rueda para elegir tonalidad, la progresión que llevas, a dónde
 * puedes ir y de cuántas maneras se hace cada acorde.
 *
 * Va envuelta en el grabador porque grabarte tocando es parte de componer: le
 * das al botón y te ves detrás de todo mientras sigues leyendo los acordes.
 */
export function ComposeScreen() {
  const activeKey = useSessionStore(selectActiveKey);
  const [extra, setExtra] = useState<ExtraId | null>(null);
  const current = EXTRAS.find((candidate) => candidate.id === extra) ?? null;

  return (
    <RecordStage>
      <div className="grid h-full min-h-0 grid-cols-1 gap-px overflow-y-auto lg:grid-cols-[16rem_minmax(0,1fr)_19rem] lg:overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_23rem]">
        <section
          aria-label="Tonalidad"
          className="border-border flex min-h-0 flex-col items-center gap-2 overflow-y-auto border-r p-3"
        >
          <KeyPanel compact />
          <p className="text-text-muted text-center font-mono text-xs">
            {activeKey === null
              ? 'Pulsa una tonalidad para empezar'
              : keyName(activeKey.tonic, activeKey.mode)}
          </p>
          <Settings />

          {/* Las herramientas van con los ajustes, no colgando del acorde: son
              de la misma familia —cosas que decides una vez— y así la columna
              del acorde se queda solo con el acorde. */}
          <div className="mt-auto w-full">
            <div className="flex flex-wrap gap-1">
              {EXTRAS.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setExtra(extra === candidate.id ? null : candidate.id)}
                  aria-pressed={extra === candidate.id}
                  className={`grow border px-2 py-1 font-mono text-xs ${
                    extra === candidate.id
                      ? 'border-brass-bright text-brass-bright'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {candidate.name}
                </button>
              ))}
            </div>

            {current !== null && (
              <div className="border-border mt-2 border-t pt-2">
                <current.render />
              </div>
            )}
          </div>
        </section>

        <section
          aria-label="El acorde y sus formas"
          className="flex min-h-0 flex-col overflow-y-auto"
        >
          <CurrentChord />
          <Voicings />
        </section>

        <section
          aria-label="A dónde puedes ir"
          className="border-border flex min-h-0 flex-col overflow-hidden border-l"
        >
          <NextChords />
        </section>
      </div>
    </RecordStage>
  );
}
