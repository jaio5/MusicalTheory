'use client';

import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';
import { nearestString, semitonesFromString, TUNINGS, type TuningId } from '@core/instrument';
import { noteName, type PitchReading } from '@core/music';
import { Button } from '@ui/Button';
import { IconoMicro } from '@ui/icons';
import { Vacio } from '@ui/Vacio';
import { Field } from '@ui/Field';
import { Panel } from '@ui/Panel';
import { useSessionStore, type ListeningState } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';

import { useEffect, useState } from 'react';

import { listAudioInputDevices } from '@audio/web-audio-input';

import { LevelMeter } from './LevelMeter';
import { TuningMeter } from './TuningMeter';
import { useEstable } from './use-estable';
import {
  isSignalClean,
  isSignalDirty,
  readingAnnouncement,
  tuningAdvice,
  tuningStatus,
} from './tuning';

export type TunerProps = ListeningDeps;

export function Tuner(deps: TunerProps = {}) {
  const listening = useSessionStore((state) => state.listening);
  const message = useSessionStore((state) => state.message);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  const clarity = useSessionStore((state) => state.clarity);
  const level = useSessionStore((state) => state.level);
  const tuningId = useSessionStore((state) => state.tuningId);
  const { start, stop } = useListening(deps);

  const [devices, setDevices] = useState<readonly MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');

  // Los nombres de las entradas solo llegan con el permiso ya concedido, así
  // que la lista se pide cuando ya estamos escuchando.
  useEffect(() => {
    if (listening !== 'listening') {
      return;
    }
    let cancelled = false;
    void listAudioInputDevices().then((found) => {
      /* v8 ignore next 3 -- la lista llega antes de que nadie cierre la pantalla; la bandera es por si no */
      if (!cancelled) {
        setDevices(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [listening]);

  async function switchDevice(next: string) {
    setDeviceId(next);
    await stop();
    await start(next === '' ? undefined : next);
  }

  /**
   * Escuchando, lo que se mira va primero y lo demás se aparta.
   *
   * Estaba al revés: el botón de parar y el desplegable de entrada iban arriba, y
   * la nota y la aguja salían debajo de los dos. Se afina **a un metro y con las
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
          <Listening
            reading={reading}
            hasSignal={hasSignal}
            clarity={clarity}
            level={level}
            tuningId={tuningId}
          />

          <div className="border-border mt-8 flex flex-wrap items-end gap-4 border-t pt-4">
            <Button variant="quiet" onClick={() => void stop()}>
              Dejar de escuchar
            </Button>
            {devices.length > 1 && (
              <Field
                // A la vista: «La del sistema» solo no dice de qué es la lista.
                label="Micrófono"
                value={deviceId}
                onChange={(event) => void switchDevice(event.target.value)}
              >
                <option value="">La del sistema</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label === '' ? 'Entrada sin nombre' : device.label}
                  </option>
                ))}
              </Field>
            )}
          </div>
        </>
      ) : (
        <Stopped listening={listening} message={message} onStart={() => void start()} />
      )}

      {/* Región viva con el aviso resumido. Solo cambia cuando cambia la nota o
          el estado: anunciar cada cent sería inservible. */}
      <p aria-live="polite" className="sr-only">
        {listening === 'listening' ? readingAnnouncement(reading) : ''}
      </p>
    </Panel>
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
    // **El hueco del instrumento**, y no el de un aviso: en un escritorio el
    // afinador ocupa todo el alto que deje la ventana —con suelo y techo—, y
    // apagado se centra dentro. Era una tarjeta de 360 px en medio de 800 de
    // negro. En un teléfono no tiene alto propio: ahí manda la pantalla.
    <div className="flex flex-col justify-center md:min-h-[min(44rem,calc(100dvh-14rem))]">
      <Vacio
        icono={<IconoMicro />}
        titulo="Necesitamos oírte para afinarte"
        accion={
          <Button onClick={onStart} disabled={blocked || listening === 'requesting'}>
            <IconoMicro />
            {listening === 'requesting' ? 'Pidiendo permiso…' : 'Escuchar la guitarra'}
          </Button>
        }
      >
        Abrimos el micrófono, te decimos qué nota suena y cuánto le falta. El audio no sale de tu
        equipo: se analiza aquí y no se guarda.
      </Vacio>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-2 text-center text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

function Listening({
  reading,
  hasSignal,
  clarity,
  level,
  tuningId,
}: {
  readonly reading: PitchReading | null;
  readonly hasSignal: boolean;
  readonly clarity: number;
  readonly level: number;
  readonly tuningId: TuningId;
}) {
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
  const sucia = useEstable(hasSignal && isSignalDirty(clarity), isSignalClean(clarity));
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
    <div className="mt-6 grid md:min-h-[min(40rem,calc(100dvh-20rem))]">
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
        <p className="text-text-muted mt-2 min-h-20 text-sm sm:min-h-10">
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
          className={`font-display text-8xl sm:text-9xl xl:text-[10rem] min-[112rem]:text-[13rem] ${status === 'afinada' ? 'text-tube-bright' : 'text-brass-bright'}`}
        >
          {vacia ? '—' : noteName(reading.pitchClass)}
          <span className="text-text-muted text-4xl">{vacia ? '' : reading.octave}</span>
        </span>
      </p>

      {/* La aguja pegada a la nota, y el consejo debajo. Son las tres cosas que
          se leen de reojo mientras se gira la clavija; el resto son datos que se
          miran parados. */}
      <div className="mt-5 flex w-full justify-center">
        <TuningMeter cents={vacia ? 0 : reading.cents} status={status} />
      </div>

      <p className={`mt-4 text-lg ${status === 'afinada' ? 'text-tube-bright' : 'text-text'}`}>
        {vacia ? NBSP : tuningAdvice(status)}
      </p>

      <p className="text-text-muted mt-4 text-sm">
        {vacia
          ? NBSP
          : `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(1)} cents · ${reading.frequency.toFixed(1)} Hz`}
      </p>

      {/* Dos líneas en estrecho por lo mismo que el aviso: «A 2 semitonos por
          encima de la 6.ª» parte en dos en un teléfono y «Cuerda 6.ª al aire»
          no, y al cambiar de cuerda saltaba todo lo de debajo. */}
      <p className="text-text-muted mt-1 min-h-10 text-sm sm:min-h-5">
        {string === null
          ? NBSP
          : distance === 0
            ? `Cuerda ${string.number}.ª al aire (${string.label})`
            : `A ${Math.abs(distance)} ${Math.abs(distance) === 1 ? 'semitono' : 'semitonos'} ${
                distance > 0 ? 'por encima' : 'por debajo'
              } de la ${string.number}.ª (${string.label})`}
      </p>

      <div className="mt-6 w-full max-w-md">
        <LevelMeter rms={level} />
      </div>

      {/* **El hueco del aviso está siempre, haya aviso o no, y es uno solo.**
          Montándolo y desmontándolo, cada vez que la señal se ensuciaba o se iba
          todo lo de debajo daba un salto: medido, entre 0,19 y 0,31 de CLS en un
          rato de afinar. Y eran dos a la vez —el de nivel y el de suciedad—
          diciendo cosas distintas de la misma señal. Dos líneas en estrecho, que
          es lo que ocupa el aviso largo en un teléfono, y una a partir de `md`. */}
      <p
        className={`mt-4 min-h-10 text-sm md:min-h-5 ${aviso?.tono === 'alerta' ? 'text-brass' : 'text-text-muted'}`}
      >
        {vacia ? '' : (aviso?.texto ?? '')}
      </p>
    </div>
  );
}

/** Un espacio que no se parte: una línea vacía sin él mide cero. */
const NBSP = '\u00a0';
