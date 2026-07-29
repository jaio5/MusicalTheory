'use client';

import { accidentalForKey, noteName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { VoicingList } from './PathPanel';

/**
 * El acorde que la aplicación cree estar oyendo, y cómo se hace.
 *
 * No entra solo en el camino: se propone y lo confirmas tú. Reconocer acordes
 * por el micro acierta mucho y falla a veces —una inversión, un armónico
 * fuerte— y meter un acorde equivocado en tu progresión es peor que no meter
 * ninguno.
 *
 * **Se queda cuando dejas de tocar.** Antes se borraba en cuanto soltabas las
 * cuerdas, así que para meterlo en el camino había que llegar al botón con el
 * acorde todavía sonando: con las dos manos en la guitarra, no se puede. Ahora
 * lo que suena y lo último que sonó ocupan el mismo sitio, y lo único que
 * cambia es el rótulo.
 */
export function HeardChord() {
  const heard = useSessionStore((state) => state.heardChord);
  const last = useSessionStore((state) => state.lastHeardChord);
  const listening = useSessionStore((state) => state.listening);
  const path = useSessionStore((state) => state.path);
  const activeKey = useSessionStore(selectActiveKey);
  const actions = useSessionStore((state) => state.actions);

  const chord = heard ?? last;
  const sounding = heard !== null;

  // Sin nada oído todavía, la zona solo tiene sentido si se está escuchando:
  // es entonces cuando decir «toca un acorde» sirve de algo.
  if (chord === null && listening !== 'listening') {
    return null;
  }

  const accidental =
    activeKey === null ? 'sharp' : accidentalForKey(activeKey.tonic, activeKey.mode);
  const already = path.at(-1)?.symbol === chord?.symbol;

  return (
    <section aria-label="El acorde que estás tocando" className="shrink-0">
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2">
        {/* El rótulo es lo único que distingue lo que suena de lo que sonó: el
            acorde no se mueve de sitio, para no perderlo de vista al soltar. */}
        <span className="text-text-muted font-mono text-xs tracking-widest uppercase">
          {sounding ? 'Suena' : 'Último'}
        </span>

        {chord === null ? (
          <span className="text-text-muted text-sm">
            Toca un acorde entero y sosténlo un momento.
          </span>
        ) : (
          <>
            <span
              className={`font-mono text-lg ${sounding ? 'text-brass-bright' : 'text-text-muted'}`}
            >
              {chord.symbol}
            </span>
            <span className="text-text-muted font-mono text-xs">
              {chord.notes.map((note) => noteName(note, accidental)).join(' · ')}
            </span>

            {!already && (
              <button
                type="button"
                onClick={() =>
                  actions.pushChord({
                    symbol: chord.symbol,
                    label: 'lo que suena',
                    root: chord.root,
                    notes: chord.notes,
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

      {chord !== null && <VoicingList chord={chord} />}
    </section>
  );
}
