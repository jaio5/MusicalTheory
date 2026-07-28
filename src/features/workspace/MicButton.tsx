'use client';

import { useSessionStore } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';

export type MicButtonProps = ListeningDeps;

/**
 * El botón de escuchar, redondo y grande, como el de grabar de la cámara del
 * móvil: se entiende sin leer nada.
 *
 * Lleva dentro la nota que suena, porque es el mismo objeto —escuchar y lo que
 * se oye— y así ocupa un sitio en vez de dos.
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
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void (isListening ? stop() : start())}
        disabled={busy}
        aria-pressed={isListening}
        aria-label={isListening ? 'Dejar de escuchar la guitarra' : 'Escuchar la guitarra'}
        title={isListening ? 'Dejar de escuchar' : 'Escuchar la guitarra'}
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isListening
            ? 'border-oxblood-bright bg-oxblood'
            : 'border-border bg-surface hover:border-brass'
        } disabled:opacity-50`}
      >
        {/* Un círculo relleno dentro de un aro, como el botón de grabar. */}
        <span
          aria-hidden="true"
          className={`block rounded-full transition-all ${
            isListening ? 'bg-oxblood-bright h-3.5 w-3.5 rounded-sm' : 'bg-brass h-6 w-6'
          }`}
        />
        {isListening && (
          <span
            aria-hidden="true"
            className="border-oxblood-bright absolute inset-0 animate-ping rounded-full border opacity-40"
          />
        )}
      </button>

      <span className="flex min-w-24 flex-col leading-tight">
        <span
          className={`font-mono text-lg tabular-nums ${
            hasSignal ? 'text-brass-bright' : 'text-text-muted'
          }`}
        >
          {reading === null ? '—' : `${reading.name}${reading.octave}`}
        </span>
        <span className="text-text-muted font-mono text-[10px] tabular-nums">
          {reading === null || !hasSignal
            ? busy
              ? 'pidiendo permiso'
              : isListening
                ? 'esperando'
                : 'sin escuchar'
            : `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(0)} cents`}
        </span>
      </span>

      {message !== null && (
        <span role="alert" className="text-oxblood-bright max-w-56 text-xs">
          {message}
        </span>
      )}
    </div>
  );
}
