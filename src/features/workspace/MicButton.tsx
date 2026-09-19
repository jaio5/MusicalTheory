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
  /*
    El acorde que se oye, para no decir «esperando» mientras se está oyendo algo.

    El motor de tono es monofónico: rasgueando no engancha ninguna nota, así que
    la pastilla se quedaba en «— esperando» con el micro en verde y la aplicación
    apuntando acordes en la canción. Dice lo contrario de lo que está pasando, y
    va dentro de un `aria-live`: a quien no ve la pantalla se le anunciaba que no
    llegaba nada justo mientras llegaba.

    Solo lo hay donde se escuchan acordes —componer—; en el resto sigue null y la
    pastilla se comporta igual que siempre.
  */
  const heardChord = useSessionStore((state) => state.heardChord);
  const { start, stop } = useListening(deps);

  const isListening = listening === 'listening';
  const busy = listening === 'requesting';
  /*
    Manda el acorde donde se escuchan acordes, y la nota donde no.
    
    Rasgueando, el motor de tono engancha cualquier parcial grave: con un Fa
    sonando decía «G2 +4¢», que es tan poco cierto como «esperando». Donde hay
    acordes que reconocer, el acorde es la respuesta a lo que acabas de tocar; y
    donde no —el afinador, una unidad de tocar—, `heardChord` es nulo y la nota
    vuelve a mandar ella sola.
  */
  const acorde = heardChord;
  const hayNota = acorde === null && reading !== null && hasSignal;

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
                hayNota || acorde !== null ? 'text-brass-bright' : 'text-text-muted'
              }`}
            >
              {hayNota ? `${reading.name}${reading.octave}` : (acorde?.symbol ?? '—')}
            </span>
            <span className="text-text-muted font-mono text-xs whitespace-nowrap tabular-nums">
              {hayNota
                ? `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(0)}¢`
                : acorde !== null
                  ? 'acorde'
                  : busy
                    ? 'pidiendo permiso'
                    : 'esperando'}
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
