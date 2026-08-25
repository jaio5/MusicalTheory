'use client';

import { useState } from 'react';

import { keyName } from '@core/music';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { Metronome } from '@features/metronome';
import { CurrentChord, HeardChord, NextChords, Voicings } from '@features/path';
import { RecordStage } from '@features/recorder';
import { ResumeLast, SessionsPanel } from '@features/sessions';
import { SongsPanel } from '@features/songs';
import { VersionsPanel } from '@features/versions';
import { KeyPanel } from '@features/wheel';
import { Settings } from '@features/workspace';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Chip } from '@ui/Chip';
import { Disclosure } from '@ui/Disclosure';
import { WorkHeader } from '@ui/Screen';

type ExtraId = 'fretboard' | 'ideas' | 'versions' | 'songs' | 'sessions';

interface Extra {
  readonly id: ExtraId;
  readonly name: string;
  readonly render: () => React.ReactElement;
  /**
   * Si lo de dentro se dibuja entero o hay que desplazarlo. El mástil se dibuja
   * entero y no hace scroll nunca; lo demás es texto, y el texto se lee
   * desplazándolo.
   *
   * En los dos casos la altura la pone el contenido y el tope solo recorta.
   * Con un alto fijo, el mástil —que es casi cuatro veces más ancho que alto—
   * dejaba cien píxeles muertos arriba y abajo, y sin tonalidad elegida dejaba
   * la franja entera vacía.
   */
  readonly fits?: boolean;
}

const EXTRAS: readonly Extra[] = [
  { id: 'fretboard', name: 'Mástil', render: FretboardPanel, fits: true },
  { id: 'ideas', name: 'Ideas', render: IdeasPanel },
  // Versiones al lado de Ideas porque las dos preguntan al modelo, y las dos
  // cuestan una petición del cupo: tenerlas juntas dice sin decirlo cuáles son
  // las que gastan.
  { id: 'versions', name: 'Versiones', render: VersionsPanel },
  // Canciones antes que Sesiones porque no son lo mismo y se confunden: una
  // canción se guarda a propósito y con nombre, y una sesión es el rastro de lo
  // que se tocó. Lo que se busca a menudo va primero.
  { id: 'songs', name: 'Canciones', render: SongsPanel },
  { id: 'sessions', name: 'Sesiones', render: SessionsPanel },
];

/**
 * Componer: la rueda para elegir tonalidad, la progresión que llevas, a dónde
 * puedes ir y de cuántas maneras se hace cada acorde.
 *
 * Va envuelta en el grabador porque grabarte tocando es parte de componer: le
 * das al botón y te ves detrás de todo mientras sigues leyendo los acordes.
 */
export function ComposeScreen() {
  const activeKey = useSessionStore(selectActiveKey);
  const [extra, setExtra] = useState<ExtraId | null>(null);
  const current = EXTRAS.find((candidate) => candidate.id === extra) ?? null;

  return (
    <RecordStage>
      <div className="flex h-full min-h-0 flex-col">
        <WorkHeader title="Componer" lead="Tonalidad, progresión, acordes y grabarte tocando." />

        {/* Se ofrece la última sesión, no se pone. Desaparece sola en cuanto
            eliges tonalidad o tocas algo. */}
        <ResumeLast />

        {/*
          En el móvil, la tonalidad se pliega.

          La rueda de quintas y los ajustes ocupan media pantalla de teléfono y son
          justo lo que se toca **una vez** al empezar: se elige el tono y ya no se
          vuelve. Plegada deja a la vista lo que se mira todo el rato —el acorde,
          sus formas y a dónde ir— y dice en una línea en qué tonalidad estás, que
          es lo único que hay que saber mientras tanto.

          En pantalla ancha no se pliega nada: ahí la rueda vive en su columna.
        */}
        <div className="border-border shrink-0 border-b px-3 lg:hidden">
          <Disclosure
            summary={
              <>
                Tonalidad:{' '}
                <span className="text-brass-bright">
                  {activeKey === null ? 'sin elegir' : keyName(activeKey.tonic, activeKey.mode)}
                </span>
              </>
            }
          >
            <div className="flex flex-col items-center gap-2 pt-2 pb-3">
              <KeyPanel compact />
              <Settings />
            </div>
          </Disclosure>
        </div>

        {/* El metrónomo, arriba y siempre a la vista: es un control de los de
            poner en marcha y olvidarse, como el de grabar, no un ajuste que se
            busca en una columna. */}
        <div className="border-border shrink-0 border-b px-3 py-1.5">
          <Metronome />
        </div>

        {/*
          `auto-rows-min` es lo que arregla las dos cosas a la vez en el móvil.

          Apiladas, las filas se estiraban hasta repartirse el alto disponible: si
          el contenido de una crecía —al elegir un acorde salen sus formas— se
          salía de su fila y **se montaba encima de la siguiente**, y si menguaba
          quedaba hueco vacío por el que desplazarse. Con las filas medidas por su
          contenido no hay ni lo uno ni lo otro: cada cosa ocupa lo suyo y quien se
          desplaza es esta caja.

          En pantalla ancha vuelven a estirarse, que es lo que quieren tres
          columnas de la misma altura.
        */}
        <div className="grid min-h-0 grow auto-rows-min grid-cols-1 gap-px overflow-y-auto lg:min-h-[18rem] lg:auto-rows-auto lg:grid-cols-[16rem_minmax(0,1fr)_19rem] lg:overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_23rem]">
          {/* Cada cosa con su tamaño y la columna con scroll: si se dejan
              encoger, con el mástil abierto la rueda se queda en un botón. */}
          <section
            aria-label="Tonalidad"
            className="border-border hidden min-h-0 flex-col items-center gap-2 overflow-y-auto border-r p-3 lg:flex [&>*]:shrink-0"
          >
            <KeyPanel compact />
            <p className="text-text-muted text-center font-mono text-xs">
              {activeKey === null
                ? 'Pulsa una tonalidad para empezar'
                : keyName(activeKey.tonic, activeKey.mode)}
            </p>
            <Settings />
          </section>

          <section
            aria-label="El acorde y sus formas"
            className="flex min-h-0 flex-col lg:overflow-y-auto"
          >
            {/* Arriba lo que has elegido tú, abajo lo que estás tocando. Cada
                cosa tiene su sitio fijo, así que al soltar las cuerdas nada se
                mueve: solo cambia el rótulo de «Suena» a «Último». */}
            <CurrentChord />
            <Voicings />
            <HeardChord />
          </section>

          <section
            aria-label="A dónde puedes ir"
            className="border-border flex min-h-0 flex-col overflow-hidden border-t lg:border-t-0 lg:border-l"
          >
            <NextChords />
          </section>
        </div>

        {/* Abajo y a todo lo ancho: el mástil son seis cuerdas y quince trastes,
            y en una columna estrecha no se lee. La altura la pone el contenido
            hasta un tope, así que el mástil se estira y las sesiones no dejan
            medio hueco vacío debajo. */}
        <section
          aria-label="Herramientas"
          // **No es `shrink-0`, y ese era el fallo.** Con la franja rígida y las
          // columnas sin mínimo, abrir una herramienta en un portátil bajo las
          // aplastaba: la rueda salía cortada por la mitad y la lista de acordes
          // a media fila.
          //
          // Ahora **los dos tienen suelo**: las columnas no bajan de 18rem y el
          // panel abierto no baja de 7rem. Solo con el mínimo en las columnas,
          // el arreglo se daba la vuelta y era el panel el que desaparecía. En
          // una pantalla donde no quepan los dos suelos, cede este, que es lo
          // secundario: la pantalla es el acorde y a dónde ir.
          className="border-border flex min-h-0 flex-col border-t"
        >
          <div className="flex gap-1 px-3 py-1.5">
            {EXTRAS.map((candidate) => (
              <Chip
                key={candidate.id}
                onClick={() => setExtra(extra === candidate.id ? null : candidate.id)}
                pressed={extra === candidate.id}
                tone="quiet"
                className="text-xs"
              >
                {candidate.name}
              </Chip>
            ))}

            {current !== null && (
              <button
                type="button"
                onClick={() => setExtra(null)}
                aria-label={`Cerrar ${current.name}`}
                title="Cerrar"
                className="text-text-muted hover:text-oxblood-bright ml-auto px-2 text-sm"
              >
                ×
              </button>
            )}
          </div>

          {current !== null && (
            <div
              id="herramienta-abierta"
              // El tope va en `vh` en el móvil —ahí esto se apila y el viewport
              // **es** el espacio disponible— y en `lg` manda `min-h-0`: la
              // franja se queda con lo que sobre después de que las columnas
              // tengan su mínimo, en vez de morder una fracción fija de la
              // pantalla que en un portátil bajo se las comía.
              className={`border-border min-h-0 border-t p-3 ${
                current.fits === true
                  ? 'max-h-[45vh] overflow-hidden lg:max-h-[46rem] lg:min-h-[7rem]'
                  : 'max-h-[45vh] overflow-auto lg:max-h-[26rem] lg:min-h-[7rem]'
              }`}
            >
              <current.render />
            </div>
          )}
        </section>
      </div>
    </RecordStage>
  );
}
