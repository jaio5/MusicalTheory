'use client';

import { cifraConSigno } from '@core/cifras';
import { useState } from 'react';

import { useClaqueta } from '@state/claqueta';
import { useSessionStore } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';
import { mientrasTrabaja } from '@ui/Button';
import { IconoMicro, IconoMicroMudo } from '@ui/icons';

import { ElegirMicro } from './ElegirMicro';

export type MicButtonProps = ListeningDeps & {
  /**
   * Si la pastilla se anuncia. **No** donde otra pieza ya dice lo mismo con más
   * sentido: el afinador tiene su propia región viva, que habla cuando cambia la
   * nota o el consejo, y con las dos encendidas cada nota se oía dos veces —una
   * de ellas con los cents, que no paran quietos—.
   */
  readonly anuncia?: boolean;
};

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
export function MicButton({ anuncia = true, ...deps }: MicButtonProps = {}) {
  const listening = useSessionStore((state) => state.listening);
  const message = useSessionStore((state) => state.message);
  /*
    Lo que la pastilla escribe, ya escrito, y no la lectura entera.

    La lectura es un objeto nuevo cada cincuenta milisegundos, y el botón vive en
    la barra de todas las pantallas: suscrito a ella se repintaba veinte veces
    por segundo para escribir casi siempre lo mismo. Con el texto, React solo se
    entera cuando cambia la nota o el cent redondeado.
  */
  const nota = useSessionStore((state) =>
    state.reading === null ? null : `${state.reading.name}${state.reading.octave}`,
  );
  const cents = useSessionStore((state) =>
    state.reading === null ? null : `${cifraConSigno(state.reading.cents)}¢`,
  );
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
  // Solo el símbolo, por lo mismo que la nota: el acorde llega nuevo en cada
  // análisis aunque sea el mismo.
  const heardChord = useSessionStore((state) => state.heardChord?.symbol ?? null);
  const { start, stop } = useListening(deps);
  /*
    Si lo último que se pidió al micro salió de este botón.

    El porqué de un fallo se enseña **junto a lo que lo provocó**: si fue «Tocar»
    en componer, lo dice la toma; si fue el afinador, el afinador. Aquí solo lo de
    este botón, o el mismo fallo saldría dos veces en dos sitios.
  */
  const [pidioAqui, setPidioAqui] = useState(false);
  const fallo =
    pidioAqui && (listening === 'denied' || listening === 'error' || listening === 'unsupported')
      ? message
      : null;
  /*
    **Callado mientras hay toma** (adr/0072): con la claqueta sonando, lo que se
    toca es la canción, y un lector de pantalla que lee cada acorde y cada cent
    por encima tapa el clic con el que se lleva el tiempo. La pastilla se sigue
    viendo; lo que se calla es el anuncio.
  */
  const enLaToma = useClaqueta((estado) => estado.enLaToma);
  const habla = anuncia && !enLaToma;

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
  const hayNota = acorde === null && nota !== null && hasSignal;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* El botón y el mando de cuál, **pegados**: son el mismo aparato, como el
          micro y su flecha en cualquier videollamada. Sin hueco entre los dos
          porque cada uno ya mide sus 44 px y el sitio de la barra es caro. */}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          // Mientras el navegador pide permiso no hace caso, **pero no se apaga**:
          // apagado con el foco dentro, el foco caía al `<body>` justo después de
          // pulsarlo con Intro, y quien no ve la pantalla perdía el sitio.
          {...mientrasTrabaja(busy, () => {
            setPidioAqui(!isListening);
            void (isListening ? stop() : start());
          })}
          aria-pressed={isListening}
          aria-label={isListening ? 'Dejar de escuchar la guitarra' : 'Escuchar la guitarra'}
          title={isListening ? 'Dejar de escuchar' : 'Escuchar la guitarra'}
          className={`size-tap relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 active:scale-95 aria-disabled:cursor-progress aria-disabled:opacity-50 aria-disabled:active:scale-100 ${
            isListening
              ? 'border-tube-bright bg-tube/25 text-tube-bright'
              : 'border-border bg-surface text-text-muted not-aria-disabled:hover:border-brass not-aria-disabled:hover:text-brass-bright'
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
        <ElegirMicro fallo={fallo} />
      </div>

      {/* Vive dentro de un `aria-live` para que quien no ve la pantalla se entere
          de la nota igual que quien la ve: es la respuesta a haber tocado. Se
          apaga con `off` y no desmontándola, para que al volver a hablar la
          región ya estuviera ahí: una que nace con el texto dentro no se lee. */}
      <span aria-live={habla ? 'polite' : 'off'} className="flex min-w-0 items-center gap-2">
        {/* `data-lectura` es lo que mira la barra para callar el nombre de la
            marca mientras hay pastilla (`AppShell`): sin eso, a 390 la pastilla
            se metía debajo del botón del tema. */}
        {(isListening || busy) && (
          <span
            data-lectura
            className={`border-border bg-surface-raised inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
              hasSignal ? '' : 'opacity-70'
            }`}
          >
            {/* **Con sitio guardado**, para que cambiar de acorde no mueva la barra:
                la pastilla va pegada a la derecha, y de «C» a «Bbmaj7» crecía y
                empujaba el botón del micro a un lado y a otro a cada cambio. Seis
                caracteres es el cifrado más largo que se oye a menudo (`Bbmaj7`),
                y en monoespaciada seis caracteres miden lo mismo siempre. */}
            <span
              className={`inline-block min-w-[6ch] font-mono text-base tabular-nums ${
                hayNota || acorde !== null ? 'text-brass-bright' : 'text-text-muted'
              }`}
            >
              {hayNota ? nota : (acorde ?? '—')}
            </span>
            {/* **El rótulo se calla donde no cabe**: por debajo de 26 rem de
                barra —medidos en la barra, para que la letra grande también
                cuente— y entre 768 y 1023, donde sube la navegación entera. Con
                la cuenta configurada y el mando de elegir micro al lado, la
                pastilla entera pide 410 px de barra, y a 390 pisaba el tema 36.
                Callado y no quitado: sigue en la región viva, así que quien no
                ve la pantalla oye «esperando» igual. «pidiendo permiso» es el
                más largo y se calla antes, hasta 30 rem. */}
            {/* Lo mismo el rótulo: «esperando», «acorde» y «+12¢» guardan el sitio
                del más largo de los tres. */}
            <span
              className={`text-text-muted barra-arriba:max-lg:sr-only inline-block min-w-[9ch] font-mono text-xs whitespace-nowrap tabular-nums @max-[26rem]:sr-only ${
                busy ? '@max-[30rem]:sr-only' : ''
              }`}
            >
              {hayNota
                ? cents
                : acorde !== null
                  ? 'acorde'
                  : busy
                    ? 'pidiendo permiso'
                    : 'esperando'}
            </span>
          </span>
        )}
      </span>
    </div>
  );
}
