// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('Marcar el tempo con el dedo', () => {
  /**
   * Es como se saca de verdad el tempo de una canción que suena en la cabeza:
   * nadie sabe decir «ciento treinta y dos», pero cualquiera lo marca con el
   * dedo. Se prueba moviendo el reloj a mano, porque `performance.now()` es lo
   * que lee.
   */
  it('cuatro golpes al mismo ritmo ponen ese tempo', () => {
    const reloj = vi.spyOn(performance, 'now');
    // Un golpe cada medio segundo son 120 pulsos por minuto.
    let t = 0;
    reloj.mockImplementation(() => (t += 500));
    renderMetronome();

    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Marcar' }));
    }

    expect(screen.getByRole('spinbutton', { name: /pulsos por minuto/i })).toHaveValue(120);
    reloj.mockRestore();
  });

  it('un golpe suelto no cambia nada', () => {
    // Con uno no hay intervalo que medir, y cambiar el tempo por un clic
    // accidental sería peor que no hacer nada.
    renderMetronome();
    const antes = (
      screen.getByRole('spinbutton', { name: /pulsos por minuto/i }) as HTMLInputElement
    ).value;

    fireEvent.click(screen.getByRole('button', { name: 'Marcar' }));

    expect(screen.getByRole('spinbutton', { name: /pulsos por minuto/i })).toHaveValue(
      Number(antes),
    );
  });
});

describe('Los ajustes de dos en dos', () => {
  it('suben y bajan sin tener que escribir', () => {
    // Con la guitarra en las manos, escribir un número es soltar la púa.
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { name: /pulsos por minuto/i });
    fireEvent.change(campo, { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: 'Dos pulsos más' }));
    expect(campo).toHaveValue(102);

    fireEvent.click(screen.getByRole('button', { name: 'Dos pulsos menos' }));
    expect(campo).toHaveValue(100);
  });
});

describe('Cambiar de compás mientras suena', () => {
  it('vuelve a arrancar con el compás nuevo, sin tener que pararlo', async () => {
    const { engine } = renderMetronome();
    fireEvent.click(screen.getByRole('button', { name: /poner el metrónomo/i }));
    await screen.findByRole('button', { name: /parar el metrónomo/i });

    fireEvent.change(screen.getByRole('combobox', { name: /compás/i }), { target: { value: '3' } });

    expect(engine.options?.beatsPerBar).toBe(3);
    expect(engine.running).toBe(true);
  });

  it('parado, solo se guarda para la próxima vez', () => {
    const { engine } = renderMetronome();

    fireEvent.change(screen.getByRole('combobox', { name: /compás/i }), { target: { value: '3' } });

    expect(engine.running).toBe(false);
    expect(screen.getByRole('combobox', { name: /compás/i })).toHaveValue('3');
  });
});

describe('La luz del pulso', () => {
  it('se dice también con palabras, para quien no ve los puntos', async () => {
    // Los puntos son `aria-hidden`: quien toca con auriculares los mira, y quien
    // no ve la pantalla necesita la frase.
    renderMetronome();

    expect(screen.getByText('Metrónomo parado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /poner el metrónomo/i }));

    expect(await screen.findByText(/Metrónomo a \d+ pulsos por minuto/)).toBeInTheDocument();
  });
});
