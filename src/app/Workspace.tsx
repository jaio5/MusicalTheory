'use client';

import { useEffect } from 'react';

import { MicButton } from '@features/workspace';
import { useSessionStore } from '@state/session-store';
import { SCREENS } from '@state/workspace';

import { ComposeScreen, LearnScreen, TuneScreen } from './screens';

/**
 * La aplicación: tres pantallas y el botón de escuchar.
 *
 * Cada pantalla está hecha para una cosa —aprender, componer, afinar— y trae
 * dentro lo que hace falta para esa cosa y nada más. Aquí es donde se componen
 * los features, que es lo único que puede hacerlo: un feature no importa de
 * otro.
 */
export function Workspace() {
  const screen = useSessionStore((state) => state.screen);
  const actions = useSessionStore((state) => state.actions);

  // La configuración guardada se recupera después de pintar: leerla durante el
  // render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    actions.loadWorkspace();
  }, [actions]);

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface flex shrink-0 items-center gap-4 border-b px-3 py-1.5">
        <MicButton />

        <nav aria-label="Pantallas" className="ml-auto flex gap-1">
          {SCREENS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => actions.setScreen(candidate.id)}
              aria-current={candidate.id === screen ? 'page' : undefined}
              title={candidate.summary}
              className={`border px-3 py-1 font-mono text-xs ${
                candidate.id === screen
                  ? 'border-brass-bright text-brass-bright'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              {candidate.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 grow overflow-hidden">
        {screen === 'learn' ? (
          <LearnScreen />
        ) : screen === 'tune' ? (
          <TuneScreen />
        ) : (
          <ComposeScreen />
        )}
      </main>
    </div>
  );
}
