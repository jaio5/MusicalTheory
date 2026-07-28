'use client';

import { useState } from 'react';

import { keyName } from '@core/music';
import { ChordFocus, NextChords, type Chord } from '@features/path';
import { KeyPanel } from '@features/wheel';
import { MicButton, Toolbar } from '@features/workspace';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { ExtrasDrawer } from './ExtrasDrawer';

/**
 * La pantalla.
 *
 * Tres columnas fijas que caben enteras: el acorde a la izquierda, la lista de
 * siguientes en el centro y la rueda a la derecha. La página no hace scroll;
 * lo hacen las columnas por dentro, que es lo que permite que quepa todo.
 *
 * Aquí es donde se componen los features, que es lo único que puede hacerlo:
 * un feature no importa de otro.
 */
export function Workspace() {
  const activeKey = useSessionStore(selectActiveKey);
  const [path, setPath] = useState<readonly Chord[]>([]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface flex shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2">
        <MicButton />
        <span aria-hidden="true" className="bg-border h-8 w-px" />
        <Toolbar />
        <ExtrasDrawer />
      </header>

      <main className="grid min-h-0 grow grid-cols-1 gap-px lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto]">
        <section
          aria-label="Acorde actual"
          className="border-border bg-surface min-h-0 overflow-hidden border-r"
        >
          <ChordFocus
            path={path}
            onTrim={(index) => setPath(path.slice(0, index + 1))}
            onClear={() => setPath([])}
          />
        </section>

        <section
          aria-label="Acordes que puedes tocar ahora"
          className="border-border bg-surface min-h-0 overflow-hidden border-r"
        >
          <NextChords path={path} onPick={(chord) => setPath([...path, chord])} />
        </section>

        <section
          aria-label="Rueda de quintas"
          className="bg-surface flex min-h-0 shrink-0 flex-col items-center gap-2 overflow-y-auto p-3"
        >
          <KeyPanel compact />
          <p className="text-text-muted text-center text-xs">
            {activeKey === null
              ? 'Pulsa una tonalidad para empezar'
              : keyName(activeKey.tonic, activeKey.mode)}
          </p>
        </section>
      </main>
    </div>
  );
}
