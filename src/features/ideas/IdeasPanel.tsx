'use client';

import { useState } from 'react';

import { can, cheapestPlanWith } from '@core/billing';
import { noteName, SCALES } from '@core/music';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { PlanLock } from '@ui/PlanLock';

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
  const { account, signedIn } = useAccount();
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const currentDegree = useSessionStore((state) => state.currentDegree);
  const history = useSessionStore((state) => state.noteHistory);

  // El mismo permiso que comprueba la ruta antes de gastar dinero. Preguntando
  // los dos a `core/billing` no puede pasar que la pantalla enseñe un botón que
  // el servidor va a rechazar.
  const puedePedir = can(account.plan, 'ideas');

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
        setError(errorMessage(payload));
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
    <div>
      <p className="text-text-muted mt-2 text-sm">
        Le pasamos la tonalidad, la escala y los nombres de las notas. Ni el audio ni el vídeo salen
        de tu equipo.
      </p>

      {!puedePedir ? (
        <div className="mt-6">
          <PlanLock
            needed={cheapestPlanWith('ideas')}
            what="Las ideas de la IA"
            signedIn={signedIn}
          />
          <p className="text-text-muted mt-2 text-xs">
            Es la parte más cara: cada pulsación son varias progresiones razonadas. Todo lo demás de
            esta pantalla —los acordes, el mástil, a dónde ir, el metrónomo y grabarte— es gratis.
          </p>
        </div>
      ) : activeKey === null ? (
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
                    {SCALES[idea.scale].name} de {noteName(activeKey.tonic)}
                  </p>
                )}
                <p className="text-text-muted mt-1 text-sm">{idea.why}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * El mensaje que se enseña cuando la ruta dice que no.
 *
 * Gana el que manda el servidor, si lo manda: los códigos de plan y de cupo se
 * responden con el plan y el número concretos —«entra en el plan Estudiante:
 * 4,99 € al mes»— y la frase genérica de aquí no sabe eso. Si no viene ninguno, se
 * usa el del contrato por su código, y si tampoco, el de siempre.
 */
function errorMessage(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return ERROR_MESSAGES.model_unavailable;
  }
  const error = (payload as { error: { code?: unknown; message?: unknown } }).error;
  if (typeof error?.message === 'string' && error.message !== '') {
    return error.message;
  }
  const code = typeof error?.code === 'string' ? (error.code as IdeasErrorCode) : null;
  return (code === null ? undefined : ERROR_MESSAGES[code]) ?? ERROR_MESSAGES.model_unavailable;
}
