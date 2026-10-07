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
      /* v8 ignore next -- sin fabrica se usa el almacen de verdad, que es el de la aplicacion */
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

  // **Lo guardado no se cree a ciegas.** Una escala que ya no existe —renombrada,
  // o de otra versión— se aplicaba igual, llegaba al mástil y tumbaba componer.
  // Se ofrece la tonalidad, que es lo que se viene a retomar, y la escala solo si
  // sigue en el catálogo. `Object.hasOwn` porque un `toString` también «está» en
  // cualquier objeto.
  const escala = Object.hasOwn(SCALES, last.scaleId) ? SCALES[last.scaleId] : undefined;

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
          if (escala !== undefined) {
            actions.setScale(last.scaleId);
          }
          /* v8 ignore next 3 -- el aviso no se pinta sin tonalidad guardada, y aqui `last` ya la tiene */
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
        // Del alto de lo que se pulsa, como el botón de al lado: con `px-2` y la
        // letra pequeña medía veinte píxeles de alto, y es la «×» que se da con
        // el pulgar para quitarse esto de encima.
        className="text-text-muted hover:text-oxblood-bright size-tap inline-flex shrink-0 cursor-pointer items-center justify-center text-lg"
      >
        ×
      </button>
    </div>
  );
}
