'use client';

import type { ReactNode } from 'react';

import { keyName } from '@core/music';
import { ComposePanel } from '@features/compose';
import type { DockPanel } from '@features/dock';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { LearnPanel } from '@features/learn';
import { ChordFocus, NextChords } from '@features/path';
import { RecorderPanel } from '@features/recorder';
import { SessionsPanel } from '@features/sessions';
import { SuggestPanel } from '@features/suggest';
import { Tuner } from '@features/tuner';
import { KeyPanel } from '@features/wheel';
import { Settings } from '@features/workspace';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { PANELS, type PanelId } from '@state/workspace';

/**
 * La rueda con lo que la acompaña: el nombre de la tonalidad y los dos ajustes
 * que deciden qué se propone. Van juntos porque se eligen juntos.
 */
function KeyDock() {
  const activeKey = useSessionStore(selectActiveKey);

  return (
    <div className="flex h-full flex-col items-center gap-2 overflow-y-auto p-3">
      <KeyPanel compact />
      <p className="text-text-muted text-center font-mono text-[11px]">
        {activeKey === null
          ? 'Pulsa una tonalidad para empezar'
          : keyName(activeKey.tonic, activeKey.mode)}
      </p>
      <Settings />
    </div>
  );
}

/**
 * Qué dibuja cada panel del catálogo.
 *
 * Este es el único sitio del proyecto donde se juntan features distintos, y por
 * eso vive en `app/`: la regla es que un feature nunca importe de otro, así que
 * quien los compone es la aplicación.
 */
const RENDER: Readonly<Record<PanelId, () => ReactNode>> = {
  chord: () => <ChordFocus />,
  next: () => <NextChords />,
  key: () => <KeyDock />,
  fretboard: () => <FretboardPanel />,
  tuner: () => <Tuner />,
  suggest: () => <SuggestPanel />,
  compose: () => <ComposePanel />,
  learn: () => <LearnPanel />,
  ideas: () => <IdeasPanel />,
  recorder: () => <RecorderPanel />,
  sessions: () => <SessionsPanel />,
};

export const DOCK_PANELS: readonly DockPanel[] = PANELS.map((panel) => ({
  id: panel.id,
  name: panel.name,
  render: RENDER[panel.id],
}));
