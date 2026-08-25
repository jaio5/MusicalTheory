'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { keyName, SCALES } from '@core/music';
import {
  createSessionStorage,
  type SessionStorage,
  type StoredSession,
} from '@state/session-storage';
import { useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

export interface ResumeLastProps {
  readonly createStorage?: () => SessionStorage;
}

/**
 * La última sesión, ofrecida y no puesta.
 *
 * Aquí había una deuda con dos mitades que se contradecían: restaurar sola la
 * última sesión al abrir era cómodo, y también era sorprendente —entrar y
 * encontrarte una tonalidad fijada que no has elegido hoy es peor que no
 * encontrarte nada—. Así que no se aplica: se **ofrece**, en una línea, con lo
 * que había dentro escrito para poder decidir sin abrirla.
 *
 * Y solo aparece si no estorba: con la tonalidad ya elegida, con acordes
 * encadenados o con notas tocadas ya no se pinta, porque entonces la sesión que
 * importa es esta y no la de ayer.
 */
export function ResumeLast({ createStorage }: ResumeLastProps = {}) {
  const [last, setLast] = useState<StoredSession | null>(null);
  const [descartada, setDescartada] = useState(false);

  const pinnedKey = useSessionStore((state) => state.pinnedKey);
  const path = useSessionStore((state) => state.path);
  const noteHistory = useSessionStore((state) => state.noteHistory);

  const factoryRef = useRef(createStorage);
  useEffect(() => {
    factoryRef.current = createStorage;
  });

  const leer = useCallback(async () => {
    try {
      const storage = factoryRef.current?.() ?? createSessionStorage();
      const guardadas = await storage.list();
      return guardadas[0] ?? null;
    } catch {
      // El navegador puede estar en modo privado. No poder ofrecer la última
      // sesión no es un error que merezca una frase en pantalla: se calla.
      return null;
    }
  }, []);

  useEffect(() => {
    void leer().then(setLast);
  }, [leer]);

  // Virgen: nada elegido y nada tocado todavía. Se mira aquí y no al leer
  // porque entre abrir la pantalla y contestar IndexedDB da tiempo a tocar.
  const virgen = pinnedKey === null && path.length === 0 && noteHistory.length === 0;

  if (last === null || descartada || !virgen || last.key === null) {
    return null;
  }

  const escala = SCALES[last.scaleId];

  return (
    <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5">
      <p className="text-text-muted min-w-0 grow text-sm">
        La última vez estabas en{' '}
        <span className="text-brass-bright">{keyName(last.key.tonic, last.key.mode)}</span>
        {escala !== undefined && <> con la {escala.name.toLowerCase()}</>}.
      </p>
      <Button
        variant="quiet"
        onClick={() => {
          const { actions } = useSessionStore.getState();
          actions.setScale(last.scaleId);
          if (last.key !== null) {
            actions.pinKey(last.key);
          }
          setDescartada(true);
        }}
      >
        Seguir por ahí
      </Button>
      <button
        type="button"
        onClick={() => setDescartada(true)}
        aria-label="Empezar de cero"
        title="Empezar de cero"
        className="text-text-muted hover:text-oxblood-bright px-2 text-sm"
      >
        ×
      </button>
    </div>
  );
}
