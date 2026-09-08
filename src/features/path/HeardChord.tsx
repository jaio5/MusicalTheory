'use client';

import { accidentalForKey, noteName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';
import { Button } from '@ui/Button';
import { IconoMicro } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

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
 *
 * **Y con el micro cerrado, lo ofrece.** Esta zona se quedaba en blanco, y con
 * ella se quedaba callada la cosa que esta aplicación dice de sí misma en la
 * portada: que te oye tocar. Estaba a un botón de distancia —el de la barra de
 * arriba— y nada lo decía aquí, que es donde pasa. Se puede ofrecer desde aquí
 * porque el micrófono es uno solo y lo sujeta `state/use-listening`: da igual
 * qué botón se pulse.
 */
export function HeardChord({ deps }: { readonly deps?: ListeningDeps } = {}) {
  const heard = useSessionStore((state) => state.heardChord);
  const last = useSessionStore((state) => state.lastHeardChord);
  const listening = useSessionStore((state) => state.listening);
  const path = useSessionStore((state) => state.path);
  const activeKey = useSessionStore(selectActiveKey);
  const actions = useSessionStore((state) => state.actions);
  // Reconocer acordes, no solo notas: es la mitad de lo que hace esta pantalla.
  const { start } = useListening({ chords: true, ...deps });

  const chord = heard ?? last;
  const sounding = heard !== null;

  // Sin nada oído y con el micro cerrado, lo que toca es ofrecerlo. Antes se
  // devolvía nulo y la columna acababa en blanco.
  if (chord === null && listening !== 'listening') {
    return (
      <section aria-label="Reconocer lo que tocas" className="shrink-0">
        <Vacio
          tono="discreto"
          icono={<IconoMicro />}
          titulo="¿Y si lo tocas tú?"
          accion={
            <Button
              variant="quiet"
              onClick={() => void start()}
              disabled={listening === 'requesting'}
              className="px-4 text-sm"
            >
              <IconoMicro />
              {listening === 'requesting' ? 'Pidiendo permiso…' : 'Abrir el micrófono'}
            </Button>
          }
        >
          Con el micro abierto reconozco el acorde que suena, te digo de cuántas maneras se hace y
          lo puedes meter en tu progresión sin escribir nada.
        </Vacio>
      </section>
    );
  }

  const accidental =
    activeKey === null ? 'sharp' : accidentalForKey(activeKey.tonic, activeKey.mode);
  const already = path.at(-1)?.symbol === chord?.symbol;

  return (
    <section aria-label="El acorde que estás tocando" className="shrink-0">
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2">
        {/* El rótulo es lo único que distingue lo que suena de lo que sonó: el
            acorde no se mueve de sitio, para no perderlo de vista al soltar. */}
        <span className="rotulo">{sounding ? 'Suena' : 'Último'}</span>

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
                className="border-brass-bright text-brass-bright hover:bg-brass-dim/20 ml-auto rounded border px-2 py-1 text-xs font-medium"
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
