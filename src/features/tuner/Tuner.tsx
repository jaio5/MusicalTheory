'use client';

import { nearestString, semitonesFromString, TUNINGS, type TuningId } from '@core/instrument';
import { noteName, type PitchReading } from '@core/music';
import { Button } from '@ui/Button';
import { Field } from '@ui/Field';
import { Panel } from '@ui/Panel';
import { useSessionStore, type ListeningState } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';

import { useEffect, useState } from 'react';

import { listAudioInputDevices } from '@audio/web-audio-input';

import { LevelMeter } from './LevelMeter';
import { TuningMeter } from './TuningMeter';
import { isSignalClean, readingAnnouncement, tuningAdvice, tuningStatus } from './tuning';

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
    <Panel id="afinador" title="Afinador">
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
                label="Entrada"
                compact
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
    <div className="mt-6">
      <p className="text-text-muted">
        Necesitamos el micrófono para escuchar la guitarra y decirte qué nota suena. El audio no
        sale de tu equipo.
      </p>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {message}
        </p>
      )}

      <div className="mt-6">
        <Button onClick={onStart} disabled={blocked || listening === 'requesting'}>
          {listening === 'requesting' ? 'Pidiendo permiso…' : 'Escuchar la guitarra'}
        </Button>
      </div>
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
  // Solo antes de la primera nota. En cuanto suena algo, el afinador se queda
  // en pantalla: al callar se apaga, no desaparece.
  if (reading === null) {
    return (
      <div className="mt-6 flex min-h-40 flex-col justify-center gap-6">
        <div>
          <p className="text-text-muted font-mono text-lg">Esperando a que suene algo…</p>
          <p className="text-text-muted mt-2 text-sm">
            Toca una cuerda al aire y deja que suene un momento.
          </p>
        </div>
        <LevelMeter rms={level} />
      </div>
    );
  }

  const status = tuningStatus(reading.cents);
  const string = nearestString(reading.midi, TUNINGS[tuningId].strings);
  const distance = semitonesFromString(reading.midi, string);

  return (
    <div
      className={`mt-6 flex min-h-40 flex-col items-center transition-opacity ${
        hasSignal ? '' : 'opacity-40'
      }`}
    >
      <p className="flex items-baseline gap-3">
        <span
          // Ocho o nueve veces el cuerpo del texto. Es lo primero que se busca
          // al mirar la pantalla desde donde se está tocando.
          className={`font-display text-8xl sm:text-9xl ${status === 'afinada' ? 'text-tube-bright' : 'text-brass-bright'}`}
        >
          {noteName(reading.pitchClass)}
          <span className="text-text-muted text-4xl">{reading.octave}</span>
        </span>
      </p>

      {/* La aguja pegada a la nota, y el consejo debajo. Son las tres cosas que
          se leen de reojo mientras se gira la clavija; el resto son datos que se
          miran parados. */}
      <div className="mt-5 flex w-full justify-center">
        <TuningMeter cents={reading.cents} status={status} />
      </div>

      <p className={`mt-4 text-lg ${status === 'afinada' ? 'text-tube-bright' : 'text-text'}`}>
        {tuningAdvice(status)}
      </p>

      <p className="text-text-muted mt-4 font-mono text-sm">
        {reading.cents > 0 ? '+' : ''}
        {reading.cents.toFixed(1)} cents · {reading.frequency.toFixed(1)} Hz
      </p>

      <p className="text-text-muted mt-1 text-sm">
        {distance === 0
          ? `Cuerda ${string.number}.ª al aire (${string.label})`
          : `A ${Math.abs(distance)} ${Math.abs(distance) === 1 ? 'semitono' : 'semitonos'} ${
              distance > 0 ? 'por encima' : 'por debajo'
            } de la ${string.number}.ª (${string.label})`}
      </p>

      <div className="mt-6 w-full max-w-md">
        <LevelMeter rms={level} />
      </div>

      {hasSignal ? (
        !isSignalClean(clarity) && (
          <p className="text-brass mt-4 text-sm">
            La señal no llega limpia. Quita la distorsión y toca una sola cuerda.
          </p>
        )
      ) : (
        <p className="text-text-muted mt-4 font-mono text-sm">
          Sin señal. Vuelve a tocar la cuerda.
        </p>
      )}
    </div>
  );
}
