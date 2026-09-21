// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { Metronome, MetronomeOptions } from '@audio/metronome';
import type { PitchEngine } from '@audio/pitch-engine';
import { pitchClassFromName, writtenBlock } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import type { ComposeDeed } from '@core/music';
import { hechosDeComponer } from '@state/hechos-de-componer';
import { useSessionStore } from '@state/session-store';

import { Ensayo } from './Ensayo';

/**
 * Ensayar contra el metrónomo.
 *
 * Aquí no se prueba ni el croma ni el reloj: se prueba **el bucle**. Que sin
 * nada escrito se diga, que al empezar suene el pulso y se encienda el acorde
 * que toca, que lo que se oye en su compás cuente como acertado y que al final
 * salgan los números. Quién decide qué es acertar vive en `core/music/ensayo.ts`
 * y se prueba sin navegador.
 */

class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;
  #oyentes = new Set<(state: AudioInputState) => void>();

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

/** Un metrónomo que no suena: el pulso lo da el test cuando quiere. */
class MetronomoFalso implements Metronome {
  running = false;
  #onBeat: ((beat: number) => void) | undefined;
  #beat = 0;

  async start(options: MetronomeOptions): Promise<void> {
    this.running = true;
    this.#onBeat = options.onBeat;
  }
  setBpm(): void {}
  stop(): void {
    this.running = false;
  }
  async dispose(): Promise<void> {
    this.running = false;
  }
  /** Marca `cuantos` pulsos, como haría el reloj de audio. */
  pulsar(cuantos: number): void {
    for (let i = 0; i < cuantos; i += 1) {
      this.#onBeat?.(this.#beat);
      this.#beat = (this.#beat + 1) % 4;
    }
  }
}

const C = pitchClassFromName('C');
let metronomo = new MetronomoFalso();

const DEPS = {
  createInput: () => new EntradaFalsa(),
  createEngine: () => new MotorFalso(),
  createChordEngine: () => new CromaFalso(),
  createMetronome: () => metronomo,
};

/** Una canción de dos compases: el I y el V. */
function cancion(): void {
  useArrangementStore.setState({
    arrangement: {
      parts: [
        {
          id: 'estrofa',
          name: 'Estrofa',
          blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'V', 4)],
          notes: [],
          bars: 2,
        },
      ],
    },
    past: [],
  });
}

/** Lo que el croma diría al oír ese acorde. */
function suena(root: number, notes: readonly number[]): void {
  useSessionStore.getState().actions.setHeardChord({
    symbol: 'x',
    root: root as never,
    notes: notes as never,
    at: 0,
    score: 0.95,
    margin: 0.3,
    alternatives: [],
  });
}

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  useArrangementStore.setState({ arrangement: { parts: [] }, past: [] });
  metronomo = new MetronomoFalso();
});

describe('Ensayar', () => {
  it('sin tonalidad no se puede, y se dice por que', () => {
    cancion();
    render(<Ensayo deps={DEPS} />);

    expect(screen.getByText(/Elige una tonalidad/)).toBeInTheDocument();
  });

  /**
   * Se pregunta al montaje y no al guion: el guion no existe hasta que se
   * empieza, y mirándolo a él la pantalla decía «no hay nada que ensayar» con la
   * canción escrita delante.
   */
  it('sin nada escrito lo dice, y con algo escrito ofrece ensayar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const { rerender } = render(<Ensayo deps={DEPS} />);

    expect(screen.getByText(/Todavía no hay nada que ensayar/)).toBeInTheDocument();

    cancion();
    rerender(<Ensayo deps={DEPS} />);

    expect(screen.getByRole('button', { name: /^Ensayar$/ })).toBeInTheDocument();
  });

  it('al empezar abre el micro, arranca el pulso y enciende el acorde que toca', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    expect(useSessionStore.getState().listening).toBe('listening');
    expect(metronomo.running).toBe(true);
    // El I de Do mayor es un Do, y el V un Sol: el que toca, grande; el que
    // viene, detrás.
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  /**
   * El bucle entero, sin esperar a nada: el pulso lo da el test. Tocar los dos
   * acordes buenos en su compás son dos aciertos y una racha de dos.
   */
  it('lo que se oye en su compas cuenta, y al final salen los numeros', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      suena(0, [0, 4, 7]); // Do, el I
      metronomo.pulsar(4);
      suena(7, [7, 11, 2]); // Sol, el V
      metronomo.pulsar(4);
    });

    expect(screen.getByText('2 de 2')).toBeInTheDocument();
    expect(screen.getByText(/Racha más larga/)).toBeInTheDocument();
    // Y al terminar se cierra el micro: no se queda abierto mirando una pantalla
    // de resultados.
    expect(useSessionStore.getState().listening).toBe('idle');
  });

  it('lo que no suena se cuenta como fallado, y se dice cual fue', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      suena(0, [0, 4, 7]); // el I sí
      metronomo.pulsar(4);
      suena(5, [5, 9, 0]); // un Fa donde tocaba Sol
      metronomo.pulsar(4);
    });

    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    expect(screen.getByText(/El que se atragantó/)).toBeInTheDocument();
  });

  /**
   * Y llegar tarde no es fallar: cuenta aparte, con su punto ámbar y su frase.
   * Tocar el acorde bueno pasada la mitad del compás es lo que pasa cuando se
   * va detrás del metrónomo, y decirlo es lo que deja arreglarlo.
   */
  it('llegar tarde se cuenta aparte, y se dice', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      // Pasada la mitad del compás: el acorde es el bueno, pero llega tarde.
      metronomo.pulsar(3);
      suena(0, [0, 4, 7]);
      metronomo.pulsar(1);
      suena(7, [7, 11, 2]);
      metronomo.pulsar(4);
    });

    expect(screen.getByText(/llegaron tarde/)).toBeInTheDocument();
  });

  /**
   * Y mientras se toca, cada compás deja su punto: se lee de un vistazo sin
   * apartar la vista del acorde que toca. Verde el que salió, ámbar el que
   * llegó tarde y rojo el que no sonó.
   */
  it('cada compas deja su punto mientras se toca', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    // Primer compás sin tocar nada: se queda en rojo.
    await act(async () => {
      metronomo.pulsar(4);
    });

    expect(screen.getByTitle('Compás 1: fallado')).toBeInTheDocument();
  });

  it('y el que llega tarde deja el suyo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      metronomo.pulsar(3);
      suena(0, [0, 4, 7]);
      metronomo.pulsar(1);
    });

    expect(screen.getByTitle('Compás 1: tarde')).toBeInTheDocument();
  });

  // Y se puede volver a empezar sin salir de la pantalla de resultados.
  it('se puede repetir desde los resultados', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));
    await act(async () => {
      metronomo.pulsar(8);
    });

    await userEvent.click(screen.getByRole('button', { name: /Otra vez/ }));

    expect(await screen.findByRole('button', { name: /Parar/ })).toBeInTheDocument();
  });

  // Ni vidas ni volver al principio: las dos salidas son repetir y repetir más
  // despacio, que es lo que pide un ensayo que no ha salido.
  it('al final no castiga: se repite, o se baja el tempo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));
    await act(async () => {
      metronomo.pulsar(8);
    });

    const antes = useSessionStore.getState().bpm;
    await userEvent.click(screen.getByRole('button', { name: /Diez pulsos más lento/ }));

    expect(useSessionStore.getState().bpm).toBe(antes - 10);
  });
});

/**
 * Ensayar suma a la meta del día, como escribir.
 *
 * Es la otra mitad de [adr/0028](../../../docs/adr/0028-componer-tambien-cuenta.md):
 * el hecho lo emite el bucle, no la pantalla, porque quien sabe que se ha
 * llegado al final es quien lleva la cuenta de los compases.
 */
describe('lo que suma ensayar', () => {
  /** Apunta los hechos que se emitan mientras dure la prueba. */
  function apuntados(): { readonly hechos: ComposeDeed[]; readonly soltar: () => void } {
    const hechos: ComposeDeed[] = [];
    const soltar = hechosDeComponer.suscribir((hecho) => hechos.push(hecho));
    return { hechos, soltar };
  }

  it('tocarla entera y a tiempo cuenta como ensayo limpio', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    const { hechos, soltar } = apuntados();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      suena(0, [0, 4, 7]);
      metronomo.pulsar(4);
      suena(7, [7, 11, 2]);
      metronomo.pulsar(4);
    });
    soltar();

    expect(hechos).toEqual(['ensayo-limpio']);
  });

  // Fallar no descuenta: llegar al final es lo que cuenta, que es la regla que
  // este proyecto ya tomó en aprender.
  it('tocarla entera fallando sigue contando', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    const { hechos, soltar } = apuntados();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      metronomo.pulsar(8);
    });
    soltar();

    expect(hechos).toEqual(['ensayo']);
  });

  it('pararla a la mitad no cuenta', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    const { hechos, soltar } = apuntados();
    render(<Ensayo deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ensayar$/ }));

    await act(async () => {
      suena(0, [0, 4, 7]);
      metronomo.pulsar(4);
    });
    await userEvent.click(screen.getByRole('button', { name: /^Parar$/ }));
    soltar();

    expect(hechos).toEqual([]);
  });
});

describe('el metronomo de verdad', () => {
  /**
   * Sin fábrica se usa el de la aplicación, que abre su propio contexto de
   * audio. En jsdom no hay `AudioContext`, así que no llega a sonar: lo que se
   * comprueba es que el ensayo arranca igual en vez de reventar.
   */
  it('sin fabrica, el ensayo arranca igual', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    const sinMetronomo = {
      createInput: DEPS.createInput,
      createEngine: DEPS.createEngine,
      createChordEngine: DEPS.createChordEngine,
    };
    render(<Ensayo deps={sinMetronomo} />);

    await userEvent.click(screen.getByRole('button', { name: /Ensayar/ }));

    expect(await screen.findByRole('button', { name: /Parar/ })).toBeInTheDocument();
  });
});

describe('cuando el ensayo no llega a empezar', () => {
  /**
   * Sin micro no hay nada que comparar, así que no se empieza: un ensayo que
   * corre el metrónomo y cuenta todo como fallado es peor que no arrancar.
   */
  it('sin motor de escucha no arranca, y el boton vuelve', async () => {
    class EntradaQueNoArranca extends EntradaFalsa {
      override async start(): Promise<void> {}
    }
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    cancion();
    render(<Ensayo deps={{ ...DEPS, createInput: () => new EntradaQueNoArranca() }} />);

    await userEvent.click(screen.getByRole('button', { name: /Ensayar/ }));

    expect(screen.getByRole('button', { name: /Ensayar/ })).toBeInTheDocument();
    expect(metronomo.running).toBe(false);
  });

  /**
   * Y una canción con partes pero sin un solo acorde no tiene guion: se mide lo
   * que hay que tocar, no cuántas partes hay. Una fila vacía no es una canción.
   */
  it('con partes pero sin acordes no hay guion', () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    useArrangementStore.setState({
      arrangement: {
        parts: [{ id: 'estrofa', name: 'Estrofa', blocks: [], notes: [], bars: 2 }],
      },
      past: [],
    });
    render(<Ensayo deps={DEPS} />);

    expect(screen.getByText(/Todavía no hay nada que ensayar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ensayar/ })).not.toBeInTheDocument();
  });
});
