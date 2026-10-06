// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { Metronome, MetronomeOptions } from '@audio/metronome';
import type { PitchEngine } from '@audio/pitch-engine';
import type { MicInput, MicState } from '@media/mic-input';

import { RETARDO_DEL_ACORDE_MS, type ChordReading, type PitchClass } from '@core/music';

import { useSessionStore } from './session-store';
import { useMicrofono } from './microfono';
import { entradaActiva, useListening } from './use-listening';
import { useTocarYApuntar, type TocarDeps } from './use-tocar-y-apuntar';

/**
 * Irse de la pantalla a mitad de una toma.
 *
 * El gesto entero —contar, grabar, escribir— lo prueba `TocarParaEscribir.test`.
 * Aquí solo lo que pasa al desmontarse, que cambió cuando el marco dejó de
 * desmontarse al navegar: **el micro lo sigue sujetando la barra**, así que ya no
 * basta con que se vaya el último para que todo se cierre. Medido en un Chromium:
 * tocando en `/componer` y saltando a `/afinar`, la barra seguía encendida y la
 * sesión seguía «capturando».
 */

class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;
  #oyentes = new Set<(state: AudioInputState) => void>();

  async start(): Promise<void> {
    this.#poner('running');
  }
  async stop(): Promise<void> {
    this.#poner('idle');
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  subscribe(oyente: (state: AudioInputState) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }
  #poner(state: AudioInputState): void {
    this.state = state;
    for (const oyente of this.#oyentes) {
      oyente(state);
    }
  }
}

class MotorFalso implements PitchEngine {
  running = false;
  readonly options = {} as PitchEngine['options'];
  async start(): Promise<void> {}
  stop(): void {}
  subscribe(): () => void {
    return () => {};
  }
  subscribeLevel(): () => void {
    return () => {};
  }
}

class CromaFalso implements ChordEngine {
  running = false;
  async start(): Promise<void> {}
  stop(): void {}
  setAccidental(): void {}
  subscribe(): () => void {
    return () => {};
  }
}

/** Un micro de grabar que no se abre: la toma sigue sin sonido, que basta aquí. */
class MicQueNoSeAbre implements MicInput {
  state: MicState = 'idle';
  errorMessage: string | null = null;
  stream: MediaStream | null = null;
  async start(): Promise<void> {
    this.state = 'error';
    this.errorMessage = 'sin micro de grabar';
  }
  async stop(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

function dependencias(entrada: AudioInput): TocarDeps {
  return {
    createInput: () => entrada,
    createEngine: () => new MotorFalso(),
    createChordEngine: () => new CromaFalso(),
    createMic: () => new MicQueNoSeAbre(),
  };
}

afterEach(async () => {
  const { result, unmount } = renderHook(() => useListening({}));
  await act(() => result.current.stop());
  unmount();
});

describe('irse a mitad de una toma', () => {
  it('para la captura y cierra la escucha que abrió, aunque la barra siga', async () => {
    const entrada = new EntradaFalsa();
    // La barra: sigue montada, como en el marco común.
    const barra = renderHook(() => useListening({}));
    const toma = renderHook(() => useTocarYApuntar(dependencias(entrada)));

    // Sin cuenta: lo que se prueba es irse con la toma en marcha, no la claqueta.
    await act(() => toma.result.current.empezar(false));
    expect(toma.result.current.fase).toBe('tocando');
    expect(useSessionStore.getState().capturing).toBe(true);

    toma.unmount();
    await act(() => Promise.resolve());

    expect(useSessionStore.getState().capturing, 'la sesión sigue capturando').toBe(false);
    expect(entrada.state, 'el micro de la toma sigue abierto').toBe('idle');
    expect(useSessionStore.getState().listening).toBe('idle');
    barra.unmount();
  });

  it('si tiene que abrir su propio micro de grabar, abre el elegido', async () => {
    const pedidos: unknown[] = [];
    class MicQueApunta extends MicQueNoSeAbre {
      override async start(options?: unknown): Promise<void> {
        pedidos.push(options);
        await super.start();
      }
    }
    useMicrofono.setState({ elegido: 'tarjeta', cargado: true });
    const toma = renderHook(() =>
      useTocarYApuntar({
        ...dependencias(new EntradaFalsa()),
        createMic: () => new MicQueApunta(),
      }),
    );

    await act(() => toma.result.current.empezar(false));

    // Abrir el del sistema grabaría otro aparato que el que se está oyendo.
    expect(pedidos).toEqual([{ deviceId: 'tarjeta' }]);
    await act(() => toma.result.current.parar());
    toma.unmount();
    useMicrofono.setState({ elegido: null, cargado: false });
  });

  it('y si el elegido no está y se oye por el del sistema, graba el del sistema', async () => {
    const pedidos: unknown[] = [];
    class MicQueApunta extends MicQueNoSeAbre {
      override async start(options?: unknown): Promise<void> {
        pedidos.push(options);
        await super.start();
      }
    }
    // La tarjeta no está: la escucha la prueba, falla y cae al del sistema.
    class EntradaQueNoEsta extends EntradaFalsa {
      override async start(): Promise<void> {
        this.state = 'error';
      }
    }
    useMicrofono.setState({ elegido: 'tarjeta', cargado: true });
    const toma = renderHook(() =>
      useTocarYApuntar({
        ...dependencias(new EntradaFalsa()),
        createInput: (id) => (id === 'tarjeta' ? new EntradaQueNoEsta() : new EntradaFalsa()),
        createMic: () => new MicQueApunta(),
      }),
    );

    await act(() => toma.result.current.empezar(false));

    expect(useMicrofono.getState().cayo).toBe(true);
    expect(pedidos).toEqual([{}]);
    await act(() => toma.result.current.parar());
    toma.unmount();
    useMicrofono.setState({ elegido: null, cargado: false, cayo: false });
  });

  it('estando quieta no cierra el micro que abrió la barra', async () => {
    const entrada = new EntradaFalsa();
    const barra = renderHook(() =>
      useListening({ createInput: () => entrada, createEngine: () => new MotorFalso() }),
    );
    await act(() => barra.result.current.start());
    const toma = renderHook(() => useTocarYApuntar(dependencias(new EntradaFalsa())));

    toma.unmount();
    await act(() => Promise.resolve());

    expect(entrada.state).toBe('running');
    expect(entradaActiva()).toBe(entrada);
    expect(useSessionStore.getState().listening).toBe('listening');
    barra.unmount();
  });
});

/** Un croma que dice lo que se le manda, cuando se le manda. */
class CromaQueDice implements ChordEngine {
  running = false;
  #oyente: ((chord: ChordReading | null) => void) | null = null;
  async start(): Promise<void> {}
  stop(): void {}
  setAccidental(): void {}
  subscribe(oyente: (chord: ChordReading | null) => void): () => void {
    this.#oyente = oyente;
    return () => {
      this.#oyente = null;
    };
  }
  dice(chord: ChordReading | null): void {
    this.#oyente?.(chord);
  }
}

/** Una claqueta que suena cuando se le da: cada `pulso` es un clic. */
class ClaquetaAMano implements Metronome {
  running = false;
  #onBeat: MetronomeOptions['onBeat'];
  async start(options: MetronomeOptions): Promise<void> {
    this.#onBeat = options.onBeat;
    this.running = true;
  }
  setBpm(): void {}
  stop(): void {
    this.running = false;
  }
  async dispose(): Promise<void> {
    this.running = false;
  }
  pulso(instante: number): void {
    this.#onBeat?.(0, instante);
  }
}

const DO_MAYOR: ChordReading = {
  best: {
    root: 0 as PitchClass,
    notes: [0, 4, 7] as PitchClass[],
    symbol: 'C',
    score: 0.95,
    shape: {} as ChordReading['best']['shape'],
  },
  alternatives: [],
  margin: 0.4,
};

/**
 * El acorde rasgueado en la cuenta: la reproducción del fallo, por el camino
 * entero de la toma. Lo de dentro —cuándo se apunta, cuándo no y cuándo se
 * repite— lo prueba `session-store.test`.
 */
describe('el acorde rasgueado durante la cuenta', () => {
  it('entra como el primero, en el compás uno', async () => {
    const croma = new CromaQueDice();
    const claqueta = new ClaquetaAMano();
    const toma = renderHook(() =>
      useTocarYApuntar({
        ...dependencias(new EntradaFalsa()),
        createChordEngine: () => croma,
        createMetronome: () => claqueta,
      }),
    );
    const { bpm, beatsPerBar } = useSessionStore.getState();
    const pulso = 60_000 / bpm;

    let empezar: Promise<void> = Promise.resolve();
    act(() => {
      empezar = toma.result.current.empezar();
    });
    await act(async () => {
      // Hasta que la claqueta arranca: el micro se abre antes de contar.
      for (let vuelta = 0; vuelta < 20 && !claqueta.running; vuelta += 1) {
        await Promise.resolve();
      }
    });
    expect(toma.result.current.fase).toBe('contando');

    // Dos compases de cuenta; el Do suena desde dos pulsos antes del compás uno.
    const total = 2 * beatsPerBar;
    const ultimoClic = 1_000 + (total - 1) * pulso;
    await act(async () => {
      for (let clic = 0; clic < total; clic += 1) {
        if (clic === total - 2) {
          useSessionStore.getState().actions.setLevel(0.05);
          croma.dice(DO_MAYOR);
        }
        claqueta.pulso(1_000 + clic * pulso);
      }
      await empezar;
    });

    expect(toma.result.current.fase).toBe('tocando');
    const estado = useSessionStore.getState();
    expect(estado.captureStartedAt).toBe(ultimoClic + pulso);
    expect(estado.captured).toHaveLength(1);
    expect(estado.captured[0]).toMatchObject({ root: 0, notes: [0, 4, 7] });
    expect(estado.captured[0]!.at - RETARDO_DEL_ACORDE_MS).toBe(estado.captureStartedAt);

    await act(() => toma.result.current.parar());
    toma.unmount();
  });
});
