'use client';

import type { PitchReading } from '@core/music';
import { Button } from '@ui/Button';
import { useSessionStore, type ListeningState } from '@state/session-store';

import { TuningMeter } from './TuningMeter';
import {
  displayNames,
  isSignalClean,
  nearestString,
  readingAnnouncement,
  semitonesFromString,
  tuningAdvice,
  tuningStatus,
} from './tuning';
import { useTuner, type TunerDeps } from './use-tuner';

export type TunerProps = TunerDeps;

export function Tuner(deps: TunerProps = {}) {
  const listening = useSessionStore((state) => state.listening);
  const message = useSessionStore((state) => state.message);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  const clarity = useSessionStore((state) => state.clarity);
  const { start, stop } = useTuner(deps);

  return (
    <section aria-labelledby="afinador" className="border-border bg-surface rounded-lg border p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="afinador" className="font-display text-text text-2xl">
          Afinador
        </h2>
        {listening === 'listening' && (
          <Button variant="quiet" onClick={() => void stop()}>
            Dejar de escuchar
          </Button>
        )}
      </div>

      {listening === 'listening' ? (
        <Listening reading={reading} hasSignal={hasSignal} clarity={clarity} />
      ) : (
        <Stopped listening={listening} message={message} onStart={() => void start()} />
      )}

      {/* Región viva con el aviso resumido. Solo cambia cuando cambia la nota o
          el estado: anunciar cada cent sería inservible. */}
      <p aria-live="polite" className="sr-only">
        {listening === 'listening' ? readingAnnouncement(reading) : ''}
      </p>
    </section>
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
}: {
  readonly reading: PitchReading | null;
  readonly hasSignal: boolean;
  readonly clarity: number;
}) {
  // Solo antes de la primera nota. En cuanto suena algo, el afinador se queda
  // en pantalla: al callar se apaga, no desaparece.
  if (reading === null) {
    return (
      <div className="mt-6 flex min-h-40 flex-col justify-center">
        <p className="text-text-muted font-mono text-lg">Esperando a que suene algo…</p>
        <p className="text-text-muted mt-2 text-sm">
          Toca una cuerda al aire y deja que suene un momento.
        </p>
      </div>
    );
  }

  const status = tuningStatus(reading.cents);
  const names = displayNames(reading);
  const string = nearestString(reading.midi);
  const distance = semitonesFromString(reading.midi, string);

  return (
    <div
      className={`mt-6 flex min-h-40 flex-col items-center transition-opacity ${
        hasSignal ? '' : 'opacity-40'
      }`}
    >
      <p className="flex items-baseline gap-3">
        <span
          className={`font-display text-7xl ${status === 'afinada' ? 'text-tube-bright' : 'text-brass-bright'}`}
        >
          {names.spanish}
          <span className="text-text-muted text-3xl">{reading.octave}</span>
        </span>
        <span className="text-text-muted font-mono text-lg">{names.english}</span>
      </p>

      <p className="text-text mt-2 font-mono text-sm">
        {reading.cents > 0 ? '+' : ''}
        {reading.cents.toFixed(1)} cents · {reading.frequency.toFixed(1)} Hz
      </p>

      <div className="mt-6 flex w-full justify-center">
        <TuningMeter cents={reading.cents} status={status} />
      </div>

      <p className={`mt-4 ${status === 'afinada' ? 'text-tube-bright' : 'text-text'}`}>
        {tuningAdvice(status)}
      </p>

      <p className="text-text-muted mt-2 text-sm">
        {distance === 0
          ? `Cuerda ${string.number}.ª al aire (${string.label})`
          : `A ${Math.abs(distance)} ${Math.abs(distance) === 1 ? 'semitono' : 'semitonos'} ${
              distance > 0 ? 'por encima' : 'por debajo'
            } de la ${string.number}.ª (${string.label})`}
      </p>

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
