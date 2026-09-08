// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import type { ChordMatch, ChordReading } from '@core/music';

import { useSessionStore } from './session-store';
import { useListening, type ListeningDeps } from './use-listening';

class FakeInput implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;

  async start(): Promise<void> {
    this.state = 'running';
  }
  async stop(): Promise<void> {
    this.state = 'idle';
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  subscribe(): () => void {
    return () => {};
  }
}

class SilentPitchEngine implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
  async start(): Promise<void> {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  subscribe(): () => void {
    return () => {};
  }
  subscribeLevel(): () => void {
    return () => {};
  }
}

class FakeChordEngine implements ChordEngine {
  running = false;
  started = false;
  #listeners = new Set<(chord: ChordReading | null) => void>();

  async start(): Promise<void> {
    this.running = true;
    this.started = true;
  }
  stop(): void {
    this.running = false;
  }
  setAccidental(): void {}
  subscribe(listener: (chord: ChordReading | null) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  /** Simula que el motor ha reconocido un acorde. */
  announce(chord: ChordReading): void {
    for (const listener of this.#listeners) {
      listener(chord);
    }
  }
}

const AM_MATCH: ChordMatch = {
  root: 9,
  shape: { intervals: [0, 3, 7], name: 'menor', suffix: 'm' },
  symbol: 'Am',
  notes: [9, 0, 4],
  score: 0.91,
};

/** Un La menor claro: el segundo candidato se queda lejos. */
const AM: ChordReading = {
  best: AM_MATCH,
  alternatives: [
    {
      root: 0,
      shape: { intervals: [0, 4, 7, 9], name: 'con sexta', suffix: '6' },
      symbol: 'C6',
      notes: [0, 4, 7, 9],
      score: 0.72,
    },
  ],
  margin: 0.19,
};

function Escucha(deps: ListeningDeps) {
  const { start } = useListening(deps);
  return (
    <button type="button" onClick={() => void start()}>
      Escuchar
    </button>
  );
}

/**
 * Dos botones de escuchar en la misma pantalla, que es lo que hay en `/afinar`:
 * el grande del afinador y el de la barra de arriba.
 */
function DosBotones({ deps }: { readonly deps: ListeningDeps }) {
  const barra = useListening(deps);
  const afinador = useListening(deps);
  return (
    <>
      <button type="button" onClick={() => void afinador.start()}>
        Arrancar desde el afinador
      </button>
      <button type="button" onClick={() => void barra.stop()}>
        Parar desde la barra
      </button>
    </>
  );
}

/**
 * El fallo que costó encontrar, y que ningún test veía: **dos botones, dos
 * micrófonos**.
 *
 * En `/afinar` hay dos sitios que abren el micro y el estado de sesión es uno
 * solo. Cada gancho guardaba su entrada en sus propias referencias, así que al
 * arrancar desde el afinador el botón de la barra se pintaba encendido —lee el
 * estado global— y al pulsarlo llamaba a *su* `stop`, que no tenía nada abierto:
 * ponía «sin escuchar», el afinador volvía a su pantalla de arranque y **el
 * micrófono seguía abierto**, con el piloto del navegador encendido.
 *
 * Se vio conduciendo un Chromium de verdad y contando las pistas vivas, no
 * leyendo el código. Esto es lo que impide que vuelva.
 */
describe('El micrófono es uno solo', () => {
  it('parar desde un botón cierra lo que abrió el otro', async () => {
    const entrada = new FakeInput();
    render(
      <DosBotones
        deps={{ createInput: () => entrada, createEngine: () => new SilentPitchEngine() }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));
    await waitFor(() => expect(entrada.state).toBe('running'));

    await userEvent.click(screen.getByRole('button', { name: /parar desde la barra/i }));

    expect(entrada.state, 'el micro se ha quedado abierto').toBe('idle');
    expect(useSessionStore.getState().listening).toBe('idle');
  });

  it('y no se abre dos veces si se pulsan los dos', async () => {
    const abiertas: FakeInput[] = [];
    render(
      <DosBotones
        deps={{
          createInput: () => {
            const nueva = new FakeInput();
            abiertas.push(nueva);
            return nueva;
          },
          createEngine: () => new SilentPitchEngine(),
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));
    await waitFor(() => expect(abiertas).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));

    expect(abiertas, 'se ha pedido el micro dos veces').toHaveLength(1);
  });
});

describe('Escuchar', () => {
  it('sin pedirlo, no analiza acordes', async () => {
    const chordEngine = new FakeChordEngine();
    render(
      <Escucha
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(chordEngine.started).toBe(false);
  });

  it('en componer sí, y lo que reconoce llega al estado', async () => {
    const chordEngine = new FakeChordEngine();
    render(
      <Escucha
        chords
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(chordEngine.started).toBe(true));

    chordEngine.announce(AM);

    expect(useSessionStore.getState().heardChord?.symbol).toBe('Am');
  });

  it('al soltar el micro se olvida lo que sonaba', async () => {
    const chordEngine = new FakeChordEngine();
    const { unmount } = render(
      <Escucha
        chords
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(chordEngine.started).toBe(true));
    chordEngine.announce(AM);
    unmount();

    expect(chordEngine.running).toBe(false);
  });
});
