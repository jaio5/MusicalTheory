'use client';

import { useState } from 'react';

import { keyName } from '@core/music';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { Metronome } from '@features/metronome';
import { CurrentChord, HeardChord, NextChords, Voicings } from '@features/path';
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
   * Si lo de dentro se dibuja entero o hay que desplazarlo. El mástil se dibuja
   * entero y no hace scroll nunca; lo demás es texto, y el texto se lee
   * desplazándolo.
   *
   * En los dos casos la altura la pone el contenido y el tope solo recorta.
   * Con un alto fijo, el mástil —que es casi cuatro veces más ancho que alto—
   * dejaba cien píxeles muertos arriba y abajo, y sin tonalidad elegida dejaba
   * la franja entera vacía.
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
        {/* El metrónomo, arriba y siempre a la vista: es un control de los de
            poner en marcha y olvidarse, como el de grabar, no un ajuste que se
            busca en una columna. */}
        <div className="border-border shrink-0 border-b px-3 py-1.5">
          <Metronome />
        </div>

        <div className="grid min-h-0 grow grid-cols-1 gap-px overflow-y-auto lg:grid-cols-[16rem_minmax(0,1fr)_19rem] lg:overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_23rem]">
          {/* Cada cosa con su tamaño y la columna con scroll: si se dejan
              encoger, con el mástil abierto la rueda se queda en un botón. */}
          <section
            aria-label="Tonalidad"
            className="border-border flex min-h-0 flex-col items-center gap-2 overflow-y-auto border-r p-3 [&>*]:shrink-0"
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
            {/* Arriba lo que has elegido tú, abajo lo que estás tocando. Cada
                cosa tiene su sitio fijo, así que al soltar las cuerdas nada se
                mueve: solo cambia el rótulo de «Suena» a «Último». */}
            <CurrentChord />
            <Voicings />
            <HeardChord />
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
                  ? 'max-h-[min(72vh,46rem)] overflow-hidden'
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
