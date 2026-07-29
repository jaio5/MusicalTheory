'use client';

import { accidentalForKey, noteName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

/**
 * El acorde que la aplicación cree estar oyendo.
 *
 * No entra solo en el camino: se propone y lo confirmas tú. Reconocer acordes
 * por el micro acierta mucho y falla a veces —una inversión, un armónico
 * fuerte— y meter un acorde equivocado en tu progresión es peor que no meter
 * ninguno.
 */
export function HeardChord() {
  const heard = useSessionStore((state) => state.heardChord);
  const listening = useSessionStore((state) => state.listening);
  const path = useSessionStore((state) => state.path);
  const activeKey = useSessionStore(selectActiveKey);
  const actions = useSessionStore((state) => state.actions);

  if (listening !== 'listening') {
    return null;
  }

  const accidental =
    activeKey === null ? 'sharp' : accidentalForKey(activeKey.tonic, activeKey.mode);
  const already = path.at(-1)?.symbol === heard?.symbol;

  return (
    <div className="border-border flex min-h-9 items-center gap-3 border-b px-3 py-1.5">
      <span className="text-text-muted font-mono text-xs tracking-widest uppercase">Suena</span>

      {heard === null ? (
        <span className="text-text-muted text-sm">
          Toca un acorde entero y sosténlo un momento.
        </span>
      ) : (
        <>
          <span className="text-brass-bright font-mono text-lg">{heard.symbol}</span>
          <span className="text-text-muted font-mono text-xs">
            {heard.notes.map((note) => noteName(note, accidental)).join(' · ')}
          </span>

          {!already && (
            <button
              type="button"
              onClick={() =>
                actions.pushChord({
                  symbol: heard.symbol,
                  label: 'lo que suena',
                  root: heard.root,
                  notes: heard.notes,
                  why: 'Lo has tocado tú.',
                })
              }
              className="border-brass-bright text-brass-bright hover:bg-brass-dim/20 ml-auto border px-2 py-1 font-mono text-xs"
            >
              Meterlo en el camino
            </button>
          )}
        </>
      )}
    </div>
  );
}
