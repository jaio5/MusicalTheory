'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { keyName, noteName, resolveProgression, SCALES } from '@core/music';
import {
  createSessionStorage,
  describeSession,
  type SessionStorage,
  type StoredSession,
} from '@state/session-storage';
import { selectActiveKey, selectEscala, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { IconoSesiones } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

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
    /* v8 ignore next -- sin fabrica se usa el almacen de verdad, que es el de la aplicacion */
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
      scaleId: selectEscala(state),
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
    // **Lo guardado no se cree a ciegas**, igual que en `ResumeLast`: una escala
    // que ya no existe —renombrada, o de otra versión— llegaba al mástil y tumbaba
    // componer. Se retoma la tonalidad, y la escala solo si sigue en el catálogo.
    // `Object.hasOwn` porque un `toString` también «está» en cualquier objeto.
    if (Object.hasOwn(SCALES, session.scaleId)) {
      actions.setScale(session.scaleId);
    }
    if (session.key !== null) {
      actions.pinKey(session.key);
    }
  }

  async function remove(id: string) {
    // Con su aviso, como leer y guardar. Sin él, en modo privado la fila se
    // quedaba ahí sin decir nada y la promesa se rechazaba sola.
    try {
      await storage().remove(id);
      await refresh();
    } catch {
      setMessage('No se ha podido borrar. El navegador puede estar en modo privado.');
    }
  }

  return (
    <div>
      {/* La explicación y el botón, en la misma fila y en ese orden: qué es esto
          antes que el botón de hacerlo. Estaban en dos filas y el botón arriba
          del todo a la derecha, tan lejos de su frase que parecía de otra cosa. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-text-muted max-w-prose text-sm">
          Se guardan en tu navegador: tonalidad, escala y las notas que has tocado. Nada de audio, y
          sin cuenta ni servidor.
        </p>
        <Button onClick={() => void save()} className="shrink-0">
          <IconoSesiones />
          Guardar esta sesión
        </Button>
      </div>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {message}
        </p>
      )}

      {sessions.length === 0 ? (
        <Vacio tono="discreto" icono={<IconoSesiones />} titulo="Todavía no has guardado ninguna">
          Una sesión es el rastro de un rato de tocar: en qué tonalidad ibas y qué notas salieron.
          Guarda esta y la tendrás para retomarla donde la dejaste.
        </Vacio>
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
    </div>
  );
}
