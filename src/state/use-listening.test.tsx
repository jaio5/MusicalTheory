// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import type { ChordMatch } from '@core/music';

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
  #listeners = new Set<(chord: ChordMatch | null) => void>();

  async start(): Promise<void> {
    this.running = true;
    this.started = true;
  }
  stop(): void {
    this.running = false;
  }
  setAccidental(): void {}
  subscribe(listener: (chord: ChordMatch | null) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  /** Simula que el motor ha reconocido un acorde. */
  announce(chord: ChordMatch): void {
    for (const listener of this.#listeners) {
      listener(chord);
    }
  }
}

const AM: ChordMatch = {
  root: 9,
  shape: { intervals: [0, 3, 7], name: 'menor', suffix: 'm' },
  symbol: 'Am',
  notes: [9, 0, 4],
  score: 0.91,
};

function Escucha(deps: ListeningDeps) {
  const { start } = useListening(deps);
  return (
    <button type="button" onClick={() => void start()}>
      Escuchar
    </button>
  );
}

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
