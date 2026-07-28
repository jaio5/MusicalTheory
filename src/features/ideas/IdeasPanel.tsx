'use client';

import { useState } from 'react';

import { noteName, SCALES, spanishNoteName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { Panel } from '@ui/Panel';

import {
  ERROR_MESSAGES,
  type Idea,
  type IdeaKind,
  type IdeasRequest,
  type IdeasErrorCode,
} from './contract';

const KIND_LABELS: Readonly<Record<IdeaKind, string>> = {
  progression: 'Progresiones',
  twist: 'Un giro para romper el bucle',
  scale: 'Qué escala meter encima',
};

export interface IdeasPanelProps {
  /** Se inyecta en los tests para no llamar al servidor de verdad. */
  readonly fetchIdeas?: (request: IdeasRequest) => Promise<Response>;
}

async function defaultFetch(request: IdeasRequest): Promise<Response> {
  return fetch('/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function IdeasPanel({ fetchIdeas = defaultFetch }: IdeasPanelProps = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const currentDegree = useSessionStore((state) => state.currentDegree);
  const history = useSessionStore((state) => state.noteHistory);

  const [ideas, setIdeas] = useState<readonly Idea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<IdeaKind | null>(null);

  async function ask(kind: IdeaKind) {
    if (activeKey === null) {
      return;
    }

    setPending(kind);
    setError(null);

    const request: IdeasRequest = {
      kind,
      key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
      scale: scaleId,
      ...(currentDegree === null ? {} : { currentDegree }),
      recentNotes: history.map((note) => noteName(note.pitchClass)),
    };

    try {
      const response = await fetchIdeas(request);
      const payload: unknown = await response.json();

      if (!response.ok) {
        const code =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error: { code?: unknown } }).error.code === 'string'
            ? (payload as { error: { code: IdeasErrorCode } }).error.code
            : 'model_unavailable';
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.model_unavailable);
        setIdeas([]);
        return;
      }

      setIdeas((payload as { ideas: readonly Idea[] }).ideas);
    } catch {
      setError(ERROR_MESSAGES.model_unavailable);
      setIdeas([]);
    } finally {
      setPending(null);
    }
  }

  return (
    <Panel id="ideas" title="Ideas">
      <p className="text-text-muted mt-2 text-sm">
        Le pasamos la tonalidad, la escala y los nombres de las notas. Ni el audio ni el vídeo salen
        de tu equipo.
      </p>

      {activeKey === null ? (
        <p className="text-text-muted mt-6">
          Toca unos compases o elige una tonalidad para poder pedir ideas.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(Object.keys(KIND_LABELS) as IdeaKind[]).map((kind) => (
              <Button
                key={kind}
                variant={kind === 'progression' ? 'primary' : 'quiet'}
                disabled={pending !== null}
                onClick={() => void ask(kind)}
              >
                {pending === kind ? 'Pensando…' : KIND_LABELS[kind]}
              </Button>
            ))}
          </div>

          {error !== null && (
            <p role="alert" className="text-oxblood-bright mt-4 text-sm">
              {error}
            </p>
          )}

          <ul className="mt-6 space-y-4" aria-live="polite">
            {ideas.map((idea) => (
              <li key={idea.title} className="border-border border-l-2 pl-4">
                <p className="text-text">{idea.title}</p>
                {idea.chords !== undefined && (
                  <p className="text-brass-bright mt-1 font-mono text-sm">
                    {idea.chords.join(' · ')}
                  </p>
                )}
                {idea.scale !== undefined && (
                  <p className="text-brass-bright mt-1 font-mono text-sm">
                    {SCALES[idea.scale].name} de {spanishNoteName(activeKey.tonic)}
                  </p>
                )}
                <p className="text-text-muted mt-1 text-sm">{idea.why}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
