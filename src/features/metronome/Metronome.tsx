'use client';

import { useEffect, useRef, useState } from 'react';

import { WebAudioMetronome, type Metronome as MetronomeEngine } from '@audio/metronome';
import {
  BEATS_PER_BAR,
  bpmFromTaps,
  clampBpm,
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  MAX_BPM,
  MIN_BPM,
} from '@core/music';

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
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [beatsPerBar, setBeatsPerBar] = useState(DEFAULT_BEATS_PER_BAR);
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
    setBpm(value);
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
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
            running
              ? 'border-brass-bright text-brass-bright'
              : 'border-border text-text-muted hover:border-brass'
          }`}
        >
          <span aria-hidden="true" className="text-sm">
            {running ? '■' : '▶'}
          </span>
        </button>

        <label className="flex items-baseline gap-1">
          <span className="sr-only">Pulsos por minuto</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(event) => change(Number(event.target.value))}
            className="border-border bg-background text-text w-16 border px-2 py-1 text-center font-mono text-lg tabular-nums"
          />
          <span className="text-text-muted font-mono text-xs">bpm</span>
        </label>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => change(bpm - 2)}
            aria-label="Dos pulsos menos"
            className="border-border text-text-muted hover:text-text border px-2 py-1 font-mono text-xs"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => change(bpm + 2)}
            aria-label="Dos pulsos más"
            className="border-border text-text-muted hover:text-text border px-2 py-1 font-mono text-xs"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={tap}
          className="border-border text-text-muted hover:text-text border px-2 py-1 font-mono text-xs"
        >
          Marcar
        </button>

        <label className="flex items-center gap-1">
          <span className="text-text-muted font-mono text-xs">Compás</span>
          <select
            value={beatsPerBar}
            onChange={(event) => {
              const value = Number(event.target.value);
              setBeatsPerBar(value);
              if (running) {
                void engine().start({ bpm, beatsPerBar: value, onBeat: setBeat });
              }
            }}
            className="border-border bg-background text-text border px-1 py-1 font-mono text-xs"
          >
            {BEATS_PER_BAR.map((beats) => (
              <option key={beats} value={beats}>
                {beats}
              </option>
            ))}
          </select>
        </label>

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
