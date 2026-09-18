// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Metronome as MetronomeEngine, MetronomeOptions } from '@audio/metronome';

import { useSessionStore } from '@state/session-store';

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

// El tempo vive en el store y no se rehace entre pruebas: sin esto, la que sube
// a 102 le deja el tempo puesto a la siguiente.
beforeEach(() => {
  useSessionStore.getState().actions.setTempo(100, 4);
});

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

  /**
   * Se acota **al salir del campo, no en cada tecla**. Acotando al teclear, el
   * campo no se podía escribir: al borrarlo saltaba al mínimo y el dígito
   * siguiente se escribía detrás.
   */
  it('no deja pasar de lo que se puede seguir', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '9000' } });
    fireEvent.blur(campo);

    expect(campo).toHaveValue(300);
  });

  /**
   * Escribir un tempo, dígito a dígito, como se escribe de verdad.
   *
   * Es un fallo que se vio tecleando y ningún test cazaba: el campo iba pegado al
   * store y cada pulsación pasaba por el acotado, así que «130» se tecleaba como
   * «301» y quedaba en 300. Cualquier tempo que no saliera de los botones era
   * inalcanzable.
   */
  it('se puede escribir un tempo digito a digito', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '' } });
    expect(campo).toHaveValue(null);

    // Un «1» a medio escribir no es un tempo de 1: es un tempo sin terminar, así
    // que se queda en pantalla y no sube al store.
    fireEvent.change(campo, { target: { value: '1' } });
    expect(campo).toHaveValue(1);
    expect(useSessionStore.getState().bpm).toBe(100);

    fireEvent.change(campo, { target: { value: '13' } });
    fireEvent.change(campo, { target: { value: '130' } });

    expect(campo).toHaveValue(130);
    expect(useSessionStore.getState().bpm).toBe(130);
  });

  // Al salir, lo que quedó a medias se acota: un «1» escrito y abandonado no
  // puede dejar el metrónomo en un tempo que no existe.
  it('lo que queda a medias se acota al salir del campo', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '1' } });
    fireEvent.blur(campo);

    expect(campo).toHaveValue(30);
  });

  // Y si se borra y se va sin escribir nada, se vuelve al que había: un campo
  // vacío no es un tempo de cero.
  it('borrarlo y salir devuelve el tempo que habia', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '' } });
    fireEvent.blur(campo);

    expect(campo).toHaveValue(100);
  });

  // Los botones mandan sobre lo que hubiera escrito a medias: si no, pulsar «+»
  // no movería el número que se ve.
  it('los botones ganan a lo que quedara escrito', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /dos pulsos más/i }));

    expect(campo).toHaveValue(102);
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
