'use client';

import { useEffect, useRef, useState } from 'react';
import { Chip } from '@ui/Chip';
import { IconoParar, IconoSonar } from '@ui/icons';
import { Field } from '@ui/Field';

import { WebAudioMetronome, type Metronome as MetronomeEngine } from '@audio/metronome';
import { BEATS_PER_BAR, bpmFromTaps, clampBpm, MAX_BPM, MIN_BPM } from '@core/music';
import { selectActions, useSessionStore } from '@state/session-store';

export interface MetronomeProps {
  /** Para poder probarlo sin audio de verdad. */
  readonly createMetronome?: () => MetronomeEngine;
}

/**
 * El metrónomo: pulso a la velocidad que elijas.
 *
 * El tempo se puede escribir, ajustar de dos en dos o marcar con el dedo, que
 * es como se saca de verdad el tempo de una canción que suena en la cabeza.
 */
export function Metronome({ createMetronome }: MetronomeProps = {}) {
  // El tempo vive en el store y no aquí dentro. Lo necesita también la captura
  // —para medir cuántos pulsos dura cada acorde que se toca— y un feature no
  // importa de otro, así que sube a `state/`. De paso deja de perderse al
  // cambiar de pantalla.
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const actions = useSessionStore(selectActions);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  /**
   * Lo que hay escrito en el campo mientras se escribe, que **no siempre es un
   * tempo**.
   *
   * Sin esto el campo no se podía teclear. Iba pegado al store y cada pulsación
   * pasaba por `clampBpm`: al borrarlo saltaba a 30 —el mínimo—, y el siguiente
   * dígito se escribía detrás, así que «130» se tecleaba como «301» y quedaba en
   * 300. Cualquier tempo que no salga de los botones era inalcanzable.
   *
   * Un «1» a medio escribir no es un tempo de 1: es un tempo sin terminar. Así
   * que mientras se escribe manda el texto, al store solo sube lo que ya cabe en
   * el rango, y al salir del campo se acota y se normaliza. Nulo quiere decir
   * «nadie está escribiendo»: entonces lo que se ve es el tempo de verdad, y por
   * eso `change` lo devuelve a nulo —si no, pulsar «+» no movería el número.
   */
  const [escrito, setEscrito] = useState<string | null>(null);

  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapsRef = useRef<number[]>([]);
  const factoryRef = useRef(createMetronome);
  useEffect(() => {
    factoryRef.current = createMetronome;
  });

  // Al salir de la pantalla se calla. Sin esto seguiría sonando en una pestaña
  // que ya no estás mirando.
  useEffect(() => {
    return () => {
      void engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  function engine(): MetronomeEngine {
    engineRef.current ??= factoryRef.current?.() ?? new WebAudioMetronome();
    return engineRef.current;
  }

  async function toggle(): Promise<void> {
    if (running) {
      engine().stop();
      setRunning(false);
      setBeat(0);
      return;
    }
    await engine().start({ bpm, beatsPerBar, onBeat: setBeat });
    setRunning(true);
  }

  function change(next: number): void {
    const value = clampBpm(next);
    setEscrito(null);
    actions.setTempo(value, beatsPerBar);
    engineRef.current?.setBpm(value);
  }

  /** Lo que se teclea: al store solo sube lo que ya es un tempo. */
  function tecleando(texto: string): void {
    setEscrito(texto);
    const numero = Number(texto);
    if (texto.trim() !== '' && Number.isFinite(numero) && numero === clampBpm(numero)) {
      actions.setTempo(numero, beatsPerBar);
      engineRef.current?.setBpm(numero);
    }
  }

  /** Al salir del campo se acota lo que quedara a medias, o se deja como estaba. */
  function terminarDeEscribir(): void {
    const numero = Number(escrito);
    if (escrito !== null && escrito.trim() !== '' && Number.isFinite(numero)) {
      change(numero);
      return;
    }
    setEscrito(null);
  }

  function tap(): void {
    const now = performance.now();
    tapsRef.current = [...tapsRef.current.slice(-7), now];
    const tapped = bpmFromTaps(tapsRef.current);
    if (tapped !== null) {
      change(tapped);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void toggle()}
          aria-pressed={running}
          aria-label={running ? 'Parar el metrónomo' : 'Poner el metrónomo'}
          className={`size-tap flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
            running
              ? 'border-brass-bright text-brass-bright'
              : 'border-border text-text-muted hover:border-brass'
          }`}
        >
          {/* El cuadrado y el triángulo son los de cualquier aparato desde hace
              cincuenta años, pero dibujados: escritos como caracteres, `■` y `▶`
              los pinta cada sistema a su manera y a su tamaño, que es lo mismo
              que ya se dijo de los emoji. */}
          {running ? <IconoParar /> : <IconoSonar />}
        </button>

        <label className="flex items-center gap-1">
          <span className="sr-only">Pulsos por minuto</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={escrito ?? bpm}
            onChange={(event) => tecleando(event.target.value)}
            onBlur={terminarDeEscribir}
            // Enter cierra lo escrito sin tener que salir del campo, que es lo
            // que hace cualquiera al terminar de poner un tempo.
            onKeyDown={(event) => event.key === 'Enter' && terminarDeEscribir()}
            className="border-border bg-surface text-text focus:border-brass-dim min-h-tap w-16 rounded-md border px-2 text-center font-mono text-lg tabular-nums"
          />
          <span className="text-text-muted font-mono text-xs">bpm</span>
        </label>

        <div className="flex gap-1">
          <Chip onClick={() => change(bpm - 2)} ariaLabel="Dos pulsos menos" tone="quiet">
            −
          </Chip>
          <Chip onClick={() => change(bpm + 2)} ariaLabel="Dos pulsos más" tone="quiet">
            +
          </Chip>
        </div>
      </div>

      {/*
        Escondidos por debajo de 640, y **no es que sobren**: en un teléfono no hay
        manera de salir del 4/4, y la partitura escribe el compás en grande al
        principio del pentagrama.

        Se probó a sacar el selector de compás y sale caro: en un móvil la
        cabecera gana una fila de cuarenta y pico píxeles, y entonces **el panel
        de la rueda deja de caber** —acaba en 538 con el marco cortando en 503— y
        la sonda lo marca como inalcanzable. El marco de la aplicación no
        desplaza, así que lo que no cabe se pierde.

        Sacarlo pide antes que esta cabecera no crezca hacia abajo en estrecho
        —desplazarse a lo largo, como ya hace la barra del lienzo—, y eso mueve el
        conmutador Tocar/Montar fuera de la vista, que es otra decisión.
      */}
      <div className="hidden items-center gap-2 sm:flex">
        <Chip onClick={tap} tone="quiet">
          Marcar
        </Chip>

        <Field
          label="Compás"
          ancho="auto"
          className="pr-8 pl-2 font-mono"
          value={beatsPerBar}
          onChange={(event) => {
            const value = Number(event.target.value);
            actions.setTempo(bpm, value);
            if (running) {
              void engine().start({ bpm, beatsPerBar: value, onBeat: setBeat });
            }
          }}
        >
          {BEATS_PER_BAR.map((beats) => (
            <option key={beats} value={beats}>
              {beats}
            </option>
          ))}
        </Field>

        {/* La luz del pulso: quien toca con auriculares puestos o con el ampli
            alto necesita verlo además de oírlo. */}
        <ol aria-hidden="true" className="flex gap-1">
          {Array.from({ length: beatsPerBar }, (_, index) => (
            <li
              key={index}
              className={`block h-2 w-2 rounded-full ${
                running && index === beat
                  ? index === 0
                    ? 'bg-brass-bright'
                    : 'bg-text-muted'
                  : 'bg-border'
              }`}
            />
          ))}
        </ol>
        <span className="sr-only" aria-live="off">
          {running ? `Metrónomo a ${bpm} pulsos por minuto` : 'Metrónomo parado'}
        </span>
      </div>
    </div>
  );
}
