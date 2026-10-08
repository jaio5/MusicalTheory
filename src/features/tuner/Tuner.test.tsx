// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioInput, AudioInputError, AudioInputState } from '@audio/audio-input';
import type { PitchEngine, PitchSample } from '@audio/pitch-engine';
import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';
import { midiToFrequency } from '@core/music';

import type * as PanelDeUi from '@ui/Panel';

import { useMicrofono } from '@state/microfono';
import { Tuner } from './Tuner';

/**
 * Cuántas veces se pinta el marco del afinador, que es lo que pinta el `Tuner`
 * de fuera. Se cuenta envolviendo `Panel`: solo se repinta si se repinta él.
 */
const marco = vi.hoisted(() => ({ pintado: 0 }));
vi.mock('@ui/Panel', async (original) => {
  const { createElement } = await import('react');
  const real = await original<typeof PanelDeUi>();
  return {
    ...real,
    Panel: (props: Parameters<typeof real.Panel>[0]) => {
      marco.pintado += 1;
      return createElement(real.Panel, props);
    },
  };
});

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

  readonly spectrumSize = 8192;

  readSpectrum(target: Float32Array<ArrayBuffer>): boolean {
    target.fill(-120);

    return this.state === 'running';
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

  #levelListeners = new Set<(rms: number) => void>();

  subscribeLevel(listener: (rms: number) => void): () => void {
    this.#levelListeners.add(listener);
    return () => this.#levelListeners.delete(listener);
  }

  /** Simula el nivel que entra, haya nota o no. */
  emitLevel(rms: number): void {
    for (const listener of this.#levelListeners) {
      listener(rms);
    }
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
  });

  function renderTuner(outcome: AudioInputState = 'running') {
    const input = new FakeInput(outcome);
    render(<Tuner createInput={() => input} createEngine={() => engine} />);
    return input;
  }

  it('explica para qué quiere el micrófono antes de pedirlo', () => {
    renderTuner();

    expect(screen.getByText(/necesitamos oírte para afinarte/i)).toBeInTheDocument();
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

    expect(await screen.findByText('A')).toBeInTheDocument();
    // Exacto a propósito: el mismo consejo aparece también en la región viva,
    // en una frase más larga para el lector de pantalla.
    expect(screen.getByText('Está afinada')).toBeInTheDocument();
    expect(screen.getByText(/cuerda 5\.ª al aire/i)).toBeInTheDocument();
  });

  /**
   * A 1440 × 900 «Dejar de escuchar» quedaba bajo el borde: la nota, a 160 px,
   * heredaba el interlineado del cuerpo y se llevaba ochenta de aire, y crecía
   * con el ancho sin mirar el alto.
   */
  it('la nota no se lleva aire de más, y en ancho crece también con el alto', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 });

    const nota = (await screen.findByText('A')).closest('span')!;
    expect(nota).toHaveClass('leading-none', 'xl:text-[min(10rem,14dvh)]');
  });

  /** Apagado mide lo que dice: llegó a ser una tarjeta de 1300 × 740 para tres líneas. */
  it('apagado no se estira a lo alto de la ventana', () => {
    renderTuner();

    // Ninguna caja por encima del aviso reserva alto: lo pone lo que lleva dentro.
    const cajas: string[] = [];
    for (let el = screen.getByText(/necesitamos oírte/i).parentElement; el; el = el.parentElement) {
      cajas.push(el.className);
    }
    expect(cajas.filter((clases) => /min-h-\[/.test(clases))).toEqual([]);
  });

  it('anuncia la nota y el consejo en una sola frase para el lector de pantalla', async () => {
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: /escuchar la guitarra/i })[0]!);

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 });

    // Hay que esperar a que React pinte el cambio antes de leer el DOM: la
    // emisión del motor viene de fuera del ciclo de render.
    await screen.findByText('A');

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('A2, está afinada.');
  });

  /**
   * **Lo que llega del motor no repinta el marco.** Leído arriba, cada lectura
   * —veinte por segundo— repintaba el panel entero, el botón de parar y la lista
   * de micrófonos, para mover una aguja. Lo lee quien lo enseña.
   */
  it('lo que llega veinte veces por segundo no repinta el marco', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 }));
    await screen.findByText('A');
    const antes = marco.pintado;

    // La misma nota con otros cents, y el nivel subiendo y bajando: la aguja y
    // el medidor se mueven, la frase de la región viva no cambia.
    for (const [cents, rms] of [
      [3, 0.18],
      [-2, 0.22],
      [1, 0.2],
    ] as const) {
      act(() =>
        engine.emit({
          frequency: midiToFrequency(45) * 2 ** (cents / 1200),
          clarity: 0.99,
          rms,
          at: 0,
        }),
      );
      act(() => engine.emitLevel(rms));
    }

    expect(screen.getByText(/\+1,0 cents · 110,\d Hz/)).toBeInTheDocument();
    expect(marco.pintado).toBe(antes);
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

    // Y es lo segundo más grande de la pantalla, pegado a la nota: lo que hay
    // que hacer iba a 18 px bajo una letra de 160 y caía bajo el pliegue.
    const consejo = await screen.findByText('Suena alta: afloja');
    expect(consejo).toHaveClass('text-3xl', 'font-semibold');
  });

  // Quedaban «Sin señal» y «+36 cents · Suena alta: afloja» a la vez, y lo
  // segundo era de hace un rato: sin señal, la instrucción y los cents se vacían.
  it('sin señal, no queda una instrucción vieja debajo del aviso', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    engine.emit({
      frequency: midiToFrequency(45) * Math.pow(2, 20 / 1200),
      clarity: 0.99,
      rms: 0.2,
      at: 0,
    });
    expect(await screen.findByText('Suena alta: afloja')).toBeInTheDocument();

    engine.emit(null);

    expect(await screen.findByText(/sin señal/i)).toBeInTheDocument();
    expect(screen.queryByText('Suena alta: afloja')).not.toBeInTheDocument();
    expect(screen.queryByText(/cents ·/)).not.toBeInTheDocument();
  });

  it('avisa cuando la señal no llega limpia', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.91, rms: 0.2, at: 0 });

    expect(await screen.findByText(/no llega limpia/i)).toBeInTheDocument();
  });

  /**
   * **El hueco del aviso no se monta ni se desmonta.** Lo hacía cada vez que la
   * señal se ensuciaba o se iba, y todo lo de debajo saltaba: era la mitad del
   * CLS de afinar. Tiene que ser el mismo nodo, con texto o sin él.
   */
  it('el aviso vive siempre en el mismo sitio, haya aviso o no', async () => {
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    act(() => engine.emitLevel(0.2));
    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 }));
    await screen.findByText('A');
    const hueco = container.querySelector('p.min-h-12.md\\:min-h-6');
    await waitFor(() => expect(hueco).toBeEmptyDOMElement());

    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.91, rms: 0.2, at: 0 }));
    await waitFor(() => expect(hueco).toHaveTextContent(/no llega limpia/i));

    act(() => engine.emit(null));
    await waitFor(() => expect(hueco).toHaveTextContent(/sin señal/i));
    expect(hueco?.isConnected).toBe(true);
  });

  it('mantiene la nota en pantalla cuando deja de sonar, apagada', async () => {
    renderTuner();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 });
    expect(await screen.findByText('A')).toBeInTheDocument();

    engine.emit(null);

    // El afinador no desaparece: sigue enseñando la última nota y avisa de que
    // ya no hay señal.
    expect(await screen.findByText(/sin señal/i)).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
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

describe('medidor de nivel', () => {
  it('enseña cuánta señal entra aunque no haya nota', async () => {
    const engine = new FakeEngine();
    render(<Tuner createInput={() => new FakeInput()} createEngine={() => engine} />);
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emitLevel(0.05);

    const meter = await screen.findByRole('meter', { name: /nivel de la señal/i });
    expect(meter).toBeInTheDocument();
    // El número va por detrás de la barra, a cuatro refrescos por segundo.
    await waitFor(() => expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0));
    // Y ya no escribe su propia frase: el único aviso de nivel es el de la espera.
    expect(screen.queryByText(/señal de sobra/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/te oigo/i)).toBeInTheDocument();
  });

  it('avisa cuando llega poca señal, que es lo que no se podía saber antes', async () => {
    const engine = new FakeEngine();
    render(<Tuner createInput={() => new FakeInput()} createEngine={() => engine} />);
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emitLevel(0.0005);

    expect(await screen.findByText(/sube el volumen/i)).toBeInTheDocument();
    expect(screen.queryByText(/llega poca señal/i)).not.toBeInTheDocument();
  });

  /**
   * **Un solo aviso a la vez, por prioridad.** Con una nota limpia delante salían
   * «llega poca señal» y «no llega limpia» juntos, y cada uno cambiaba por su
   * cuenta: sin señal manda sobre suciedad, y suciedad sobre poca señal.
   */
  it('con nota en pantalla dice una sola cosa, la que más importa', async () => {
    const engine = new FakeEngine();
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    const hueco = () => container.querySelector('p.min-h-12.md\\:min-h-6');

    // Poca señal, con la nota limpia.
    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 }));
    await waitFor(() => expect(hueco()).toHaveTextContent(/llega poca señal/i));

    // Suciedad y poca señal a la vez: manda la suciedad.
    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.9, rms: 0.2, at: 0 }));
    await waitFor(() => expect(hueco()).toHaveTextContent(/no llega limpia/i));
    expect(hueco()).not.toHaveTextContent(/poca señal/i);

    // Y sin señal manda sobre las dos.
    act(() => engine.emit(null));
    await waitFor(() => expect(hueco()).toHaveTextContent(/sin señal/i));
    expect(hueco()).not.toHaveTextContent(/no llega limpia/i);
  });

  /**
   * **Un instante sucio no es una señal sucia.** El ataque y la cola de una nota
   * limpia bajan la claridad un momento, y como el aviso entraba en el primer
   * fotograma, salía al lado de «Está afinada» con la cuerda perfecta.
   */
  it('un instante sucio en una nota limpia no avisa', async () => {
    const engine = new FakeEngine();
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    act(() => engine.emitLevel(0.2));

    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.85, rms: 0.2, at: 0 }));
    // Un fotograma después, como llegan del motor: veinte por segundo.
    await act(() => new Promise((listo) => setTimeout(listo, 50)));
    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 50 }));
    await act(() => new Promise((listo) => setTimeout(listo, 700)));

    expect(screen.getByText('Está afinada')).toBeInTheDocument();
    expect(container.querySelector('p.min-h-12.md\\:min-h-6')).toBeEmptyDOMElement();
  });

  // Entre los dos umbrales no cambia nada: 0,94 ni ensucia ni limpia.
  it('una claridad entre los dos umbrales no ensucia una señal limpia', async () => {
    const engine = new FakeEngine();
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    act(() => engine.emitLevel(0.2));

    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.94, rms: 0.2, at: 0 }));
    await screen.findByText('A');
    await waitFor(() =>
      expect(container.querySelector('p.min-h-12.md\\:min-h-6')).toBeEmptyDOMElement(),
    );
    expect(screen.queryByText(/no llega limpia/i)).not.toBeInTheDocument();
  });

  // La zona de la nota está reservada desde el «esperando», invisible y fuera del
  // árbol de accesibilidad: la tarjeta no crece al enganchar la primera nota.
  it('reserva la zona de la nota desde el esperando, sin enseñarla ni leerla', async () => {
    const engine = new FakeEngine();
    const { container } = render(
      <Tuner createInput={() => new FakeInput()} createEngine={() => engine} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    const reserva = container.querySelector('.invisible');
    expect(reserva).toHaveAttribute('aria-hidden', 'true');
    expect(reserva).toHaveAttribute('inert');
    // Y hay un solo medidor para quien lo lee.
    expect(screen.getAllByRole('meter')).toHaveLength(1);

    act(() => engine.emit({ frequency: midiToFrequency(45), clarity: 0.99, rms: 0.2, at: 0 }));
    await screen.findByText('A');
    expect(container.querySelector('.invisible')).toBeNull();
  });

  /**
   * Con señal entrando no se puede decir «esperando a que suene algo»: algo
   * está sonando, y el medidor lo enseña dos líneas más abajo. Se veía
   * rasgueando un acorde al afinador —el motor de tono es monofónico, así que
   * no saca ninguna nota— y las dos frases se contradecían en la misma
   * pantalla.
   */
  it('con senal y sin nota dice que oye y no engancha, no que espera', async () => {
    const engine = new FakeEngine();
    render(<Tuner createInput={() => new FakeInput()} createEngine={() => engine} />);
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    engine.emitLevel(0.05);

    expect(await screen.findByText(/no engancho la nota/i)).toBeInTheDocument();
    expect(screen.queryByText(/esperando a que suene algo/i)).not.toBeInTheDocument();
    // Y dice por qué pasa casi siempre, que es lo único accionable.
    expect(screen.getByText(/una sola al aire/i)).toBeInTheDocument();
  });
});

describe('mientras el navegador decide', () => {
  /**
   * Entre pulsar y que conteste pasa un rato, y en ese rato el botón lo dice y
   * no se puede volver a pulsar: dos peticiones seguidas dejan dos micrófonos
   * abiertos en algunos navegadores.
   */
  it('el boton dice que se esta pidiendo permiso, y no se puede repulsar', async () => {
    class EntradaLenta extends FakeInput {
      override async start(): Promise<void> {
        await new Promise(() => {});
      }
    }
    render(<Tuner createInput={() => new EntradaLenta()} createEngine={() => new FakeEngine()} />);

    const boton = screen.getByRole('button', { name: /escuchar la guitarra/i });
    await userEvent.click(boton);

    const pidiendo = await screen.findByRole('button', { name: /pidiendo permiso/i });
    // **Trabaja sin apagarse**: con `disabled` soltaba el foco justo después de
    // pulsarlo. Con `aria-disabled` el clic se ignora igual.
    expect(pidiendo).toHaveAttribute('aria-disabled', 'true');
    expect(pidiendo).toHaveFocus();
  });
});

/**
 * **El foco no se cae al abrir ni al cerrar el micro.** Cada botón vive en su
 * pantalla, y al pulsarlo la suya se cambia por la otra: el foco se iba con él al
 * `<body>`. Ahora pasa al botón equivalente de la que llega.
 */
describe('el foco al abrir y cerrar el micro', () => {
  it('pasa de «Escuchar la guitarra» a «Dejar de escuchar», y vuelve', async () => {
    render(<Tuner createInput={() => new FakeInput()} createEngine={() => new FakeEngine()} />);
    const escuchar = screen.getByRole('button', { name: /escuchar la guitarra/i });
    escuchar.focus();

    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: /dejar de escuchar/i })).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: /escuchar la guitarra/i })).toHaveFocus();
  });

  // Traer «Dejar de escuchar» a la vista empujaba la nota fuera de la pantalla
  // por arriba en una ventana de 600 px: el foco pasa sin desplazar nada.
  it('y lo hace sin desplazar la pantalla', async () => {
    const enfocar = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<Tuner createInput={() => new FakeInput()} createEngine={() => new FakeEngine()} />);
    screen.getByRole('button', { name: /escuchar la guitarra/i }).focus();

    await userEvent.keyboard('{Enter}');
    await screen.findByRole('button', { name: /dejar de escuchar/i });

    expect(enfocar).toHaveBeenLastCalledWith({ preventScroll: true });
    enfocar.mockRestore();
  });

  // Si el permiso se deniega, el botón sigue en su sitio y con el foco: no se
  // mueve a ningún otro.
  it('si se deniega, el foco sigue donde estaba', async () => {
    render(
      <Tuner createInput={() => new FakeInput('denied')} createEngine={() => new FakeEngine()} />,
    );
    const escuchar = screen.getByRole('button', { name: /escuchar la guitarra/i });
    escuchar.focus();

    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toHaveFocus();
  });
});

describe('a cuántos semitonos está la cuerda', () => {
  /**
   * Un motor nuevo por llamada, y el micro solo se abre si estaba cerrado: la
   * escucha vive en el estado de sesión y sigue abierta de un pintado a otro.
   */
  async function oyendo(midi: number) {
    const engine = new FakeEngine();
    render(<Tuner createInput={() => new FakeInput()} createEngine={() => engine} />);
    const abrir = screen.queryByRole('button', { name: /escuchar la guitarra/i });
    if (abrir !== null) {
      await userEvent.click(abrir);
    }
    engine.emit({ frequency: midiToFrequency(midi), clarity: 0.99, rms: 0.2, at: 0 });
  }

  /**
   * Con la cuerda al aire no se dice «a 0 semitonos», y con uno solo va en
   * singular: es lo que se lee mientras se gira la clavija, y un «a 1 semitonos
   * por encima» delata que nadie ha mirado la pantalla afinando.
   */
  it('al aire se dice al aire', async () => {
    await oyendo(45);

    expect(await screen.findByText(/al aire/)).toBeInTheDocument();
  });

  it('y uno solo va en singular', async () => {
    await oyendo(46);

    expect(await screen.findByText(/^1 semitono por/)).toBeInTheDocument();
  });

  it('y por debajo, y en plural', async () => {
    await oyendo(43);

    expect(await screen.findByText(/^2 semitonos por debajo de la cuerda/)).toBeInTheDocument();
  });
});

/**
 * **El micrófono se elige en la barra, y el afinador abre ése.** Tenía su propio
 * desplegable, con un estado suyo que no sabía nadie más: componer abría el del
 * sistema, y al recargar se olvidaba. Ahora hay una sola elección.
 */
describe('el micrófono del afinador', () => {
  const DEVICES = [
    { deviceId: 'default', kind: 'audioinput', label: 'Micro del portátil', groupId: 'a' },
    { deviceId: 'scarlett', kind: 'audioinput', label: 'Focusrite Scarlett', groupId: 'b' },
  ] as MediaDeviceInfo[];

  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { enumerateDevices: async () => DEVICES } },
    });
  });

  afterEach(() => {
    useMicrofono.setState({ elegido: null, cargado: false, cayo: false });
  });

  it('abre el elegido para toda la aplicación, y no tiene un selector suyo', async () => {
    useMicrofono.setState({ elegido: 'scarlett', cargado: true });
    const opened: Array<string | undefined> = [];
    render(
      <Tuner
        createInput={(deviceId) => {
          opened.push(deviceId);
          return new FakeInput();
        }}
        createEngine={() => new FakeEngine()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    await screen.findByRole('button', { name: /dejar de escuchar/i });

    expect(opened).toEqual(['scarlett']);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
