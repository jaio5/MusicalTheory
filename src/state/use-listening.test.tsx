// @vitest-environment jsdom

import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine, PitchSample } from '@audio/pitch-engine';
import type { ChordMatch, ChordReading } from '@core/music';

import { useSessionStore } from './session-store';
import {
  entradaActiva,
  motorDeTonoActivo,
  useListening,
  type ListeningDeps,
} from './use-listening';

class FakeInput implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;

  async start(): Promise<void> {
    this.state = 'running';
  }
  async stop(): Promise<void> {
    this.state = 'idle';
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  subscribe(): () => void {
    return () => {};
  }
}

class SilentPitchEngine implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
  async start(): Promise<void> {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  subscribe(): () => void {
    return () => {};
  }
  subscribeLevel(): () => void {
    return () => {};
  }
}

class FakeChordEngine implements ChordEngine {
  running = false;
  started = false;
  #listeners = new Set<(chord: ChordReading | null) => void>();

  async start(): Promise<void> {
    this.running = true;
    this.started = true;
  }
  stop(): void {
    this.running = false;
  }
  setAccidental(): void {}
  subscribe(listener: (chord: ChordReading | null) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  /** Simula que el motor ha reconocido un acorde. */
  announce(chord: ChordReading | null): void {
    for (const listener of this.#listeners) {
      listener(chord);
    }
  }
}

const AM_MATCH: ChordMatch = {
  root: 9,
  shape: { intervals: [0, 3, 7], name: 'menor', suffix: 'm' },
  symbol: 'Am',
  notes: [9, 0, 4],
  score: 0.91,
};

/** Un La menor claro: el segundo candidato se queda lejos. */
const AM: ChordReading = {
  best: AM_MATCH,
  alternatives: [
    {
      root: 0,
      shape: { intervals: [0, 4, 7, 9], name: 'con sexta', suffix: '6' },
      symbol: 'C6',
      notes: [0, 4, 7, 9],
      score: 0.72,
    },
  ],
  margin: 0.19,
};

function Escucha(deps: ListeningDeps) {
  const { start } = useListening(deps);
  return (
    <button type="button" onClick={() => void start()}>
      Escuchar
    </button>
  );
}

/**
 * Dos botones de escuchar en la misma pantalla, que es lo que hay en `/afinar`:
 * el grande del afinador y el de la barra de arriba.
 */
function DosBotones({ deps }: { readonly deps: ListeningDeps }) {
  const barra = useListening(deps);
  const afinador = useListening(deps);
  return (
    <>
      <button type="button" onClick={() => void afinador.start()}>
        Arrancar desde el afinador
      </button>
      <button type="button" onClick={() => void barra.stop()}>
        Parar desde la barra
      </button>
    </>
  );
}

/**
 * El fallo que costó encontrar, y que ningún test veía: **dos botones, dos
 * micrófonos**.
 *
 * En `/afinar` hay dos sitios que abren el micro y el estado de sesión es uno
 * solo. Cada gancho guardaba su entrada en sus propias referencias, así que al
 * arrancar desde el afinador el botón de la barra se pintaba encendido —lee el
 * estado global— y al pulsarlo llamaba a *su* `stop`, que no tenía nada abierto:
 * ponía «sin escuchar», el afinador volvía a su pantalla de arranque y **el
 * micrófono seguía abierto**, con el piloto del navegador encendido.
 *
 * Se vio conduciendo un Chromium de verdad y contando las pistas vivas, no
 * leyendo el código. Esto es lo que impide que vuelva.
 */
describe('El micrófono es uno solo', () => {
  it('parar desde un botón cierra lo que abrió el otro', async () => {
    const entrada = new FakeInput();
    render(
      <DosBotones
        deps={{ createInput: () => entrada, createEngine: () => new SilentPitchEngine() }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));
    await waitFor(() => expect(entrada.state).toBe('running'));

    await userEvent.click(screen.getByRole('button', { name: /parar desde la barra/i }));

    expect(entrada.state, 'el micro se ha quedado abierto').toBe('idle');
    expect(useSessionStore.getState().listening).toBe('idle');
  });

  // La toma se apunta a cada análisis del mismo motor: no abre otro.
  it('el motor que escucha se presta a quien lo pide, y se suelta al parar', async () => {
    const motor = new SilentPitchEngine();
    render(<DosBotones deps={{ createInput: () => new FakeInput(), createEngine: () => motor }} />);
    expect(motorDeTonoActivo()).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));
    await waitFor(() => expect(motorDeTonoActivo()).toBe(motor));

    await userEvent.click(screen.getByRole('button', { name: /parar desde la barra/i }));
    expect(motorDeTonoActivo()).toBeNull();
  });

  it('y no se abre dos veces si se pulsan los dos', async () => {
    const abiertas: FakeInput[] = [];
    render(
      <DosBotones
        deps={{
          createInput: () => {
            const nueva = new FakeInput();
            abiertas.push(nueva);
            return nueva;
          },
          createEngine: () => new SilentPitchEngine(),
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));
    await waitFor(() => expect(abiertas).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: /arrancar desde el afinador/i }));

    expect(abiertas, 'se ha pedido el micro dos veces').toHaveLength(1);
  });
});

describe('Escuchar', () => {
  it('sin pedirlo, no analiza acordes', async () => {
    const chordEngine = new FakeChordEngine();
    render(
      <Escucha
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(chordEngine.started).toBe(false);
  });

  it('en componer sí, y lo que reconoce llega al estado', async () => {
    const chordEngine = new FakeChordEngine();
    render(
      <Escucha
        chords
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(chordEngine.started).toBe(true));

    chordEngine.announce(AM);

    expect(useSessionStore.getState().heardChord?.symbol).toBe('Am');
  });

  it('al soltar el micro se olvida lo que sonaba', async () => {
    const chordEngine = new FakeChordEngine();
    const { unmount } = render(
      <Escucha
        chords
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(chordEngine.started).toBe(true));
    chordEngine.announce(AM);
    unmount();

    expect(chordEngine.running).toBe(false);
  });
});

describe('los motores de verdad', () => {
  /**
   * Sin fábricas se usan los de la aplicación, que es como sale de verdad. En
   * jsdom no hay micrófono, así que no se llega a arrancar: lo que se comprueba
   * es que eso se cuenta en vez de dejar la pantalla diciendo que escucha.
   */
  it('sin fabricas, y sin microfono, no se queda escuchando', async () => {
    render(<Escucha />);

    await userEvent.click(screen.getByRole('button'));

    // Los motores de casa se descargan al pulsar, así que se espera a lo que diga
    // la entrada y no a lo primero que se vea: «pidiendo» ya tampoco es escuchar.
    await waitFor(() => expect(useSessionStore.getState().listening).toBe('unsupported'));
    expect(useSessionStore.getState().message).toMatch(/no puede capturar audio/);
  });

  // Y con un micrófono elegido a mano, se le pide ese.
  it('con un microfono elegido, tampoco se queda escuchando', async () => {
    function ConDispositivo() {
      const { start } = useListening({});
      return (
        <button type="button" onClick={() => void start('el-de-la-mesa')}>
          Escuchar
        </button>
      );
    }
    render(<ConDispositivo />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(useSessionStore.getState().listening).toBe('unsupported'));
  });

  /**
   * Y con una entrada de mentira pero el motor de tono de verdad se recorre el
   * camino entero: es el mismo motor que corre en la aplicación, con una fuente
   * que no necesita micrófono.
   */
  it('el motor de tono de verdad arranca sobre una entrada de mentira', async () => {
    render(<Escucha createInput={() => new FakeInput()} />);

    await userEvent.click(screen.getByRole('button'));

    // La entrada de mentira no avisa de su estado, así que la pantalla se queda
    // en «pidiendo permiso»; lo que importa es que el motor arrancó sin nada
    // que fingir por debajo.
    await waitFor(() => expect(useSessionStore.getState().listening).not.toBe('idle'));
  });

  // Y cuando el acorde deja de reconocerse, el estado se queda sin él.
  it('cuando deja de haber acorde, el estado lo suelta', async () => {
    const chordEngine = new FakeChordEngine();
    render(
      <Escucha
        chords
        createInput={() => new FakeInput()}
        createEngine={() => new SilentPitchEngine()}
        createChordEngine={() => chordEngine}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(chordEngine.started).toBe(true));
    chordEngine.announce(AM);

    chordEngine.announce(null);

    expect(useSessionStore.getState().heardChord).toBeNull();
  });
});

/**
 * Una entrada que **no contesta hasta que se le dice**: es el navegador
 * preguntando por el permiso, que puede tardar lo que tarde la persona en leer
 * el aviso.
 */
class EntradaQueEspera extends FakeInput {
  empezada = false;
  #contestar: (() => void) | null = null;

  override async start(): Promise<void> {
    this.empezada = true;
    this.state = 'requesting';
    await new Promise<void>((resolve) => {
      this.#contestar = resolve;
    });
    this.state = 'running';
  }

  /** El permiso, concedido por fin. */
  async conceder(): Promise<void> {
    await act(async () => {
      this.#contestar?.();
      await Promise.resolve();
    });
  }
}

/** Un motor de tono que deja ver si quedó en marcha. */
class MotorQueAvisa extends SilentPitchEngine {
  constructor(private readonly alArrancar: () => void = () => {}) {
    super();
  }
  override async start(): Promise<void> {
    this.running = true;
    this.alArrancar();
  }
}

/** Un motor de acordes que hace algo al arrancar, como pararlo todo. */
class AcordesQueAvisan extends FakeChordEngine {
  constructor(private readonly alArrancar: () => void) {
    super();
  }
  override async start(): Promise<void> {
    await super.start();
    this.alArrancar();
  }
}

/**
 * Lo que puede pasar **mientras se abre el micro**.
 *
 * Abrirlo espera varias veces —a descargar los motores, al permiso, a que
 * arranque el análisis— y en cada espera puede llegar un «parar» o irse la
 * pantalla. El fallo que se vio en un Chromium con el permiso tardando tres
 * segundos: se navegaba antes de contestar, el arranque seguía al volver y la
 * pista quedaba **viva y sin dueño**, con la barra apagada y desactivada.
 */
describe('mientras se abre', () => {
  afterEach(async () => {
    // El micro es del módulo: lo que deje abierto un caso lo heredaría el siguiente.
    const { result, unmount } = renderHook(() => useListening({}));
    await act(() => result.current.stop());
    unmount();
  });

  it('irse con el permiso pendiente no deja la pista abierta', async () => {
    const entrada = new EntradaQueEspera();
    const { result, unmount } = renderHook(() =>
      useListening({ createInput: () => entrada, createEngine: () => new SilentPitchEngine() }),
    );

    let arranque = Promise.resolve();
    act(() => {
      arranque = result.current.start();
    });
    await waitFor(() => expect(entrada.empezada).toBe(true));
    unmount();
    await entrada.conceder();
    await act(() => arranque);

    expect(entrada.state, 'la pista sigue viva').toBe('idle');
    expect(entradaActiva()).toBeNull();
    expect(useSessionStore.getState().listening).toBe('idle');
  });

  it('parar con el permiso pendiente tampoco, y el siguiente arranque no espera al viejo', async () => {
    const vieja = new EntradaQueEspera();
    const nueva = new FakeInput();
    const entradas = [vieja, nueva];
    const { result } = renderHook(() =>
      useListening({
        createInput: () => entradas.shift()!,
        createEngine: () => new SilentPitchEngine(),
      }),
    );

    let arranque = Promise.resolve();
    act(() => {
      arranque = result.current.start();
    });
    await waitFor(() => expect(vieja.empezada).toBe(true));
    // Pulsar otra vez mientras pregunta no pide otro micro.
    await act(() => result.current.start());
    expect(entradas).toHaveLength(1);

    await act(() => result.current.stop());
    await act(() => result.current.start());
    expect(entradaActiva()).toBe(nueva);

    await vieja.conceder();
    await act(() => arranque);

    expect(vieja.state, 'la vieja se ha quedado abierta').toBe('idle');
    expect(entradaActiva(), 'la vieja se ha llevado la nueva').toBe(nueva);
  });

  /**
   * Cada espera tiene su propio «ya no es tuyo». Se para desde dentro de cada
   * fábrica o de cada arranque, que es el instante exacto de esa espera.
   */
  it('parar mientras se prepara la entrada no llega a pedir el permiso', async () => {
    const entrada = new EntradaQueEspera();
    let parar = (): Promise<void> => Promise.resolve();
    const { result } = renderHook(() =>
      useListening({
        createInput: () => {
          void parar();
          return entrada;
        },
      }),
    );
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(entrada.empezada).toBe(false);
    expect(entradaActiva()).toBeNull();
  });

  it('parar mientras se prepara el motor de tono no lo arranca', async () => {
    const motor = new MotorQueAvisa();
    let parar = (): Promise<void> => Promise.resolve();
    const { result } = renderHook(() =>
      useListening({
        createInput: () => new FakeInput(),
        createEngine: () => {
          void parar();
          return motor;
        },
      }),
    );
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(motor.running).toBe(false);
    expect(motorDeTonoActivo()).toBeNull();
  });

  it('parar mientras arranca el motor de tono lo deja parado', async () => {
    let parar = (): Promise<void> => Promise.resolve();
    const motor = new MotorQueAvisa(() => void parar());
    const { result } = renderHook(() =>
      useListening({ createInput: () => new FakeInput(), createEngine: () => motor }),
    );
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(motor.running).toBe(false);
  });

  it('parar mientras se prepara el de acordes no lo arranca', async () => {
    const acordes = new FakeChordEngine();
    let parar = (): Promise<void> => Promise.resolve();
    const { result } = renderHook(() =>
      useListening({
        chords: true,
        createInput: () => new FakeInput(),
        createEngine: () => new SilentPitchEngine(),
        createChordEngine: () => {
          void parar();
          return acordes;
        },
      }),
    );
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(acordes.started).toBe(false);
  });

  it('parar mientras arranca el de acordes lo deja parado', async () => {
    let parar = (): Promise<void> => Promise.resolve();
    const acordes = new AcordesQueAvisan(() => void parar());
    const { result } = renderHook(() =>
      useListening({
        chords: true,
        createInput: () => new FakeInput(),
        createEngine: () => new SilentPitchEngine(),
        createChordEngine: () => acordes,
      }),
    );
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(acordes.started).toBe(true);
    expect(acordes.running).toBe(false);
  });

  /**
   * Lo que más fácil falla al abrir es la descarga de los motores. Sin decirlo,
   * el botón se quedaba en «pidiendo», desactivado, para siempre.
   */
  it('si algo revienta al abrir, lo dice y suelta lo abierto', async () => {
    const entrada = new FakeInput();
    const { result } = renderHook(() =>
      useListening({
        createInput: () => entrada,
        createEngine: () => {
          throw new Error('sin red');
        },
      }),
    );

    await act(() => result.current.start());

    expect(useSessionStore.getState().listening).toBe('error');
    expect(useSessionStore.getState().message).toMatch(/no he podido preparar la escucha/i);
    expect(entrada.state).toBe('idle');
    expect(entradaActiva()).toBeNull();
  });

  it('pero si ya lo habían parado, el error no pisa el reposo', async () => {
    let parar = (): Promise<void> => Promise.resolve();
    const { result } = renderHook(() =>
      useListening({
        createInput: () => new FakeInput(),
        createEngine: () => {
          void parar();
          throw new Error('sin red');
        },
      }),
    );
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(useSessionStore.getState().listening).toBe('idle');
  });
});

/**
 * El micro abierto **sigue abierto al cambiar de pantalla**: lo sujeta la barra,
 * que no se va. Lo que hay que cuidar es lo que pide cada sitio.
 */
/** Un motor que deja decir lo que oye, como el de verdad cada veinte de segundo. */
class MotorQueHabla implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
  async start(): Promise<void> {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  #oyentes = new Set<(sample: PitchSample | null) => void>();
  #nivel = new Set<(rms: number) => void>();
  subscribe(oyente: (sample: PitchSample | null) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }
  subscribeLevel(oyente: (rms: number) => void): () => void {
    this.#nivel.add(oyente);
    return () => this.#nivel.delete(oyente);
  }
  oir(sample: PitchSample | null, rms = 0): void {
    for (const oyente of this.#nivel) {
      oyente(rms);
    }
    for (const oyente of this.#oyentes) {
      oyente(sample);
    }
  }
}

/** Una entrada que avisa de su estado, como la de verdad: sin error que contar. */
class EntradaQueAvisa implements AudioInput {
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

describe('lo que oye el motor de tono', () => {
  it('llega a la sesión, y el silencio también', async () => {
    const motor = new MotorQueHabla();
    const { result, unmount } = renderHook(() =>
      useListening({ createInput: () => new EntradaQueAvisa(), createEngine: () => motor }),
    );
    await act(() => result.current.start());
    expect(useSessionStore.getState().listening).toBe('listening');
    expect(useSessionStore.getState().message).toBeNull();

    act(() => motor.oir({ frequency: 440, clarity: 0.95, at: 10, rms: 0.2 }, 0.2));
    expect(useSessionStore.getState().hasSignal).toBe(true);
    expect(useSessionStore.getState().level).toBe(0.2);

    act(() => motor.oir(null));
    expect(useSessionStore.getState().hasSignal).toBe(false);

    await act(() => result.current.stop());
    unmount();
  });
});

describe('un micro que ya estaba abierto', () => {
  afterEach(async () => {
    const { result, unmount } = renderHook(() => useListening({}));
    await act(() => result.current.stop());
    unmount();
  });

  it('abierto sin acordes, quien los pide los añade sin abrir otro', async () => {
    const abiertas: FakeInput[] = [];
    const acordes = new FakeChordEngine();
    const crearEntrada = () => {
      const nueva = new FakeInput();
      abiertas.push(nueva);
      return nueva;
    };
    const afinar = renderHook(() =>
      useListening({ createInput: crearEntrada, createEngine: () => new SilentPitchEngine() }),
    );
    const componer = renderHook(() =>
      useListening({
        chords: true,
        createInput: crearEntrada,
        createEngine: () => new SilentPitchEngine(),
        createChordEngine: () => acordes,
      }),
    );

    await act(() => afinar.result.current.start());
    await act(() => componer.result.current.start());

    expect(abiertas).toHaveLength(1);
    expect(acordes.started).toBe(true);

    // Y pedirlo otra vez no pone un segundo motor encima.
    const otro = new FakeChordEngine();
    const otraVez = renderHook(() => useListening({ chords: true, createChordEngine: () => otro }));
    await act(() => otraVez.result.current.start());
    expect(otro.started).toBe(false);
  });

  it('si la entrada se ha caído, no se le cuelgan acordes', async () => {
    const entrada = new FakeInput();
    const acordes = new FakeChordEngine();
    const afinar = renderHook(() =>
      useListening({ createInput: () => entrada, createEngine: () => new SilentPitchEngine() }),
    );
    await act(() => afinar.result.current.start());
    entrada.state = 'error';

    const componer = renderHook(() =>
      useListening({ chords: true, createChordEngine: () => acordes }),
    );
    await act(() => componer.result.current.start());

    expect(acordes.started).toBe(false);
  });

  it('con el motor de acordes de verdad también', async () => {
    const { result } = renderHook(() =>
      useListening({
        chords: true,
        createInput: () => new FakeInput(),
        createEngine: () => new SilentPitchEngine(),
      }),
    );

    await act(() => result.current.start());

    expect(entradaActiva()).not.toBeNull();
  });

  /**
   * **Cuando se va el último, la interfaz también descansa.** Cerrar el aparato
   * y dejar el estado en «escuchando» era la barra encendida sobre un micro
   * apagado, y el primer clic en ella no paraba nada.
   */
  it('al irse el último que lo tenía, se cierra y la interfaz lo dice', async () => {
    const entrada = new FakeInput();
    const acordes = new FakeChordEngine();
    const { result, unmount } = renderHook(() =>
      useListening({
        chords: true,
        createInput: () => entrada,
        createEngine: () => new SilentPitchEngine(),
        createChordEngine: () => acordes,
      }),
    );
    await act(() => result.current.start());
    act(() => {
      useSessionStore.getState().actions.setListening('listening');
      acordes.announce(AM);
    });

    unmount();

    await waitFor(() => expect(entrada.state).toBe('idle'));
    const estado = useSessionStore.getState();
    expect(estado.listening).toBe('idle');
    expect(estado.heardChord).toBeNull();
    expect(estado.hasSignal).toBe(false);
  });
});
