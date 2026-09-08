'use client';

import { useSessionStore } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';
import { IconoMicro, IconoMicroMudo } from '@ui/icons';

export type MicButtonProps = ListeningDeps;

/**
 * El botón de escuchar, y la nota que suena a su lado.
 *
 * Es lo primero de la barra porque es lo que enciende media aplicación: sin
 * micro no hay afinador, ni acordes reconocidos, ni escala validada.
 *
 * **La lectura solo ocupa sitio cuando dice algo.** Antes había un hueco fijo de
 * seis caracteres con un guion y el rótulo «sin escuchar» debajo, en la esquina
 * más cara de la pantalla y **siempre**, aunque no hubiera nada que leer: en la
 * cabecera de una aplicación que se usa con la guitarra puesta, la mitad
 * izquierda estaba reservada a decir que no pasaba nada. Ahora, apagado, es un
 * botón; encendido, aparece la pastilla con la nota y los cents, que es cuando
 * eso importa.
 */
export function MicButton(deps: MicButtonProps = {}) {
  const listening = useSessionStore((state) => state.listening);
  const message = useSessionStore((state) => state.message);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  const { start, stop } = useListening(deps);

  const isListening = listening === 'listening';
  const busy = listening === 'requesting';

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => void (isListening ? stop() : start())}
        disabled={busy}
        aria-pressed={isListening}
        aria-label={isListening ? 'Dejar de escuchar la guitarra' : 'Escuchar la guitarra'}
        title={isListening ? 'Dejar de escuchar' : 'Escuchar la guitarra'}
        className={`size-tap relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
          isListening
            ? 'border-tube-bright bg-tube/25 text-tube-bright'
            : 'border-border bg-surface text-text-muted hover:border-brass hover:text-brass-bright'
        }`}
      >
        <span data-senal className="flex">
          {isListening ? <IconoMicro /> : <IconoMicroMudo />}
        </span>
        {isListening && (
          <span
            aria-hidden="true"
            className="border-tube-bright absolute inset-0 animate-ping rounded-full border opacity-30"
          />
        )}
      </button>

      {/* Vive dentro de un `aria-live` para que quien no ve la pantalla se entere
          de la nota igual que quien la ve: es la respuesta a haber tocado. */}
      <span aria-live="polite" className="flex min-w-0 items-center gap-2">
        {(isListening || busy) && (
          <span
            className={`border-border bg-surface-raised inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
              hasSignal ? '' : 'opacity-70'
            }`}
          >
            <span
              className={`font-mono text-base tabular-nums ${
                hasSignal ? 'text-brass-bright' : 'text-text-muted'
              }`}
            >
              {reading === null || !hasSignal ? '—' : `${reading.name}${reading.octave}`}
            </span>
            <span className="text-text-muted font-mono text-xs whitespace-nowrap tabular-nums">
              {reading === null || !hasSignal
                ? busy
                  ? 'pidiendo permiso'
                  : 'esperando'
                : `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(0)}¢`}
            </span>
          </span>
        )}
      </span>

      {message !== null && (
        <span role="alert" className="text-oxblood-bright hidden max-w-56 text-xs md:inline">
          {message}
        </span>
      )}
    </div>
  );
}
