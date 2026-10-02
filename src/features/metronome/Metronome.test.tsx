// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Metronome as MetronomeEngine, MetronomeOptions } from '@audio/metronome';

import { useClaqueta } from '@state/claqueta';
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
  useClaqueta.setState({ enLaToma: false });
});

function renderMetronome() {
  const engine = new FakeMetronome();
  const view = render(<Metronome createMetronome={() => engine} />);
  return { engine, view };
}

/**
 * **Mientras hay toma, el de la barra se aparta.** Dos metrónomos a la vez son
 * dos pulsos que no coinciden, y cambiar el tempo a mitad dejaría lo grabado en
 * una rejilla y lo tocado en otra.
 */
describe('con una toma sonando', () => {
  it('se calla, y no deja ponerlo ni cambiar el tempo', async () => {
    const { engine } = renderMetronome();
    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    await screen.findByRole('button', { name: /^clic del metrónomo/i });
    expect(engine.running).toBe(true);

    act(() => {
      useClaqueta.getState().acciones.marcarToma(true);
    });

    expect(engine.running).toBe(false);
    const clic = screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i });
    expect(clic).toBeDisabled();
    expect(clic).toHaveAttribute('aria-pressed', 'false');
    expect(clic).toHaveAttribute('title', 'La toma lleva su propio clic');
    expect(screen.getByRole('button', { hidden: true, name: /^100 bpm/ })).toBeDisabled();

    // Y no vuelve solo al acabar la toma.
    act(() => {
      useClaqueta.getState().acciones.marcarToma(false);
    });
    expect(engine.running).toBe(false);
    expect(clic).not.toBeDisabled();
  });

  it('sin haberlo puesto nunca, tampoco revienta', () => {
    renderMetronome();
    act(() => {
      useClaqueta.getState().acciones.marcarToma(true);
    });
    expect(
      screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }),
    ).toBeDisabled();
  });
});

describe('Metrónomo', () => {
  it('arranca y para con el mismo botón', async () => {
    const { engine } = renderMetronome();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    expect(await screen.findByRole('button', { name: /^clic del metrónomo/i })).toBeInTheDocument();
    expect(engine.running).toBe(true);

    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    expect(engine.running).toBe(false);
  });

  it('arranca con el tempo y el compás que se ven en pantalla', async () => {
    const { engine } = renderMetronome();

    fireEvent.change(screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i }), {
      target: { value: '132' },
    });
    fireEvent.change(screen.getByRole('combobox', { hidden: true, name: /compás/i }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    await screen.findByRole('button', { name: /^clic del metrónomo/i });

    expect(engine.options?.bpm).toBe(132);
    expect(engine.options?.beatsPerBar).toBe(3);
  });

  it('cambia la velocidad sin cortar el pulso', async () => {
    const { engine } = renderMetronome();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    await screen.findByRole('button', { name: /^clic del metrónomo/i });
    fireEvent.click(screen.getByRole('button', { hidden: true, name: /dos pulsos más/i }));

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
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });

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
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });

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
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '1' } });
    fireEvent.blur(campo);

    expect(campo).toHaveValue(30);
  });

  // Y si se borra y se va sin escribir nada, se vuelve al que había: un campo
  // vacío no es un tempo de cero.
  it('borrarlo y salir devuelve el tempo que habia', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '' } });
    fireEvent.blur(campo);

    expect(campo).toHaveValue(100);
  });

  // Los botones mandan sobre lo que hubiera escrito a medias: si no, pulsar «+»
  // no movería el número que se ve.
  it('los botones ganan a lo que quedara escrito', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { hidden: true, name: /dos pulsos más/i }));

    expect(campo).toHaveValue(102);
  });

  it('se calla al salir de la pantalla', () => {
    const { engine, view } = renderMetronome();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    view.unmount();

    expect(engine.disposed).toBe(true);
  });
});

describe('Los ajustes de dos en dos', () => {
  it('suben y bajan sin tener que escribir', () => {
    // Con la guitarra en las manos, escribir un número es soltar la púa.
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });
    fireEvent.change(campo, { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Dos pulsos más' }));
    expect(campo).toHaveValue(102);

    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Dos pulsos menos' }));
    expect(campo).toHaveValue(100);
  });
});

describe('Cambiar de compás mientras suena', () => {
  it('vuelve a arrancar con el compás nuevo, sin tener que pararlo', async () => {
    const { engine } = renderMetronome();
    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));
    await screen.findByRole('button', { name: /^clic del metrónomo/i });

    fireEvent.change(screen.getByRole('combobox', { hidden: true, name: /compás/i }), {
      target: { value: '3' },
    });

    expect(engine.options?.beatsPerBar).toBe(3);
    expect(engine.running).toBe(true);
  });

  it('parado, solo se guarda para la próxima vez', () => {
    const { engine } = renderMetronome();

    fireEvent.change(screen.getByRole('combobox', { hidden: true, name: /compás/i }), {
      target: { value: '3' },
    });

    expect(engine.running).toBe(false);
    expect(screen.getByRole('combobox', { hidden: true, name: /compás/i })).toHaveValue('3');
  });
});

describe('La luz del pulso', () => {
  it('se dice también con palabras, para quien no ve los puntos', async () => {
    // Los puntos son `aria-hidden`: quien toca con auriculares los mira, y quien
    // no ve la pantalla necesita la frase.
    renderMetronome();

    expect(screen.getByText('Metrónomo parado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }));

    expect(await screen.findByText(/Metrónomo a \d+ pulsos por minuto/)).toBeInTheDocument();
  });
});

describe('los puntos del compás', () => {
  /**
   * Un punto por pulso, y el primero de cada compás distinto: es lo que deja
   * seguir dónde cae el uno sin contar. Parado no se enciende ninguno, que si
   * no parecería que sigue sonando.
   */
  it('el uno se distingue del resto, y parado no se enciende ninguno', async () => {
    const { engine, view } = renderMetronome();
    await fireEvent.click(
      screen.getByRole('button', { hidden: true, name: /^clic del metrónomo/i }),
    );

    act(() => engine.options?.onBeat?.(0));
    expect(view.container.querySelectorAll('.bg-brass-bright')).toHaveLength(1);

    act(() => engine.options?.onBeat?.(2));
    expect(view.container.querySelectorAll('.bg-brass-bright')).toHaveLength(0);
    expect(view.container.querySelectorAll('.bg-text-muted')).toHaveLength(1);
  });

  // Y con Intro se cierra lo escrito sin salir del campo.
  it('Intro cierra el tempo escrito', () => {
    renderMetronome();
    const campo = screen.getByRole('spinbutton', { hidden: true, name: /pulsos por minuto/i });

    fireEvent.change(campo, { target: { value: '132' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(useSessionStore.getState().bpm).toBe(132);
  });
});

/**
 * En la barra van dos pastillas: «Clic» y el tempo, que abre el resto. Entero,
 * en un teléfono partía la barra de componer en dos filas.
 */
describe('En la barra', () => {
  it('el clic dice su nombre a la vista, y no es solo un triangulo', () => {
    renderMetronome();

    expect(screen.getByRole('button', { name: 'Clic del metrónomo' })).toHaveTextContent('Clic');
  });

  it('el tempo abre el panel donde se cambia, y el compas va dentro', () => {
    const { view } = renderMetronome();
    const tempo = screen.getByRole('button', { name: '100 bpm, tempo y compás' });
    const panel = view.container.querySelector('[popover]')!;

    // El nombre empieza por lo que se ve (WCAG 2.5.3): quien lo pide con la voz
    // dice «100 bpm», que es lo que lee en el botón.
    expect(tempo).toHaveTextContent('100 bpm');
    expect(tempo.getAttribute('aria-label')!.startsWith(tempo.textContent!.trim())).toBe(true);
    expect(tempo.getAttribute('popovertarget')).toBe(panel.id);
    expect(panel).toContainElement(screen.getByRole('combobox', { hidden: true, name: /compás/i }));
  });
});

/**
 * **El panel parece modal y no lo es**: lleva velo, y el tabulador salía de él
 * por detrás hasta los controles tapados. Ahora salir con el foco lo cierra.
 */
describe('El panel del tempo', () => {
  it('se cierra cuando el foco sale de el', () => {
    const { view } = renderMetronome();
    const panel = view.container.querySelector<HTMLElement>('[popover]')!;
    const cerrar = vi.fn();
    Object.assign(panel, { hidePopover: cerrar });

    fireEvent.blur(screen.getByRole('button', { hidden: true, name: 'Dos pulsos más' }), {
      relatedTarget: screen.getByRole('button', { name: 'Clic del metrónomo' }),
    });

    expect(cerrar).toHaveBeenCalled();
  });
});
