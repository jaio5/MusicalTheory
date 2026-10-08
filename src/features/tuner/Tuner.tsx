'use client';

import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';
import { nearestString, semitonesFromString, TUNINGS, type TuningId } from '@core/instrument';
import { cifra, cifraConSigno } from '@core/cifras';
import { noteName, type PitchReading } from '@core/music';
import { Button } from '@ui/Button';
import { IconoMicro } from '@ui/icons';
import { Vacio } from '@ui/Vacio';
import { Panel } from '@ui/Panel';
import { useSessionStore, type ListeningState } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';

import { useEffect, useRef } from 'react';

import { LevelMeter } from './LevelMeter';
import { TuningMeter } from './TuningMeter';
import { PERMANENCIA_MS, useEstable } from './use-estable';
import {
  isSignalClean,
  isSignalDirty,
  readingAnnouncement,
  tuningAdvice,
  tuningStatus,
} from './tuning';

export type TunerProps = ListeningDeps;

/**
 * Cuánto tiene que durar la señal sucia para decirlo.
 *
 * Más que el ataque de la púa y menos que lo que se tarda en girar una clavija:
 * con una nota limpia la claridad cae en el golpe y en la cola, nunca seis
 * décimas seguidas; con distorsión o dos cuerdas, cae y se queda.
 */
const SUCIA_SEGUIDA_MS = 600;

export function Tuner(deps: TunerProps = {}) {
  /*
    **Aquí solo lo que cambia cuando se pulsa algo.** La lectura, la claridad y
    el nivel llegan veinte veces por segundo, y leídas aquí repintaban el panel
    entero —el botón de parar, la región viva— para
    mover una aguja. Las lee `Listening`, que es quien las enseña, y la región
    viva lee su frase ya hecha: una cadena igual no repinta nada.
  */
  const listening = useSessionStore((state) => state.listening);
  const message = useSessionStore((state) => state.message);
  const { start, stop } = useListening(deps);

  /*
    **El micrófono no se elige aquí.** Había un desplegable propio, con su
    `useState`: lo elegido en el afinador no lo sabía nadie más —componer y la
    toma abrían el del sistema— y al recargar se olvidaba. Ahora la elección es
    una (`state/microfono.ts`), se cambia con el mando de la barra, que está
    encima de esta pantalla, y `start()` sin nada abre la elegida.
  */

  /**
   * Si hay que devolver el foco cuando se acabe de abrir o de cerrar el micro.
   *
   * Los dos botones —«Escuchar la guitarra» y «Dejar de escuchar»— viven en
   * pantallas distintas, y al pulsar uno la suya se cambia por la otra: el botón
   * se iba con el foco dentro y el foco caía en el `<body>`. Se apunta que lo
   * pidió un botón y, cuando la otra pantalla ya está, el foco pasa a su botón
   * equivalente. Mientras se pide permiso no: el botón sigue ahí, trabajando.
   */
  const devolverElFoco = useRef(false);
  useEffect(() => {
    if (!devolverElFoco.current || listening === 'requesting') {
      return;
    }
    devolverElFoco.current = false;
    // Solo si se ha perdido: si el permiso se denegó, el botón sigue con él.
    // Sin desplazar: traer «Dejar de escuchar» a la vista empujaba la nota
    // fuera de la pantalla por arriba en una ventana de 600 px de alto, justo al
    // empezar a escuchar.
    if (document.activeElement === document.body) {
      document
        .querySelector<HTMLElement>('[data-mando-del-afinador]')
        ?.focus({ preventScroll: true });
    }
  }, [listening]);

  /**
   * Escuchando, lo que se mira va primero y lo demás se aparta.
   *
   * Estaba al revés: el botón de parar y el desplegable de entrada iban arriba, y
   * la nota y la aguja salían debajo de los dos. (El desplegable ya no está: el
   * micro se elige en la barra, para todas las pantallas.) Se afina **a un metro y con las
   * dos manos ocupadas** —lo dice la guía de estilo de este proyecto— y lo que se
   * mira así es una nota y una aguja, no un `<select>`.
   *
   * Los controles no desaparecen: bajan. Se tocan una vez al empezar, como el
   * selector de afinación, y desde ahí solo estorban.
   */
  return (
    <Panel id="afinador" title="Afinador" rotuloOculto>
      {listening === 'listening' ? (
        <>
          <Listening />

          <div className="border-border mt-6 flex flex-wrap items-end gap-4 border-t pt-4">
            <Button
              variant="quiet"
              data-mando-del-afinador
              onClick={() => {
                devolverElFoco.current = true;
                void stop();
              }}
            >
              Dejar de escuchar
            </Button>
          </div>
        </>
      ) : (
        <Stopped
          listening={listening}
          message={message}
          onStart={() => {
            devolverElFoco.current = true;
            void start();
          }}
        />
      )}

      <AvisoEnVivo />
    </Panel>
  );
}

/**
 * Región viva con el aviso resumido. Solo cambia cuando cambia la nota o el
 * estado: anunciar cada cent sería inservible.
 *
 * **Y por eso lee una cadena y no la lectura**: la frase es la misma mientras
 * la nota y el consejo no cambien, y una cadena igual no repinta, como en
 * `MicButton`. Leyendo la lectura se repintaba con cada cent.
 */
function AvisoEnVivo() {
  const aviso = useSessionStore((state) =>
    state.listening === 'listening' ? readingAnnouncement(state.reading) : '',
  );
  return (
    <p aria-live="polite" className="sr-only">
      {aviso}
    </p>
  );
}

function Stopped({
  listening,
  message,
  onStart,
}: {
  readonly listening: ListeningState;
  readonly message: string | null;
  readonly onStart: () => void;
}) {
  const blocked = listening === 'unsupported';

  return (
    // **Apagado mide lo que dice.** Llegó a ocupar todo el alto de la ventana
    // para que no fuera una tarjeta suelta en medio del negro, y a 1920 acabó en
    // 1300 × 740 para tres líneas. Lo que evita el hueco es que la pantalla lo
    // centre junto a la afinación (`TuneScreen`), no que crezca.
    <div className="flex flex-col justify-center">
      <Vacio
        icono={<IconoMicro />}
        titulo="Necesitamos oírte para afinarte"
        accion={
          // Pidiendo permiso **trabaja y no se apaga**: apagado soltaba el foco
          // justo después de pulsarlo. Sin micrófono que pedir sí se apaga, que
          // ahí nadie lo ha pulsado.
          <Button
            onClick={onStart}
            disabled={blocked}
            cargando={listening === 'requesting'}
            data-mando-del-afinador
          >
            <IconoMicro />
            {listening === 'requesting' ? 'Pidiendo permiso…' : 'Escuchar la guitarra'}
          </Button>
        }
      >
        Abrimos el micrófono, te decimos qué nota suena y cuánto le falta. El audio no sale de tu
        equipo: se analiza aquí y no se guarda.
      </Vacio>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-2 text-center">
          {message}
        </p>
      )}
    </div>
  );
}

/** Lo que se mira mientras se escucha. Es lo único que se repinta con el motor. */
function Listening() {
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  const clarity = useSessionStore((state) => state.clarity);
  const level = useSessionStore((state) => state.level);
  const tuningId = useSessionStore((state) => state.tuningId);
  const nota = reading !== null;

  // **Tres estados que no parpadean**, cada uno con un umbral para entrar y otro
  // para salir y un mínimo de segundo y medio ([adr/0061](../../../docs/adr/0061-el-afinador-no-se-mueve-mientras-escucha.md)).
  // El nivel rondaba el umbral y cambiaba de frase cada ~700 ms; la claridad
  // rondaba el 0,95 y avisaba de «no llega limpia» con una nota limpia delante.
  // El de enganchar usa los dos umbrales del propio motor, que ya son distintos
  // para eso: enganchar pide más que seguir.
  const oyendo = useEstable(
    level >= DEFAULT_PITCH_ENGINE_OPTIONS.rmsThreshold,
    level < DEFAULT_PITCH_ENGINE_OPTIONS.releaseRmsThreshold,
  );
  // Sucia **seguida**, no un instante: el ataque y la cola de una nota limpia
  // bajan la claridad un momento, y el aviso salía al lado de «Está afinada».
  const sucia = useEstable(
    hasSignal && isSignalDirty(clarity),
    isSignalClean(clarity),
    PERMANENCIA_MS,
    SUCIA_SEGUIDA_MS,
  );
  // Solo después de la primera nota: antes de ella no hay señal que se haya ido, y
  // «sin señal» se quedaría puesto segundo y medio sobre la primera que llegue.
  const sinSenal = useEstable(nota && !hasSignal, hasSignal);

  return (
    // **La zona de la nota se reserva desde el «esperando».** La tarjeta pasaba de
    // 320 a 645 píxeles al enganchar la primera nota, y «Dejar de escuchar», que
    // está debajo, saltaba justo cuando se iba a pulsar. En vez de escribir un alto
    // a mano —que se queda corto en un teléfono y largo en un monitor— se pinta
    // **la misma nota con huecos** debajo de la espera, invisible y fuera del
    // árbol de accesibilidad: mide lo que va a medir porque es lo mismo.
    <div className="mt-4 grid md:min-h-[min(40rem,calc(100dvh-30rem))]">
      <NotaYAguja
        reading={reading}
        tuningId={tuningId}
        hasSignal={hasSignal}
        level={level}
        aviso={
          sinSenal
            ? { texto: 'Sin señal. Vuelve a tocar la cuerda.', tono: 'apagado' }
            : sucia
              ? {
                  texto: 'La señal no llega limpia. Quita la distorsión y toca una sola cuerda.',
                  tono: 'alerta',
                }
              : !oyendo
                ? {
                    texto:
                      'Llega poca señal: sube el volumen de la guitarra o la ganancia de entrada.',
                    tono: 'alerta',
                  }
                : null
        }
      />
      {!nota && <Esperando oyendo={oyendo} level={level} />}
    </div>
  );
}

/**
 * Lo que se dice antes de la primera nota.
 *
 * Con señal entrando no se puede decir «esperando a que suene algo»: algo está
 * sonando, y el medidor de abajo lo está enseñando en la misma pantalla. Lo
 * honesto es decir que se oye y no se engancha, y por qué pasa casi siempre: **el
 * motor de tono es monofónico** (`docs/AUDIO-PITCH.md`), así que rasgueando no
 * saca ninguna nota. Decir cuándo duda es lo que hace esta aplicación en el resto
 * de sitios ([adr/0020](../../../docs/adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md)).
 *
 * **Es el único aviso de nivel**, y por eso el medidor ya no escribe el suyo: el
 * de «llega poca señal» y éste decían dos cosas a la vez sobre lo mismo.
 */
function Esperando({ oyendo, level }: { readonly oyendo: boolean; readonly level: number }) {
  return (
    <div className="col-start-1 row-start-1 flex flex-col gap-6 self-start">
      <div>
        {/* Cada frase reserva el alto de la más larga: en un teléfono «Te oigo…»
            ocupa dos líneas y «Esperando…» una, y la de debajo cuatro frente a dos
            (adr/0061). */}
        <p className="text-text-muted min-h-14 text-lg sm:min-h-7">
          {oyendo ? 'Te oigo, pero no engancho la nota…' : 'Esperando a que suene algo…'}
        </p>
        <p className="text-text-muted mt-2 min-h-24 sm:min-h-12">
          {oyendo
            ? 'Voy cuerda a cuerda y solo sé leer una nota cada vez: si estás rasgueando, toca una sola al aire y déjala sonar.'
            : 'Toca una cuerda al aire y deja que suene un momento. Si el medidor no se mueve, sube el volumen de la guitarra o la ganancia de entrada.'}
        </p>
      </div>
      <LevelMeter rms={level} />
    </div>
  );
}

/**
 * La nota, la aguja y lo que va debajo. Sin lectura es **la misma pieza con los
 * huecos vacíos**, invisible: solo sirve para que la tarjeta ya mida lo que va a
 * medir cuando llegue la primera nota.
 */
function NotaYAguja({
  reading,
  tuningId,
  hasSignal,
  level,
  aviso,
}: {
  readonly reading: PitchReading | null;
  readonly tuningId: TuningId;
  readonly hasSignal: boolean;
  readonly level: number;
  /** Un solo aviso, el de más prioridad: sin señal, luego suciedad, luego poca señal. */
  readonly aviso: { readonly texto: string; readonly tono: 'alerta' | 'apagado' } | null;
}) {
  const vacia = reading === null;
  const status = vacia ? 'afinada' : tuningStatus(reading.cents);
  const string = vacia ? null : nearestString(reading.midi, TUNINGS[tuningId].strings);
  const distance = vacia || string === null ? 0 : semitonesFromString(reading.midi, string);

  return (
    <div
      // `inert` además de `aria-hidden`: lo que no se ve tampoco recibe el foco.
      {...(vacia ? { 'aria-hidden': true, inert: true } : {})}
      className={`col-start-1 row-start-1 flex min-h-40 flex-col items-center transition-opacity ${
        vacia ? 'invisible' : hasSignal ? '' : 'opacity-40'
      }`}
    >
      <p className="flex items-baseline gap-3">
        <span
          // Ocho o nueve veces el cuerpo del texto. Es lo primero que se busca
          // al mirar la pantalla desde donde se está tocando.
          // `leading-none` porque un tamaño entre corchetes no trae su
          // interlineado: heredaba el 1,5 del cuerpo, y a 160 px la nota se
          // llevaba 240 de alto —ochenta de aire—. Y en ancho crece **con el
          // alto también** (`dvh`): un 1440 × 900 es ancho y bajo, y con la nota
          // a 160 «Dejar de escuchar» quedaba bajo el borde.
          className={`font-display text-8xl leading-none sm:text-9xl xl:text-[min(10rem,14dvh)] min-[112rem]:text-[min(13rem,19dvh)] ${status === 'afinada' ? 'text-tube-bright' : 'text-brass-bright'}`}
        >
          {vacia ? '—' : noteName(reading.pitchClass)}
          <span className="text-text-muted text-4xl">{vacia ? '' : reading.octave}</span>
        </span>
      </p>

      {/* **La instrucción es lo segundo más grande de la pantalla**, pegada a la
          nota, y la aguja debajo. Iba a 18 px en gris bajo una letra de 160, y
          en una ventana de 700 × 600 caía bajo el pliegue: lo que hay que hacer
          —aflojar o tensar— era lo más pequeño de lo que se mira de reojo
          mientras se gira la clavija. El dato —los cents— se queda abajo, para
          mirarlo parado.

          **Y sin señal, no se dice nada.** Al irse la señal quedaban «Sin señal»
          y «+36 cents · Suena alta: afloja» a la vez, y la segunda era de hace
          un rato: la nota se queda apagada, y la instrucción y los cents se
          vacían hasta que vuelva a sonar algo. */}
      <p
        className={`mt-2 text-3xl font-semibold sm:text-4xl ${
          status === 'afinada' ? 'text-tube-bright' : 'text-text'
        }`}
      >
        {vacia || !hasSignal ? NBSP : tuningAdvice(status)}
      </p>

      <div className="mt-5 flex w-full justify-center">
        <TuningMeter cents={vacia ? 0 : reading.cents} status={status} />
      </div>

      <p className="text-text-muted mt-4 font-mono">
        {vacia || !hasSignal
          ? NBSP
          : `${cifraConSigno(reading.cents, 1)} cents · ${cifra(reading.frequency, 1)} Hz`}
      </p>

      {/* Dos líneas en estrecho por lo mismo que el aviso: «2 semitonos por
          encima de la cuerda 6.ª» parte en dos en un teléfono y «Cuerda 6.ª al aire»
          no, y al cambiar de cuerda saltaba todo lo de debajo. */}
      <p className="text-text-muted mt-1 min-h-12 sm:min-h-6">
        {string === null
          ? NBSP
          : distance === 0
            ? `Cuerda ${string.number}.ª al aire (${string.label})`
            : // Sin «A» delante: «A 3 semitonos…» se leía como la nota La.
              `${Math.abs(distance)} ${Math.abs(distance) === 1 ? 'semitono' : 'semitonos'} ${
                distance > 0 ? 'por encima' : 'por debajo'
              } de la cuerda ${string.number}.ª (${string.label})`}
      </p>

      <div className="mt-4 w-full max-w-md">
        <LevelMeter rms={level} />
      </div>

      {/* **El hueco del aviso está siempre, haya aviso o no, y es uno solo.**
          Montándolo y desmontándolo, cada vez que la señal se ensuciaba o se iba
          todo lo de debajo daba un salto: medido, entre 0,19 y 0,31 de CLS en un
          rato de afinar. Y eran dos a la vez —el de nivel y el de suciedad—
          diciendo cosas distintas de la misma señal. Dos líneas en estrecho, que
          es lo que ocupa el aviso largo en un teléfono, y una a partir de `md`. */}
      <p
        className={`mt-3 min-h-12 md:min-h-6 ${aviso?.tono === 'alerta' ? 'text-brass' : 'text-text-muted'}`}
      >
        {vacia ? '' : (aviso?.texto ?? '')}
      </p>
    </div>
  );
}

/** Un espacio que no se parte: una línea vacía sin él mide cero. */
const NBSP = '\u00a0';
