import { describe, expect, it, vi } from 'vitest';

import type { ChordMatch } from '@core/music';

import type { AudioInput, AudioInputState } from './audio-input';
import { ChromaChordEngine } from './chord-engine';

const SAMPLE_RATE = 48_000;
const SPECTRUM_SIZE = 8192;
const BIN_HZ = SAMPLE_RATE / SPECTRUM_SIZE;
const SKIRT_DB = 12;

/** Una entrada de mentira que devuelve siempre el mismo acorde. */
class FakeInput implements AudioInput {
  state: AudioInputState = 'running';
  readonly sampleRate = SAMPLE_RATE;
  readonly frameSize = 2048;
  readonly spectrumSize = SPECTRUM_SIZE;
  error = null;
  peaks: readonly number[] = [];

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  readTimeDomain(): boolean {
    return true;
  }

  readSpectrum(target: Float32Array<ArrayBuffer>): boolean {
    target.fill(-120);
    for (const hz of this.peaks) {
      const exact = hz / BIN_HZ;
      const bin = Math.round(exact);
      const tilt = -2 * SKIRT_DB * (exact - bin);
      target[bin - 1] = -10 - SKIRT_DB + tilt;
      target[bin] = -10;
      target[bin + 1] = -10 - SKIRT_DB - tilt;
    }
    return true;
  }

  subscribe(): () => void {
    return () => {};
  }
}

/** C mayor y A menor en la octava cuarta, sin armónicos. */
const C_MAJOR = [261.6, 329.6, 392.0];
const A_MINOR = [220.0, 261.6, 329.6];

async function listen(input: FakeInput, engine: ChromaChordEngine, ticks: number) {
  const heard: (ChordMatch | null)[] = [];
  engine.subscribe((chord) => heard.push(chord));
  await engine.start(input);
  await vi.advanceTimersByTimeAsync((1000 / engine.options.rate) * ticks);
  return heard;
}

describe('Motor de acordes', () => {
  it('reconoce el acorde que suena, tras sostenerlo', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    const engine = new ChromaChordEngine();

    const heard = await listen(input, engine, 12);
    engine.stop();
    vi.useRealTimers();

    expect(heard.at(-1)?.symbol).toBe('C');
  });

  it('no canta un acorde por un fotograma suelto', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    const engine = new ChromaChordEngine({ confirmations: 5 });
    const heard: (ChordMatch | null)[] = [];
    engine.subscribe((chord) => heard.push(chord));

    await engine.start(input);
    await vi.advanceTimersByTimeAsync(1000 / engine.options.rate);
    engine.stop();
    vi.useRealTimers();

    expect(heard).toEqual([]);
  });

  it('avisa una vez por acorde, no en cada análisis', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    const engine = new ChromaChordEngine();

    const heard = await listen(input, engine, 20);
    engine.stop();
    vi.useRealTimers();

    expect(heard).toHaveLength(1);
  });

  it('sigue el cambio de acorde', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    const engine = new ChromaChordEngine();
    const heard: (ChordMatch | null)[] = [];
    engine.subscribe((chord) => heard.push(chord));

    await engine.start(input);
    await vi.advanceTimersByTimeAsync(1500);
    input.peaks = A_MINOR;
    await vi.advanceTimersByTimeAsync(1500);
    engine.stop();
    vi.useRealTimers();

    expect(heard.map((chord) => chord?.symbol)).toEqual(['C', 'Am']);
  });

  it('con la entrada parada no analiza nada', async () => {
    const input = new FakeInput();
    input.state = 'idle';
    const engine = new ChromaChordEngine();

    await engine.start(input);

    expect(engine.running).toBe(false);
  });
});
