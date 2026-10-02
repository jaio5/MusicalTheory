'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Chip } from '@ui/Chip';
import { IconoParar, IconoSonar } from '@ui/icons';
import { Field } from '@ui/Field';
import { cerrarAlSalirElFoco } from '@ui/cerrar-al-salir-el-foco';

import { WebAudioMetronome, type Metronome as MetronomeEngine } from '@audio/metronome';
import { BEATS_PER_BAR, clampBpm, MAX_BPM, MIN_BPM } from '@core/music';
import { useClaqueta } from '@state/claqueta';
import { selectActions, useSessionStore } from '@state/session-store';

export interface MetronomeProps {
  /** Para poder probarlo sin audio de verdad. */
  readonly createMetronome?: () => MetronomeEngine;
}

/**
 * El metrónomo: pulso a la velocidad que elijas.
 *
 * El tempo se puede escribir o ajustar de dos en dos.
 *
 * **En la barra van dos pastillas y nada más**: «Clic», que lo pone y lo para, y
 * «100 bpm», que abre el resto —el tempo, el compás y la luz del pulso—. Entero
 * en la cabecera eran un círculo, un campo, «−», «+», el compás y las luces, y
 * en un teléfono partía la barra de componer en dos filas: ciento treinta y tres
 * píxeles de mandos antes de la canción. Lo que se toca mientras suena es el
 * clic; el tempo se pone una vez y se vuelve poco.
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
  /**
   * Si hay una toma con su propio clic sonando.
   *
   * **Mientras la hay, este se aparta**: dos metrónomos a la vez son dos pulsos
   * que no coinciden, y el de la toma es el que manda porque es contra el que se
   * mide lo tocado. Y el tempo no se deja cambiar, que dejaría la rejilla de la
   * toma en un tempo y lo que se toca en otro.
   */
  const enLaToma = useClaqueta((estado) => estado.enLaToma);

  const engineRef = useRef<MetronomeEngine | null>(null);
  const panel = useId();
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

  // Al empezar una toma, el de la barra se calla. No vuelve solo al acabar: lo
  // que se quería oír era la toma, y volver a sonar sin pedirlo sorprende. Se
  // escucha al almacén y no a `enLaToma` en un efecto: es un aviso de fuera, y
  // pintar desde un efecto encadenaría renders.
  useEffect(
    () =>
      useClaqueta.subscribe((estado, previo) => {
        if (estado.enLaToma && !previo.enLaToma) {
          engineRef.current?.stop();
          setRunning(false);
          setBeat(0);
        }
      }),
    [],
  );

  function engine(): MetronomeEngine {
    /* v8 ignore next -- sin fabrica se usa el metronomo de verdad, que es el de la aplicacion */
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

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={enLaToma}
        aria-pressed={running}
        aria-label="Clic del metrónomo"
        title={
          enLaToma
            ? 'La toma lleva su propio clic'
            : running
              ? 'Parar el metrónomo'
              : 'Poner el metrónomo'
        }
        // **Con su nombre a la vista, «Clic».** Era un triángulo suelto en un
        // círculo, y en Ensayar está al lado de «Ensayar», que es otro
        // triángulo: se pulsaba uno queriendo el otro. El nombre que se oye
        // empieza por lo que se ve, que es lo que pide WCAG 2.5.3.
        className={`min-h-tap flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          running
            ? 'border-brass-bright text-brass-bright'
            : 'border-border text-text-muted hover:border-brass-dim hover:text-text'
        }`}
      >
        {/* El cuadrado y el triángulo son los de cualquier aparato desde hace
            cincuenta años, pero dibujados: escritos como caracteres, `■` y `▶`
            los pinta cada sistema a su manera y a su tamaño, que es lo mismo
            que ya se dijo de los emoji. */}
        {running ? <IconoParar /> : <IconoSonar />}
        Clic
      </button>

      {/*
        El resto, **en un panel que flota por encima de todo** (`popover`).

        Un `Disclosure` que flota no sirve aquí: su panel se ancla dentro de la
        barra, y la barra de componer se desplaza de lado en un teléfono, así que
        lo recortaría. El `popover` del navegador sale en la capa de arriba, no
        lo recorta nadie, se cierra con Escape o tocando fuera, y el botón que lo
        abre dice solo si está abierto.
      */}
      <button
        type="button"
        popoverTarget={panel}
        disabled={enLaToma}
        title={enLaToma ? 'El tempo no se cambia a mitad de una toma' : undefined}
        className="border-border text-text-muted enabled:hover:border-brass-dim enabled:hover:text-text min-h-tap flex shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
        // **Empieza por lo que se ve**, «100 bpm» (WCAG 2.5.3): quien lo usa
        // con la voz dice lo que lee en el botón, y el nombre era «Tempo: 100
        // pulsos por minuto», que no contiene «100 bpm». Detrás va lo que abre.
        aria-label={`${bpm} bpm, tempo y compás`}
      >
        <span className="font-mono tabular-nums">{bpm} bpm</span>
        {/* La luz del pulso, a la vista y no dentro del panel: quien toca con
            auriculares puestos o con el ampli alto necesita verlo además de
            oírlo, y el panel está cerrado mientras se toca. */}
        {running && (
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: beatsPerBar }, (_, index) => (
              <span
                key={index}
                className={`block h-2 w-2 rounded-full ${
                  index === beat ? (index === 0 ? 'bg-brass-bright' : 'bg-text-muted') : 'bg-border'
                }`}
              />
            ))}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="off">
        {running ? `Metrónomo a ${bpm} pulsos por minuto` : 'Metrónomo parado'}
      </span>

      <div
        id={panel}
        popover="auto"
        // Lleva velo y parece modal: si el tabulador se sale, se cierra, en vez
        // de seguir por los controles que tapa.
        onBlur={cerrarAlSalirElFoco}
        aria-label="Tempo y compás"
        // El navegador lo centra con `margin: auto`, y la hoja base de Tailwind
        // pone todos los márgenes a cero: sin `m-auto` sale pegado a la esquina.
        className="superficie-alta text-text backdrop:bg-night/50 m-auto p-4"
      >
        <div className="flex flex-col gap-3">
          <p className="rotulo">Tempo</p>
          <div className="flex items-center gap-2">
            <Chip onClick={() => change(bpm - 2)} ariaLabel="Dos pulsos menos" tone="quiet">
              −
            </Chip>
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
                className="border-border bg-surface text-text focus:border-brass-dim min-h-tap w-20 rounded-md border px-2 text-center font-mono text-lg tabular-nums"
              />
              <span className="text-text-muted font-mono text-xs">bpm</span>
            </label>
            <Chip onClick={() => change(bpm + 2)} ariaLabel="Dos pulsos más" tone="quiet">
              +
            </Chip>
          </div>

          {/*
            El compás, **también en un teléfono**.

            Estaba escondido por debajo de 640, y no porque sobrara: en la
            cabecera ganaba una fila de cuarenta y pico píxeles y el panel de la
            rueda dejaba de caber. En un panel aparte no le quita sitio a nadie, y
            en un teléfono vuelve a haber manera de salir del 4/4.
          */}
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
        </div>
      </div>
    </div>
  );
}
