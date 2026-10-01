import { describe, expect, it, vi } from 'vitest';

import type { ChordReading } from '@core/music';

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
  const heard: (ChordReading | null)[] = [];
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

    expect(heard.at(-1)?.best.symbol).toBe('C');
  });

  it('no canta un acorde por un fotograma suelto', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    const engine = new ChromaChordEngine({ confirmations: 5 });
    const heard: (ChordReading | null)[] = [];
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
    const heard: (ChordReading | null)[] = [];
    engine.subscribe((chord) => heard.push(chord));

    await engine.start(input);
    await vi.advanceTimersByTimeAsync(1500);
    input.peaks = A_MINOR;
    await vi.advanceTimersByTimeAsync(1500);
    engine.stop();
    vi.useRealTimers();

    expect(heard.map((chord) => chord?.best.symbol)).toEqual(['C', 'Am']);
  });

  /**
   * **La cuarta nota que ponen los armónicos no cambia de acorde.** Con una
   * guitarra el cifrado parpadea entre C7, Cmaj7 y C6 de un análisis a otro;
   * confirmando por cifrado, cuatro iguales seguidos no llegaban nunca.
   */
  it('un Do que parpadea entre cuatriadas se confirma igual, y una vez', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    const engine = new ChromaChordEngine({ smoothing: 1 });
    const heard: (ChordReading | null)[] = [];
    engine.subscribe((chord) => heard.push(chord));
    await engine.start(input);

    // Do con la séptima mayor, luego con la menor, luego con la sexta.
    for (const cuarta of [493.9, 466.2, 440.0, 493.9, 466.2, 440.0]) {
      input.peaks = [...C_MAJOR, cuarta];
      await vi.advanceTimersByTimeAsync(1000 / engine.options.rate);
    }
    engine.stop();
    vi.useRealTimers();

    expect(heard).toHaveLength(1);
    expect(heard[0]!.best.root).toBe(0);
  });

  /** **Hasta mil hercios**: por encima no hay fundamentales de guitarra, solo armónicos. */
  it('no mira por encima de mil hercios, salvo que se le pida', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    // Un Do mayor en la octava seis: solo existe por encima de mil.
    input.peaks = C_MAJOR.map((hz) => hz * 4);
    const engine = new ChromaChordEngine();
    expect(engine.options.maxHz).toBe(1000);
    const nada = await listen(input, engine, 12);
    engine.stop();

    const ancho = new ChromaChordEngine({ maxHz: 2200 });
    const algo = await listen(input, ancho, 12);
    ancho.stop();
    vi.useRealTimers();

    expect(nada.filter((chord) => chord !== null)).toEqual([]);
    expect(algo.at(-1)?.best.symbol).toBe('C');
  });

  it('con la entrada parada no analiza nada', async () => {
    const input = new FakeInput();
    input.state = 'idle';
    const engine = new ChromaChordEngine();

    await engine.start(input);

    expect(engine.running).toBe(false);
  });
});

describe('lo que faltaba por mirar del motor de acordes', () => {
  /**
   * La alteración con la que se escriben los cifrados la pone la tonalidad: un
   * mismo acorde se llama F# en Sol mayor y Gb en Reb mayor, y el motor tiene
   * que decirlo como se escribe allí.
   */
  it('escribe los cifrados con la alteracion que se le diga', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    // Fa sostenido mayor, que es el que cambia de nombre según la armadura.
    input.peaks = [369.99, 466.16, 554.37];
    const engine = new ChromaChordEngine();
    engine.setAccidental('flat');

    const heard = await listen(input, engine, 12);
    engine.stop();
    vi.useRealTimers();

    expect(heard.at(-1)?.best.symbol).toBe('Gb');
  });

  /**
   * Y una entrada que no tiene dato —el contexto dormido, sin ir más lejos— no
   * es silencio: no se analiza nada en vez de leer un espectro de ceros y decir
   * que ha dejado de sonar.
   */
  it('sin dato que leer no dice nada', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    input.readSpectrum = () => false;
    const engine = new ChromaChordEngine();

    const heard = await listen(input, engine, 12);
    engine.stop();
    vi.useRealTimers();

    expect(heard).toEqual([]);
  });

  // Y cuando deja de sonar algo reconocible, se dice: el hueco es información.
  it('cuando deja de haber acorde, lo dice', async () => {
    vi.useFakeTimers();
    const input = new FakeInput();
    input.peaks = C_MAJOR;
    const engine = new ChromaChordEngine();
    const heard: (ChordReading | null)[] = [];
    engine.subscribe((chord) => heard.push(chord));
    await engine.start(input);
    await vi.advanceTimersByTimeAsync((1000 / engine.options.rate) * 12);

    // Tres notas pegadas: no forman ninguna de las formas del catálogo.
    input.peaks = [261.6, 277.2, 293.7];
    await vi.advanceTimersByTimeAsync((1000 / engine.options.rate) * 40);
    engine.stop();
    vi.useRealTimers();

    expect(heard[0]?.best.symbol).toBe('C');
    expect(heard.at(-1)).toBeNull();
  });
});
