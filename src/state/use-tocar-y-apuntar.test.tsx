// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import type { MicInput, MicState } from '@media/mic-input';

import { useSessionStore } from './session-store';
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
