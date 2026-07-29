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

interface Extra {
  readonly id: ExtraId;
  readonly name: string;
  readonly render: () => React.ReactElement;
  /**
   * Si lo de dentro se ajusta solo al hueco. El mástil sí —se encoge hasta
   * caber—, así que se lleva un alto fijo y no hace scroll nunca. Lo demás es
   * texto, y el texto se lee desplazándolo.
   */
  readonly fits?: boolean;
}

const EXTRAS: readonly Extra[] = [
  { id: 'fretboard', name: 'Mástil', render: FretboardPanel, fits: true },
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
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 grow grid-cols-1 gap-px overflow-y-auto lg:grid-cols-[16rem_minmax(0,1fr)_19rem] lg:overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_23rem]">
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

        {/* Abajo y a todo lo ancho: el mástil son seis cuerdas y quince trastes,
            y en una columna estrecha no se lee. La altura la pone el contenido
            hasta un tope, así que el mástil se estira y las sesiones no dejan
            medio hueco vacío debajo. */}
        <section
          aria-label="Herramientas"
          className="border-border flex shrink-0 flex-col border-t"
        >
          <div className="flex gap-1 px-3 py-1.5">
            {EXTRAS.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setExtra(extra === candidate.id ? null : candidate.id)}
                aria-expanded={extra === candidate.id}
                aria-controls="herramienta-abierta"
                className={`border px-3 py-1 font-mono text-xs ${
                  extra === candidate.id
                    ? 'border-brass-bright text-brass-bright'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                {candidate.name}
              </button>
            ))}

            {current !== null && (
              <button
                type="button"
                onClick={() => setExtra(null)}
                aria-label={`Cerrar ${current.name}`}
                title="Cerrar"
                className="text-text-muted hover:text-oxblood-bright ml-auto px-2 text-sm"
              >
                ×
              </button>
            )}
          </div>

          {current !== null && (
            <div
              id="herramienta-abierta"
              className={`border-border border-t p-3 ${
                current.fits === true
                  ? 'h-[min(50vh,30rem)] overflow-hidden'
                  : 'max-h-[min(52vh,26rem)] overflow-auto'
              }`}
            >
              <current.render />
            </div>
          )}
        </section>
      </div>
    </RecordStage>
  );
}
