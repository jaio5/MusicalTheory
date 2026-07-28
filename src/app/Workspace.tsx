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
 * Tres columnas que caben enteras: el acorde en una barra lateral estrecha que
 * se pliega, la lista de siguientes en el centro y la rueda a la derecha. La
 * página no hace scroll; lo hacen las columnas por dentro, que es lo que
 * permite que quepa todo.
 *
 * Aquí es donde se componen los features, que es lo único que puede hacerlo:
 * un feature no importa de otro.
 */
export function Workspace() {
  const activeKey = useSessionStore(selectActiveKey);
  const [path, setPath] = useState<readonly Chord[]>([]);
  const [asideOpen, setAsideOpen] = useState(true);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface flex shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2">
        <MicButton />
        <span aria-hidden="true" className="bg-border h-8 w-px" />
        <Toolbar />
        <ExtrasDrawer />
      </header>

      <main className="flex min-h-0 grow flex-col lg:flex-row">
        <section
          aria-label="Acorde actual"
          className={`border-border bg-surface min-h-0 shrink-0 overflow-hidden border-b transition-[width] duration-200 lg:border-r lg:border-b-0 ${
            asideOpen ? 'lg:w-56' : 'lg:w-9'
          }`}
        >
          {asideOpen ? (
            <ChordFocus
              path={path}
              onTrim={(index) => setPath(path.slice(0, index + 1))}
              onClear={() => setPath([])}
              onCollapse={() => setAsideOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAsideOpen(true)}
              aria-label="Desplegar el acorde"
              title="Desplegar el acorde"
              className="text-text-muted hover:text-brass-bright flex h-full w-full flex-col items-center gap-2 py-2"
            >
              <span aria-hidden="true" className="text-sm">
                ›
              </span>
              <span aria-hidden="true" className="font-mono text-[11px] [writing-mode:vertical-rl]">
                {path.at(-1)?.symbol ?? 'Acorde'}
              </span>
            </button>
          )}
        </section>

        <section
          aria-label="Acordes que puedes tocar ahora"
          className="border-border bg-surface min-h-0 grow overflow-hidden lg:border-r"
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
