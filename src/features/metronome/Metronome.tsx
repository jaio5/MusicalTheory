'use client';

import { useEffect, useRef, useState } from 'react';
import { Chip } from '@ui/Chip';
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
    actions.setTempo(value, beatsPerBar);
    engineRef.current?.setBpm(value);
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
          className={`size-tap flex shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            running
              ? 'border-brass-bright text-brass-bright'
              : 'border-border text-text-muted hover:border-brass'
          }`}
        >
          <span aria-hidden="true" className="text-sm">
            {running ? '■' : '▶'}
          </span>
        </button>

        <label className="flex items-center gap-1">
          <span className="sr-only">Pulsos por minuto</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(event) => change(Number(event.target.value))}
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
