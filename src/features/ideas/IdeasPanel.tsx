'use client';

import { useState } from 'react';

import { can, cheapestPlanWith } from '@core/billing';
import { noteName, SCALES } from '@core/music';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { PlanLock } from '@ui/PlanLock';
import { PlansLink, seArreglaConPlan } from '@ui/PlansLink';

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
  // El código se guarda con la frase, y no solo la frase: es lo que distingue un
  // «no entra en tu plan» —que se arregla en la pantalla de planes— de un modelo
  // caído, que no se arregla en ningún sitio.
  const [error, setError] = useState<{ code: IdeasErrorCode | null; message: string } | null>(null);
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
        setError(errorFrom(payload));
        setIdeas([]);
        return;
      }

      setIdeas((payload as { ideas: readonly Idea[] }).ideas);
    } catch {
      setError({ code: 'model_unavailable', message: ERROR_MESSAGES.model_unavailable });
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
            plural
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
            <div role="alert" className="mt-4">
              <p className="text-oxblood-bright text-sm">{error.message}</p>
              {/* El candado que salta en marcha lleva al mismo sitio que el que
                  se enseña de antemano: la frase dice qué plan hace falta y el
                  enlace lleva a donde se ve qué trae cada uno. */}
              {seArreglaConPlan(error.code, account.plan) && (
                <PlansLink className="mt-1 inline-block" />
              )}
            </div>
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
 * Lo que se enseña cuando la ruta dice que no: la frase y por qué.
 *
 * La frase que gana es la que manda el servidor, si la manda: los códigos de plan
 * y de cupo se responden con el plan y el número concretos —«entra en el plan
 * Básico: 4,99 € al mes»— y la genérica de aquí no sabe eso. Si no viene ninguna,
 * se usa la del contrato por su código, y si tampoco, la de siempre.
 *
 * El código viaja aparte de la frase porque de él depende si hay algo que pulsar
 * debajo, y adivinarlo leyendo el texto sería atarse a cómo está escrito.
 */
function errorFrom(payload: unknown): { code: IdeasErrorCode | null; message: string } {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return { code: null, message: ERROR_MESSAGES.model_unavailable };
  }
  const error = (payload as { error: { code?: unknown; message?: unknown } }).error;
  const code = typeof error?.code === 'string' ? (error.code as IdeasErrorCode) : null;

  if (typeof error?.message === 'string' && error.message !== '') {
    return { code, message: error.message };
  }
  return {
    code,
    message: (code === null ? undefined : ERROR_MESSAGES[code]) ?? ERROR_MESSAGES.model_unavailable,
  };
}
