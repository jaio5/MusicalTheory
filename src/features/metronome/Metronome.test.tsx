// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Metronome as MetronomeEngine, MetronomeOptions } from '@audio/metronome';

import { Metronome } from './Metronome';

class FakeMetronome implements MetronomeEngine {
  running = false;
  options: MetronomeOptions | null = null;
  bpmChanges: number[] = [];
  disposed = false;

  async start(options: MetronomeOptions): Promise<void> {
    this.options = options;
    this.running = true;
  }

  setBpm(bpm: number): void {
    this.bpmChanges.push(bpm);
  }

  stop(): void {
    this.running = false;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.running = false;
  }
}

function renderMetronome() {
  const engine = new FakeMetronome();
  const view = render(<Metronome createMetronome={() => engine} />);
  return { engine, view };
}

describe('Metrónomo', () => {
  it('arranca y para con el mismo botón', async () => {
    const { engine } = renderMetronome();

    fireEvent.click(screen.getByRole('button', { name: /poner el metrónomo/i }));
    expect(await screen.findByRole('button', { name: /parar el metrónomo/i })).toBeInTheDocument();
    expect(engine.running).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /parar el metrónomo/i }));
    expect(engine.running).toBe(false);
  });

  it('arranca con el tempo y el compás que se ven en pantalla', async () => {
    const { engine } = renderMetronome();

    fireEvent.change(screen.getByRole('spinbutton', { name: /pulsos por minuto/i }), {
      target: { value: '132' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /compás/i }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /poner el metrónomo/i }));
    await screen.findByRole('button', { name: /parar el metrónomo/i });

    expect(engine.options?.bpm).toBe(132);
    expect(engine.options?.beatsPerBar).toBe(3);
  });

  it('cambia la velocidad sin cortar el pulso', async () => {
    const { engine } = renderMetronome();

    fireEvent.click(screen.getByRole('button', { name: /poner el metrónomo/i }));
    await screen.findByRole('button', { name: /parar el metrónomo/i });
    fireEvent.click(screen.getByRole('button', { name: /dos pulsos más/i }));

    expect(engine.bpmChanges.at(-1)).toBe(102);
    expect(engine.running).toBe(true);
  });

  it('no deja pasar de lo que se puede seguir', () => {
    renderMetronome();

    fireEvent.change(screen.getByRole('spinbutton', { name: /pulsos por minuto/i }), {
      target: { value: '9000' },
    });

    expect(screen.getByRole('spinbutton', { name: /pulsos por minuto/i })).toHaveValue(300);
  });

  it('se calla al salir de la pantalla', () => {
    const { engine, view } = renderMetronome();

    fireEvent.click(screen.getByRole('button', { name: /poner el metrónomo/i }));
    view.unmount();

    expect(engine.disposed).toBe(true);
  });
});
