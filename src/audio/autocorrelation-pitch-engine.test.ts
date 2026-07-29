import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { midiToFrequency } from '@core/music';

import { AutocorrelationPitchEngine } from './autocorrelation-pitch-engine';
import type { AudioInput, AudioInputState } from './audio-input';
import type { PitchSample } from './pitch-engine';

const SAMPLE_RATE = 48_000;
const FRAME = 2048;

/** Entrada falsa: entrega el tono que le digamos, o silencio. */
class FakeAudioInput implements AudioInput {
  state: AudioInputState = 'running';
  readonly sampleRate = SAMPLE_RATE;
  readonly frameSize = FRAME;
  readonly error = null;

  frequency: number | null = null;
  amplitude = 0.5;
  available = true;

  readonly spectrumSize = 8192;

  readSpectrum(target: Float32Array<ArrayBuffer>): boolean {
    target.fill(-120);
    return this.state === 'running';
  }

  readTimeDomain(target: Float32Array): boolean {
    if (!this.available) {
      return false;
    }
    for (let i = 0; i < target.length; i += 1) {
      target[i] =
        this.frequency === null
          ? 0
          : this.amplitude * Math.sin((2 * Math.PI * this.frequency * i) / this.sampleRate);
    }
    return true;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

describe('AutocorrelationPitchEngine', () => {
  let clock = 0;
  let input: FakeAudioInput;
  let engine: AutocorrelationPitchEngine;
  let samples: Array<PitchSample | null>;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    input = new FakeAudioInput();
    engine = new AutocorrelationPitchEngine({ now: () => clock });
    samples = [];
    engine.subscribe((sample) => samples.push(sample));
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  /** Avanza el reloj falso y el temporizador a la vez. */
  function advance(ms: number): void {
    const step = engine.options.analysisIntervalMs;
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock += step;
      vi.advanceTimersByTime(step);
    }
  }

  it('no arranca si la entrada no está arrancada', async () => {
    input.state = 'idle';
    await expect(engine.start(input)).rejects.toThrow(/no está arrancada/);
  });

  it('emite la nota que está sonando', async () => {
    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(200);

    const detected = samples.filter((sample): sample is PitchSample => sample !== null);
    expect(detected.length).toBeGreaterThan(0);
    expect(detected[0]!.frequency).toBeCloseTo(midiToFrequency(45), 0);
    expect(detected[0]!.clarity).toBeGreaterThan(0.9);
  });

  it('sigue el cambio de nota', async () => {
    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(150);

    input.frequency = midiToFrequency(52);
    advance(150);

    const detected = samples.filter((sample): sample is PitchSample => sample !== null);
    expect(detected.at(-1)!.frequency).toBeCloseTo(midiToFrequency(52), 0);
  });

  it('sigue una nota que decae por debajo del umbral de enganche', async () => {
    // Es el caso real: una cuerda pulsada pierde nivel desde el primer
    // instante, y con un solo umbral la detección se cortaba mientras la nota
    // todavía se oía de sobra.
    input.frequency = midiToFrequency(45);
    input.amplitude = 0.3;
    await engine.start(input);
    advance(100);
    samples = [];

    // Valor eficaz por debajo del umbral de enganche y por encima del de
    // seguimiento.
    input.amplitude = 0.003;
    advance(1000);

    const detected = samples.filter((sample): sample is PitchSample => sample !== null);
    expect(detected.length).toBeGreaterThan(10);
    expect(samples).not.toContain(null);
  });

  it('no engancha una nota nueva que nace por debajo del umbral de enganche', async () => {
    input.frequency = midiToFrequency(45);
    input.amplitude = 0.003;
    await engine.start(input);
    advance(500);

    expect(samples.filter((sample) => sample !== null)).toHaveLength(0);
  });

  it('vuelve a exigir el umbral de enganche después de un silencio', async () => {
    input.frequency = midiToFrequency(45);
    input.amplitude = 0.3;
    await engine.start(input);
    advance(100);

    input.frequency = null;
    advance(1500);
    samples = [];

    // El mismo nivel con el que seguía antes ya no basta para volver a engancharla.
    input.frequency = midiToFrequency(45);
    input.amplitude = 0.003;
    advance(500);

    expect(samples.filter((sample) => sample !== null)).toHaveLength(0);
  });

  it('aguanta el silencio corto entre dos púas sin apagar la nota', async () => {
    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(150);
    samples = [];

    input.frequency = null;
    advance(400); // menos que silenceHoldMs

    expect(samples).not.toContain(null);
  });

  it('avisa con null cuando el silencio se alarga', async () => {
    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(150);
    samples = [];

    input.frequency = null;
    advance(1000);

    expect(samples).toContain(null);
  });

  it('avisa una sola vez por silencio, no en cada análisis', async () => {
    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(150);
    samples = [];

    input.frequency = null;
    advance(2000);

    expect(samples.filter((sample) => sample === null)).toHaveLength(1);
  });

  it('no emite nada si la entrada todavía no tiene datos', async () => {
    input.available = false;
    await engine.start(input);
    samples = [];
    advance(200);

    expect(samples).toHaveLength(0);
  });

  it('deja de analizar al pararlo', async () => {
    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(100);

    engine.stop();
    expect(engine.running).toBe(false);

    samples = [];
    advance(500);
    expect(samples).toHaveLength(0);
  });

  it('deja de avisar a quien se da de baja', async () => {
    const received: Array<PitchSample | null> = [];
    const unsubscribe = engine.subscribe((sample) => received.push(sample));

    input.frequency = midiToFrequency(45);
    await engine.start(input);
    advance(100);
    expect(received.length).toBeGreaterThan(0);

    unsubscribe();
    const seen = received.length;
    advance(200);
    expect(received).toHaveLength(seen);
  });
});
