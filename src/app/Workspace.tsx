'use client';

import { ComposePanel } from '@features/compose';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { LearnPanel } from '@features/learn';
import { RecorderPanel } from '@features/recorder';
import { SessionsPanel } from '@features/sessions';
import { SuggestPanel } from '@features/suggest';
import { Tuner } from '@features/tuner';
import { KeyPanel } from '@features/wheel';
import { Toolbar } from '@features/workspace';
import { useSessionStore } from '@state/session-store';
import { PANELS, type PanelId } from '@state/workspace';

/**
 * El banco de trabajo.
 *
 * Aquí es donde se componen los features, que es lo único que puede hacerlo:
 * un feature no importa de otro. Cada panel sale solo si está encendido.
 */
const CONTENT: Readonly<Record<PanelId, () => React.ReactElement>> = {
  tuner: Tuner,
  key: KeyPanel,
  suggest: SuggestPanel,
  fretboard: FretboardPanel,
  compose: ComposePanel,
  learn: LearnPanel,
  ideas: IdeasPanel,
  recorder: RecorderPanel,
  sessions: SessionsPanel,
};

export function Workspace() {
  const visible = useSessionStore((state) => state.visiblePanels);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2">
          <span className="text-brass font-mono text-xs tracking-widest uppercase">
            Caos ordenado
          </span>
          <Toolbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl grow px-4 py-4">
        {visible.length === 0 ? (
          <p className="text-text-muted mt-16 text-center text-sm">
            No hay ningún panel encendido. Ábrelos desde «Paneles», arriba a la derecha.
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {PANELS.filter((panel) => visible.includes(panel.id)).map((panel) => {
              const Content = CONTENT[panel.id];
              return (
                <div key={panel.id} className={panel.wide === true ? 'lg:col-span-2' : ''}>
                  <Content />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
