// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import { pitchClassFromName } from '@core/music';
import type { MicInput, MicState } from '@media/mic-input';
import type { Recording, RecorderState, SessionRecorder } from '@media/session-recorder';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { TocarParaEscribir } from './TocarParaEscribir';

/**
 * Componer tocando.
 *
 * Lo que se prueba es **el gesto**: que una sola pulsación abra el micro, grabe
 * y empiece a apuntar, y que al parar lo tocado esté ya en la canción. Estaba
 * construido entero y en dos tiempos —«apuntar» y luego «traer lo grabado»—, y
 * el segundo paso es justo el que se olvidaba
 * ([adr/0034](../../../docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
 */

/**
 * Los falsos del audio, con la misma forma que los de `use-listening.test`: aquí
 * no se prueba el motor, se prueba el gesto.
 */
class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;
  #oyentes = new Set<(state: AudioInputState) => void>();

  // **Avisa de su estado**, que es de donde se entera la escucha: quien no lo
  // hace deja el estado en «pidiendo permiso» para siempre, y eso no es un
  // detalle del falso sino lo que hace la entrada de verdad.
  async start(): Promise<void> {
    this.state = 'running';
    for (const oyente of this.#oyentes) {
      oyente(this.state);
    }
  }
  async stop(): Promise<void> {
    this.state = 'idle';
    for (const oyente of this.#oyentes) {
      oyente(this.state);
    }
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
}

class MotorFalso implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
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

class MicFalso implements MicInput {
  state: MicState = 'idle';
  errorMessage: string | null = null;
  stream: MediaStream | null = null;
  async start() {
    this.state = 'running';
    this.stream = {} as MediaStream;
  }
  async stop() {
    this.state = 'idle';
    this.stream = null;
  }
  subscribe(): () => void {
    return () => {};
  }
}

class GrabadorFalso implements SessionRecorder {
  state: RecorderState = 'idle';
  errorMessage: string | null = null;
  async start() {
    this.state = 'recording';
  }
  pause(): void {}
  resume(): void {}
  subscribe(): () => void {
    return () => {};
  }
  async stop(): Promise<Recording> {
    this.state = 'idle';
    return {
      blob: new Blob(['x'], { type: 'audio/webm' }),
      filename: 'toma.webm',
      mimeType: 'audio/webm',
      durationMs: 4000,
    };
  }
}

const DEPS = {
  createInput: () => new EntradaFalsa(),
  createEngine: () => new MotorFalso(),
  createChordEngine: () => new CromaFalso(),
  createMic: () => new MicFalso(),
  createRecorder: () => new GrabadorFalso(),
};

const C = pitchClassFromName('C');

/**
 * El reloj avanza a saltos.
 *
 * Es `performance.now` quien marca el tramo apuntado, y en un test todo ocurre
 * en el mismo milisegundo: un acorde que dura cero no llega a un pulso y
 * `captureProgression` lo descarta, con razón. Con el reloj a saltos, lo que se
 * prueba deja de depender de lo rápido que vaya la máquina.
 */
let ahora = 0;

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  useArrangementStore.setState({ arrangement: { parts: [] }, past: [] });
  ahora = 0;
  vi.stubGlobal('performance', { ...performance, now: () => (ahora += 2000) });
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:toma',
    revokeObjectURL: () => undefined,
  });
});

/** Deja apuntado un acorde, como haría el motor de croma mientras suena. */
function suenaUnAcorde(): void {
  const { actions } = useSessionStore.getState();
  actions.setHeardChord({
    symbol: 'C',
    root: C,
    notes: [0, 4, 7],
    // Dentro del tramo apuntado: el reloj va por 2000 al empezar y estará en
    // 4000 al parar.
    at: 2500,
    score: 0.95,
    margin: 0.3,
    alternatives: [],
  });
}

describe('Tocar para escribir', () => {
  it('sin tonalidad no se puede empezar, y se dice por que', () => {
    render(<TocarParaEscribir deps={DEPS} />);

    expect(screen.getByText(/Elige una tonalidad y toca/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tocar$/ })).not.toBeInTheDocument();
  });

  it('una sola pulsacion abre el micro y empieza a apuntar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(useSessionStore.getState().listening).toBe('listening');
    expect(useSessionStore.getState().capturing).toBe(true);
    expect(screen.getByRole('button', { name: /Parar y escribirlo/ })).toBeInTheDocument();
  });

  // Tocar contra una pantalla quieta es tocar a ciegas: hay que ver que te oye.
  it('mientras suena se ve el acorde que reconoce', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    suenaUnAcorde();

    expect(await screen.findByText('C')).toBeInTheDocument();
  });

  /**
   * El paso que se olvidaba: antes había que acordarse de pulsar además «traer
   * lo grabado», y sin eso lo tocado no entraba en ninguna parte.
   */
  it('al parar, lo tocado ya esta en la cancion', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    suenaUnAcorde();

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/Ya está en la canción/);
  });

  it('y el micro se cierra al parar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(useSessionStore.getState().listening).toBe('idle');
    expect(useSessionStore.getState().capturing).toBe(false);
  });

  /**
   * La toma se queda al lado de lo transcrito, y no es adorno: transcribir
   * pierde cosas a propósito —las notas iguales seguidas se funden, el croma
   * olvida la octava— y el sonido de verdad es lo que deja comprobar qué se
   * perdió.
   */
  it('la toma de audio se queda para poder oirla', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(screen.getByLabelText('La toma que acabas de grabar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeInTheDocument();
  });

  it('y lleva a verlo escrito, que es a donde se va despues', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const ido: string[] = [];
    render(<TocarParaEscribir deps={DEPS} onEscrito={() => ido.push('escribir')} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    suenaUnAcorde();
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    await userEvent.click(screen.getByRole('button', { name: /Verlo en la partitura/ }));

    expect(ido).toEqual(['escribir']);
  });
});
