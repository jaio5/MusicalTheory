'use client';

import { useState } from 'react';

import { keyName } from '@core/music';
import { ArrangeCanvas } from '@features/arrange';
import { FretboardPanel } from '@features/fretboard';
import { GananciaAlComponer, useProgress } from '@features/learn';
import { IdeasPanel } from '@features/ideas';
import { Metronome } from '@features/metronome';
import { CurrentChord, HeardChord, NextChords, Voicings } from '@features/path';
import { Grabadora } from '@features/recorder';
import { ResumeLast, SessionsPanel } from '@features/sessions';
import { SongsPanel } from '@features/songs';
import { VersionsPanel } from '@features/versions';
import { BarraDeTonalidad, KeyPanel } from '@features/wheel';
import { Settings } from '@features/workspace';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Chip } from '@ui/Chip';
import { EmpezarPorTonalidad } from '@ui/EmpezarPorTonalidad';
import {
  IconoCanciones,
  IconoCerrar,
  IconoIdeas,
  IconoMastil,
  IconoPunto,
  IconoSalidas,
  IconoSesiones,
} from '@ui/icons';
import { WorkHeader } from '@ui/Screen';

/**
 * Las dos caras de componer.
 *
 * `tocar` responde a «qué acorde tengo delante» —la rueda, sus formas, a dónde
 * ir— y `montar` a «cómo va mi canción», que es una pregunta horizontal y en el
 * tiempo. Son dos caras y no dos zonas de la misma pantalla a propósito: metida
 * entre las tres columnas, la línea de tiempo habría dejado seis franjas
 * peleando por el alto de un portátil, y este fichero ya explicaba más abajo que
 * con cinco no hay reparto bueno.
 *
 * Lo que no se duplica es nada: las dos caras leen la misma tonalidad, el mismo
 * tempo y el mismo estado de sesión, y la barra de herramientas de abajo es la
 * de siempre en las dos.
 */
type Cara = 'tocar' | 'montar';

type ExtraId = 'fretboard' | 'grabar' | 'ideas' | 'versions' | 'songs' | 'sessions';

interface Extra {
  readonly id: ExtraId;
  readonly name: string;
  /**
   * El dibujo de la pastilla.
   *
   * Antes eran cinco rótulos en fila —«Mástil», «Ideas», «Salidas», «Canciones»,
   * «Sesiones»— que había que leer enteros para elegir uno, y en el móvil el
   * quinto se salía por la derecha sin que nada dijera que seguía habiendo más.
   */
  readonly Icono: () => React.ReactElement;
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
  { id: 'fretboard', name: 'Mástil', Icono: IconoMastil, render: FretboardPanel, fits: true },
  // Grabar es una herramienta más y no una franja fija arriba, que es lo que
  // era cuando grababa vídeo: se abre, se graba, se oye y se cierra.
  { id: 'grabar', name: 'Grabar', Icono: IconoPunto, render: Grabadora, fits: true },
  { id: 'ideas', name: 'Ideas', Icono: IconoIdeas, render: IdeasPanel },
  // Versiones al lado de Ideas porque las dos preguntan al modelo, y las dos
  // cuestan una petición del cupo: tenerlas juntas dice sin decirlo cuáles son
  // las que gastan.
  { id: 'versions', name: 'Salidas', Icono: IconoSalidas, render: VersionsPanel },
  // Canciones antes que Sesiones porque no son lo mismo y se confunden: una
  // canción se guarda a propósito y con nombre, y una sesión es el rastro de lo
  // que se tocó. Lo que se busca a menudo va primero.
  { id: 'songs', name: 'Canciones', Icono: IconoCanciones, render: SongsPanel },
  { id: 'sessions', name: 'Sesiones', Icono: IconoSesiones, render: SessionsPanel },
];

/**
 * Componer: la rueda para elegir tonalidad, la progresión que llevas, a dónde
 * puedes ir y de cuántas maneras se hace cada acorde.
 *
 * **Ya no envuelve a nadie.** Estuvo metida dentro del grabador de vídeo, que
 * necesitaba ponerse por detrás de la pantalla entera para que te vieras tocando;
 * eso se llevaba una franja fija arriba y dejaba la aplicación en contorno
 * mientras durase. Grabando solo el sonido no hace falta nada de eso: la
 * grabadora es una herramienta más de la fila de abajo
 * ([adr/0023](../../../docs/adr/0023-grabar-solo-el-sonido.md)).
 */
export function ComposeScreen() {
  const activeKey = useSessionStore(selectActiveKey);
  /**
   * Si todavía no se ha elegido ningún acorde, y con eso **qué va primero en el
   * móvil**.
   *
   * Apiladas, las tres franjas salían en el orden de la pantalla ancha: el acorde
   * elegido, lo que suena y, al final, la lista. Sin acorde las dos primeras son
   * invitaciones —«elige uno», «abre el micro»— así que en un teléfono había que
   * pasar por delante de setecientos píxeles de sugerencias para llegar a lo
   * único que se puede hacer. Con acorde el orden es el bueno: lo primero que se
   * mira es cómo se hace el que acabas de elegir.
   *
   * En pantalla ancha no se toca nada: allí son columnas, y las columnas no
   * tienen «antes».
   */
  const sinAcorde = useSessionStore((state) => state.path.length === 0);
  const [cara, setCara] = useState<Cara>('tocar');
  const [extra, setExtra] = useState<ExtraId | null>(null);
  const current = EXTRAS.find((candidate) => candidate.id === extra) ?? null;

  /**
   * Componer cuenta como practicar, y esta es la única pantalla que lo escucha.
   *
   * `escuchaComponer` va encendido aquí y en ningún sitio más: cada llamada a
   * `useProgress` tiene su propia copia del avance, así que dos apuntados
   * sumarían dos veces el mismo hecho y se pisarían al guardar. Aquí es donde se
   * compone, así que aquí es donde se cuenta.
   */
  const { composeGain, dismissComposeGain } = useProgress({ escuchaComponer: true });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* El metrónomo va **dentro** del encabezado, en el hueco de acciones
            que `WorkHeader` ya tenía. Eran dos franjas fijas de unos 110 px
            juntas, y en un portátil eso es justo lo que le falta al mástil para
            verse entero. La pantalla sigue teniendo su `h1` y su línea, que es
            lo que pide la regla; lo que se ha ido es la fila de más. */}
      <WorkHeader
        title="Componer"
        lead={
          cara === 'tocar'
            ? 'Tonalidad, acordes, a dónde ir y grabar lo que tocas.'
            : 'La canción por bloques: arrástralos, estíralos y escúchala.'
        }
        actions={
          // El hueco de acciones de `WorkHeader` es un bloque, no una fila: sin
          // esta caja, el conmutador y el metrónomo se apilaban y la cabecera
          // crecía cincuenta píxeles, que es justo lo que este fichero se
          // esforzó en ahorrarle al mástil.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* El conmutador antes que el metrónomo: es lo que cambia la
                  pantalla entera, y lo que cambia más cosas va primero. */}
            <span className="flex gap-1" role="group" aria-label="Cómo componer">
              <Chip
                onClick={() => setCara('tocar')}
                pressed={cara === 'tocar'}
                tone="quiet"
                className="px-3 text-xs"
              >
                Tocar
              </Chip>
              <Chip
                onClick={() => setCara('montar')}
                pressed={cara === 'montar'}
                tone="quiet"
                className="px-3 text-xs"
              >
                Montar
              </Chip>
            </span>
            <Metronome />
          </div>
        }
      />

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
      <div
        // `shrink-0` y `bg-surface`: la barra es una fila de rótulo y ya, porque
        // lo que se abre **flota** sobre el lienzo en vez de empujarlo. Mientras
        // empujaba había que dejarla encoger y aun así la rueda salía cortada;
        // ahora no compite por el alto con nadie.
        className={`border-border bg-surface shrink-0 border-b px-3 ${
          cara === 'montar' ? '' : 'lg:hidden'
        }`}
      >
        <BarraDeTonalidad>
          <Settings />
        </BarraDeTonalidad>
      </div>

      {/* Una cara o la otra, nunca las dos: lo que se gana montando es
            que la canción ocupe la pantalla, y eso no cabe si al lado sigue
            estando el inspector de un acorde. */}
      {cara === 'montar' ? (
        <ArrangeCanvas />
      ) : (
        <>
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
          <div className="grid min-h-0 grow auto-rows-min grid-cols-1 gap-px overflow-y-auto lg:auto-rows-auto lg:grid-cols-[16rem_minmax(0,1fr)_19rem] lg:overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_23rem]">
            {/* Cada cosa con su tamaño y la columna con scroll: si se dejan
                encoger, con el mástil abierto la rueda se queda en un botón. */}
            {/*
              Las dos columnas de los lados van sobre `surface` y la del medio
              sobre el fondo.

              Estaban las tres sobre el mismo negro, separadas por una línea de un
              píxel, y desde lejos eso es **una pared plana**: no se veía que la
              rueda y la lista de acordes son lo que se consulta y el medio es
              donde se trabaja. Es lo que este proyecto ya dice de la profundidad
              —«lo que da modernidad no es más color, es que se note qué está
              encima de qué»— y lo que hasta ahora no se aplicaba justo en la
              pantalla que más se mira.
            */}
            <section
              aria-label="Tonalidad"
              className="border-border bg-surface hidden min-h-0 flex-col items-center gap-2 overflow-y-auto border-r p-3 lg:flex [&>*]:shrink-0"
            >
              <KeyPanel compact />
              <p className="text-text-muted text-center text-xs">
                {activeKey === null
                  ? 'Pulsa una tonalidad para empezar'
                  : keyName(activeKey.tonic, activeKey.mode)}
              </p>
              <Settings />
            </section>

            {/* Sin tonalidad, las dos columnas de la derecha **son una sola cosa
                que decir**: que hay que elegir una y por qué. Tres paneles
                repitiendo cada uno su versión de «elige una tonalidad» —uno
                centrado a media pantalla, otro bajo el rótulo «Elegido» y un
                tercero en la columna de al lado— es lo que dejaba componer
                pareciendo una pantalla rota en vez de una que espera. */}
            {activeKey === null ? (
              <section
                aria-label="Por dónde se empieza"
                // `my-auto` en el hijo y no `justify-center` aquí, que es la
                // regla de la casa: centrar en la caja que se desplaza saca lo
                // que no cabe por los dos lados y deja la mitad de arriba fuera
                // de alcance.
                className="border-border flex min-h-0 flex-col overflow-y-auto border-t lg:col-span-2 lg:border-t-0"
              >
                <div className="my-auto">
                  <EmpezarPorTonalidad />
                </div>
              </section>
            ) : (
              <>
                <section
                  aria-label="El acorde y sus formas"
                  className={`flex min-h-0 flex-col lg:order-none lg:overflow-y-auto ${
                    sinAcorde ? 'order-2' : 'order-1'
                  }`}
                >
                  {/* Arriba lo que has elegido tú, abajo lo que estás tocando.
                      Cada cosa tiene su sitio fijo, así que al soltar las cuerdas
                      nada se mueve: solo cambia el rótulo de «Suena» a «Último». */}
                  <CurrentChord />
                  <Voicings />
                  <HeardChord />
                </section>

                <section
                  aria-label="A dónde puedes ir"
                  className={`border-border lg:bg-surface flex min-h-0 flex-col overflow-hidden border-t lg:order-none lg:border-t-0 lg:border-l ${
                    sinAcorde ? 'order-1 border-t-0 border-b lg:border-b-0' : 'order-2'
                  }`}
                >
                  <NextChords />
                </section>
              </>
            )}
          </div>
        </>
      )}

      {/* Abajo y a todo lo ancho: el mástil son seis cuerdas y quince trastes,
            y en una columna estrecha no se lee. La altura la pone el contenido
            hasta un tope, así que el mástil se estira y las sesiones no dejan
            medio hueco vacío debajo. */}
      <section
        aria-label="Herramientas"
        // `relative`, porque lo que se abre se ancla aquí y sale hacia arriba.
        className="border-border relative flex shrink-0 flex-col border-t"
      >
        {/* La fila se desplaza a lo ancho en el móvil y no se parte en dos:
              seis pastillas envueltas dejaban la barra a dos alturas justo donde
              menos alto hay. `scrollbar-none` no existe aquí, así que la barra se
              ve —y es correcto: dice que hay más a la derecha, que era lo que
              faltaba cuando «Sesiones» se salía por el borde sin avisar. */}
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {EXTRAS.map((candidate) => (
            <Chip
              key={candidate.id}
              onClick={() => setExtra(extra === candidate.id ? null : candidate.id)}
              pressed={extra === candidate.id}
              tone="quiet"
              className="shrink-0 text-xs"
            >
              <candidate.Icono />
              {candidate.name}
            </Chip>
          ))}

          {current !== null && (
            <button
              type="button"
              onClick={() => setExtra(null)}
              aria-label={`Cerrar ${current.name}`}
              title="Cerrar"
              className="text-text-muted hover:text-oxblood-bright min-h-tap ml-auto inline-flex shrink-0 cursor-pointer items-center px-2"
            >
              <IconoCerrar />
            </button>
          )}
        </div>

        {current !== null && (
          <div
            id="herramienta-abierta"
            // **Se abre encima, no empuja.** Antes se llevaba una tajada del
            // alto y las tres columnas se apretaban: la rueda salía cortada por
            // la mitad y la lista de acordes a media fila. Al ponerles suelo, el
            // que desaparecía era el panel. No hay reparto bueno en un portátil:
            // son cinco franjas peleando por el mismo alto.
            //
            // Como cajón, no se encoge nadie. Y encaja con lo que esto es: el
            // mástil se mira un momento mientras tocas, no convive con la rueda.
            // «Perder la mitad de la pantalla mientras está abierto es un precio
            // que se paga solo mientras se mira», que es lo que el proyecto ya
            // decía del mástil.
            //
            // `bottom-full` lo pega justo encima de la barra de pestañas, y la
            // sombra hacia arriba es lo que dice que hay algo debajo, en vez de
            // parecer que la pantalla se acaba ahí. Sale de
            // `--sombra-alta-arriba` y no de un `rgba` escrito aquí: estuvo en
            // `rgba(0,0,0,0.5)`, que sobre el tema hielo es un borrón negro, y un
            // número dentro de una cadena no lo ve el test que vigila que los
            // relieves sigan a la paleta.
            // `surface-raised` y no `surface`: lo que está encima se dice con
            // el tono, no solo con la sombra. Con el mismo fondo que lo de
            // debajo, el cajón parecía el final de la pantalla en vez de una
            // capa, que es justo lo que este proyecto pide de la profundidad.
            className={`bg-surface-raised border-border absolute inset-x-0 bottom-full z-20 border-t p-3 shadow-[var(--sombra-alta-arriba)] ${
              current.fits === true
                ? 'max-h-[min(62vh,44rem)] overflow-hidden'
                : 'max-h-[min(58vh,30rem)] overflow-auto'
            }`}
          >
            <h2 className="rotulo mb-2 flex items-center gap-2">
              <current.Icono />
              {current.name}
            </h2>
            <current.render />
          </div>
        )}

        {/* Dentro de la barra, que es la caja `relative` de esta pantalla, y
            saliendo hacia arriba desde ella: así queda por encima de las
            herramientas en el escritorio y por encima de las **dos** barras en
            un teléfono, sin que nadie tenga que adivinar cuánto miden. No empuja
            nada: flota. */}
        <GananciaAlComponer gain={composeGain} onDismiss={dismissComposeGain} />
      </section>
    </div>
  );
}
