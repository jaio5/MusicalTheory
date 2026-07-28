'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { keyName, noteName, resolveProgression } from '@core/music';
import {
  createSessionStorage,
  describeSession,
  type SessionStorage,
  type StoredSession,
} from '@state/session-storage';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

export interface SessionsPanelProps {
  readonly createStorage?: () => SessionStorage;
  /** El instante entra por parámetro para poder probar el guardado. */
  readonly now?: () => number;
}

export function SessionsPanel({ createStorage, now = () => Date.now() }: SessionsPanelProps = {}) {
  const [sessions, setSessions] = useState<readonly StoredSession[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const storageRef = useRef<SessionStorage | null>(null);
  const factoryRef = useRef(createStorage);
  useEffect(() => {
    factoryRef.current = createStorage;
  });

  const storage = useCallback((): SessionStorage => {
    storageRef.current ??= factoryRef.current?.() ?? createSessionStorage();
    return storageRef.current;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSessions(await storage().list());
    } catch {
      setMessage('No se ha podido leer lo guardado. El navegador puede estar en modo privado.');
    }
  }, [storage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    const state = useSessionStore.getState();
    const key = selectActiveKey(state);
    const chords =
      key === null || state.currentDegree === null
        ? []
        : resolveProgression(key.tonic, key.mode, [state.currentDegree]).map(
            (chord) => chord.symbol,
          );

    const session: StoredSession = {
      id: `${now()}`,
      savedAt: now(),
      key,
      scaleId: state.scaleId,
      notes: state.noteHistory.map((note) => noteName(note.pitchClass)),
      chords,
    };

    try {
      await storage().save(session);
      setMessage(null);
      await refresh();
    } catch {
      setMessage('No se ha podido guardar. El navegador puede estar en modo privado.');
    }
  }

  async function restore(session: StoredSession) {
    const { actions } = useSessionStore.getState();
    actions.setScale(session.scaleId);
    if (session.key !== null) {
      actions.pinKey(session.key);
    }
  }

  async function remove(id: string) {
    await storage().remove(id);
    await refresh();
  }

  return (
    <section aria-labelledby="sesiones" className="border-border bg-surface rounded-lg border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="sesiones" className="font-display text-text text-2xl">
          Sesiones
        </h2>
        <Button onClick={() => void save()}>Guardar esta sesión</Button>
      </div>

      <p className="text-text-muted mt-2 text-sm">
        Se guardan en tu navegador: tonalidad, escala y las notas que has tocado. Ni audio ni vídeo,
        y sin cuenta ni servidor.
      </p>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {message}
        </p>
      )}

      {sessions.length === 0 ? (
        <p className="text-text-muted mt-6 text-sm">Todavía no has guardado ninguna.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-2"
            >
              <span className="text-text font-mono text-sm">
                {describeSession(session)}
                {session.key !== null && (
                  <span className="text-text-muted">
                    {' · '}
                    {keyName(session.key.tonic, session.key.mode)}
                  </span>
                )}
              </span>
              <span className="flex gap-2">
                <Button variant="quiet" onClick={() => void restore(session)}>
                  Retomar
                </Button>
                <Button variant="quiet" onClick={() => void remove(session.id)}>
                  Borrar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
