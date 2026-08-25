'use client';

import { useState } from 'react';

import { can, cheapestPlanWith, MAX_VERSION_DEGREES } from '@core/billing';
import { degreesFromPath, moveById, noteName, resolveDegree } from '@core/music';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { PlanLock } from '@ui/PlanLock';

import {
  ERROR_MESSAGES,
  type Version,
  type VersionsErrorCode,
  type VersionsRequest,
} from './contract';

export interface VersionsPanelProps {
  /** Se inyecta en los tests para no llamar al servidor de verdad. */
  readonly fetchVersions?: (request: VersionsRequest) => Promise<Response>;
}

async function defaultFetch(request: VersionsRequest): Promise<Response> {
  return fetch('/api/versiones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

function errorFrom(payload: unknown): { code: VersionsErrorCode | null; message: string } {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const code = typeof error?.code === 'string' ? (error.code as VersionsErrorCode) : null;
  const message =
    typeof error?.message === 'string' && error.message !== ''
      ? error.message
      : ERROR_MESSAGES.model_unavailable;

  return { code, message };
}

/**
 * Versiones de lo que llevas tocado: los mismos compases con otros acordes.
 *
 * Lo que sube son grados y pulsos, nunca audio. Y lo que baja ya viene
 * **comprobado contra el dominio** por el contrato: cada compás cambiado dice qué
 * movimiento se le ha hecho, y una versión que declara un movimiento falso no
 * llega hasta aquí. Por eso el porqué se puede enseñar al lado de cada acorde sin
 * miedo: no es lo que dijo el modelo, es lo que se ha verificado.
 */
export function VersionsPanel({ fetchVersions = defaultFetch }: VersionsPanelProps = {}) {
  const { account, signedIn } = useAccount();
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);

  // El mismo permiso que comprueba la ruta antes de gastar dinero.
  const puedePedir = can(account.plan, 'versiones');

  const [versions, setVersions] = useState<readonly Version[]>([]);
  const [error, setError] = useState<{ code: VersionsErrorCode | null; message: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const { degrees } = degreesFromPath(
    path.map((chord) => chord.label),
    activeKey?.mode ?? 'major',
  );
  // Con un acorde no hay nada que rearmonizar, y el contrato ya lo rechaza. Se
  // comprueba también aquí para no gastar una petición en que la rechacen.
  const sePuedePedir = activeKey !== null && degrees.length >= 2;

  async function ask() {
    if (activeKey === null || !sePuedePedir) {
      return;
    }
    setPending(true);
    setError(null);

    const request: VersionsRequest = {
      key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
      // Cuatro pulsos a cada uno: el camino de componer es una lista de acordes
      // sin duraciones, así que aquí todos los compases valen lo mismo. Cuando
      // la progresión venga de haber grabado un trozo, los pulsos serán los que
      // se tocaron de verdad y esto pasará a ser lo de menos.
      progression: degrees.slice(0, MAX_VERSION_DEGREES).map((degree) => ({ degree, beats: 4 })),
    };

    try {
      const response = await fetchVersions(request);
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(errorFrom(payload));
        setVersions([]);
        return;
      }
      setVersions((payload as { versions: readonly Version[] }).versions);
    } catch {
      setError({ code: 'model_unavailable', message: ERROR_MESSAGES.model_unavailable });
      setVersions([]);
    } finally {
      setPending(false);
    }
  }

  /** Deja esa versión puesta en el camino, para poder tocarla. */
  function use(version: Version) {
    if (activeKey === null) {
      return;
    }
    const { actions } = useSessionStore.getState();
    actions.clearPath();

    for (const step of version.steps) {
      const move = step.move === null ? null : moveById(step.move);
      // La fundamental y las notas se resuelven aquí y no se copian del paso:
      // son las que usan el mástil y las formas del acorde, y mandarlas vacías
      // dejaría la columna del medio sin nada que dibujar.
      const chord = resolveDegree(activeKey.tonic, activeKey.mode, step.degree);

      actions.pushChord({
        symbol: chord.symbol,
        label: step.degree,
        root: chord.root,
        notes: chord.notes,
        // El porqué es el del movimiento que lo puso ahí, que dice más que el
        // papel del grado: cuenta qué ha cambiado respecto a lo que tocabas.
        why: move === null ? chord.role : move.why,
      });
    }
    actions.setCurrentDegree(version.steps.at(-1)?.degree ?? null);
  }

  if (!puedePedir) {
    return (
      <PlanLock
        needed={cheapestPlanWith('versiones')}
        what="Las versiones de tus canciones"
        plural
        signedIn={signedIn}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void ask()} disabled={pending || !sePuedePedir}>
          {pending ? 'Buscando versiones…' : 'Versiones de esto'}
        </Button>
        {!sePuedePedir && (
          <p className="text-text-muted text-sm">
            Encadena al menos dos acordes: con uno solo no hay nada que rearmonizar.
          </p>
        )}
      </div>

      <p className="text-text-muted mt-2 text-sm">
        Se mandan los grados y sus pulsos, no el sonido. Cada cambio viene con el movimiento que lo
        justifica, y los que no cuadran se descartan antes de llegar aquí.
      </p>

      {error !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {error.message}
        </p>
      )}

      {versions.length > 0 && (
        <ul className="mt-6 space-y-4">
          {versions.map((version) => (
            <li key={version.title} className="superficie p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-text text-base">{version.title}</h3>
                <Button variant="quiet" onClick={() => use(version)}>
                  Ponerla en el camino
                </Button>
              </div>
              <p className="text-text-muted mt-1 text-sm">{version.why}</p>

              <ol aria-label={`Acordes de ${version.title}`} className="mt-3 flex flex-wrap gap-2">
                {version.steps.map((step, index) => {
                  const move = step.move === null ? null : moveById(step.move);
                  return (
                    <li
                      key={`${version.title}-${index}`}
                      // Lo que cambia se destaca y lo que se queda se apaga: es
                      // lo único que hace falta ver de un vistazo con la
                      // guitarra puesta.
                      className={`rounded-md px-2 py-1 text-center ${
                        move === null ? 'text-text-muted' : 'superficie-viva'
                      }`}
                      title={move === null ? 'Se queda como estaba' : move.why}
                    >
                      <span className="text-text block font-mono text-base">{step.symbol}</span>
                      <span className="text-text-muted block font-mono text-xs">
                        {move === null ? step.degree : `${step.from} → ${step.degree}`}
                      </span>
                      {move !== null && (
                        <span className="text-brass-bright block text-xs">{move.name}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
