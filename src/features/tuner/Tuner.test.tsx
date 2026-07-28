// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputError, AudioInputState } from '@audio/audio-input';
import type { PitchEngine, PitchSample } from '@audio/pitch-engine';
import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';
import { midiToFrequency } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { Tuner } from './Tuner';

class FakeInput implements AudioInput {
  state: AudioInputState = 'idle';
  error: AudioInputError | null = null;
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;

  #listeners = new Set<(state: AudioInputState) => void>();

  constructor(private readonly outcome: AudioInputState = 'running') {}

  async start(): Promise<void> {
    this.#set('requesting');
    if (this.outcome !== 'running') {
      this.error = { state: 'denied', message: 'Has denegado el acceso al micrófono.' };
    }
    this.#set(this.outcome);
  }

  async stop(): Promise<void> {
    this.#set('idle');
  }

  readTimeDomain(): boolean {
    return false;
  }

  subscribe(listener: (state: AudioInputState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #set(state: AudioInputState): void {
    this.state = state;
    for (const listener of this.#listeners) {
      listener(state);
    }
  }
}

class FakeEngine implements PitchEngine {
  readonly options = DEFAULT_PITCH_ENGINE_OPTIONS;
  running = false;

  #listeners = new Set<(sample: PitchSample | null) => void>();

  async start(): Promise<void> {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  subscribe(listener: (sample: PitchSample | null) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Simula que suena una nota. */
  emit(sample: PitchSample | null): void {
    for (const listener of this.#listeners) {
      listener(sample);
    }
  }
}

describe('Afinador', () => {
  let engine: FakeEngine;

  beforeEach(() => {
    engine = new FakeEngine();
    useSessionStore.getState().actions.reset();
  });

  afterEach(cleanup);

  function renderTuner(outcome: AudioInputState = 'running') {
    const input = new FakeInput(outcome);
    render(<Tuner createInput={() => input} createEngine={() => engine} />);
    return input;
  }

  it('explica para qué quiere el micrófono antes de pedirlo', () => {
    renderTuner();

    expect(screen.getByText(/necesitamos el micrófono/i)).toBeInTheDocument();
    expect(screen.getByText(/no sale de tu equipo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toBeInTheDocument();
  });

  it('empieza a escuchar al pulsar el botón', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(screen.getByText(/esperando a que suene algo/i)).toBeInTheDocument();
    expect(engine.running).toBe(true);
  });

  it('enseña la nota que suena y dice que está afinada', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 });

    expect(await screen.findByText('La')).toBeInTheDocument();
    // Exacto a propósito: el mismo consejo aparece también en la región viva,
    // en una frase más larga para el lector de pantalla.
    expect(screen.getByText('Está afinada')).toBeInTheDocument();
    expect(screen.getByText(/cuerda 5\.ª al aire/i)).toBeInTheDocument();
  });

  it('anuncia la nota y el consejo en una sola frase para el lector de pantalla', async () => {
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: /escuchar la guitarra/i })[0]!);

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 });

    // Hay que esperar a que React pinte el cambio antes de leer el DOM: la
    // emisión del motor viene de fuera del ciclo de render.
    await screen.findByText('La');

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('La2, está afinada.');
  });

  it('dice hacia dónde corregir cuando la nota está alta', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    // Veinte cents por encima de la quinta al aire.
    engine.emit({
      frequency: midiToFrequency(45) * Math.pow(2, 20 / 1200),
      clarity: 0.99,
      rms: 0.2,
      at: 0,
    });

    expect(await screen.findByText('Suena alta: afloja')).toBeInTheDocument();
  });

  it('avisa cuando la señal no llega limpia', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.91, rms: 0.2, at: 0 });

    expect(await screen.findByText(/no llega limpia/i)).toBeInTheDocument();
  });

  it('mantiene la nota en pantalla cuando deja de sonar, apagada', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 });
    expect(await screen.findByText('La')).toBeInTheDocument();

    engine.emit(null);

    // El afinador no desaparece: sigue enseñando la última nota y avisa de que
    // ya no hay señal.
    expect(await screen.findByText(/sin señal/i)).toBeInTheDocument();
    expect(screen.getByText('La')).toBeInTheDocument();
    expect(screen.queryByText(/esperando a que suene algo/i)).not.toBeInTheDocument();
  });

  it('solo espera antes de la primera nota', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(screen.getByText(/esperando a que suene algo/i)).toBeInTheDocument();
  });

  it('explica qué hacer si se deniega el permiso', async () => {
    renderTuner('denied');
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has denegado el acceso/i);
    expect(engine.running).toBe(false);
  });

  it('permite dejar de escuchar', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    await userEvent.click(screen.getByRole('button', { name: /dejar de escuchar/i }));

    expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toBeInTheDocument();
    expect(engine.running).toBe(false);
  });
});
