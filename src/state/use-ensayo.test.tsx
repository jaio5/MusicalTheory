// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { Metronome, MetronomeOptions } from '@audio/metronome';
import type { PitchEngine } from '@audio/pitch-engine';
import { pitchClassFromName, pulsosDeCuenta, writtenBlock, type Arrangement } from '@core/music';

import { useClaqueta } from './claqueta';
import { useSessionStore } from './session-store';
import { useEnsayo, type EnsayoDeps } from './use-ensayo';
import { useListening } from './use-listening';

/**
 * La cuenta atrás de ensayar, y la toma que marca.
 *
 * Ensayar empezaba sin cuenta: el primer clic ya era el compás uno, el acorde
 * se encendía a la vez que había que tocarlo y el primer compás salía fallado
 * casi siempre. Ahora cuenta dos compases, como Tocando, y **el compás uno cae
 * en el primer clic después de la cuenta**, un pulso después del último de ella
 * ([adr/0072](../../docs/adr/0072-la-claqueta-suena-toda-la-toma.md)). El bucle
 * entero —acertar, llegar tarde, los números del final— se prueba en
 * `features/arrange/Ensayo.test.tsx`.
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
  #poner(state: AudioInputState): void {
    this.state = state;
    for (const oyente of this.#oyentes) {
      oyente(state);
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

/** Una entrada cuyo permiso contesta cuando lo diga el test: el navegador pidiéndolo. */
class EntradaConPermiso extends EntradaFalsa {
  #conceder: (() => void) | null = null;

  override async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.#conceder = resolve;
    });
    await super.start();
  }
  conceder(): void {
    this.#conceder?.();
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

/** Un metrónomo que no suena: el pulso lo da el test, y apunta con qué volumen se pidió. */
class MetronomoFalso implements Metronome {
  running = false;
  dispuesto = false;
  volumen: number | undefined;
  #onBeat: MetronomeOptions['onBeat'];
  #beat = 0;

  async start(options: MetronomeOptions): Promise<void> {
    this.running = true;
    this.volumen = options.volume;
    this.#onBeat = options.onBeat;
  }
  setBpm(): void {}
  stop(): void {
    this.running = false;
  }
  async dispose(): Promise<void> {
    this.running = false;
    this.dispuesto = true;
  }
  pulsar(cuantos: number): void {
    for (let i = 0; i < cuantos; i += 1) {
      this.#onBeat?.(this.#beat, 1000 + this.#beat * 500);
      this.#beat = (this.#beat + 1) % 4;
    }
  }
}

const C = pitchClassFromName('C');
const CUENTA = pulsosDeCuenta(4);

/** Dos compases: el I y el V. */
const CANCION: Arrangement = {
  parts: [
    {
      id: 'estrofa',
      name: 'Estrofa',
      blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'V', 4)],
      notes: [],
      bars: 2,
    },
  ],
};

let metronomo: MetronomoFalso;
let deps: EnsayoDeps;

function suenaDo(): void {
  useSessionStore.getState().actions.setHeardChord({
    symbol: 'C',
    root: C,
    notes: [0, 4, 7] as never,
    at: 0,
    score: 0.95,
    margin: 0.3,
    alternatives: [],
  });
}

function callar(): void {
  useSessionStore.getState().actions.setHeardChord(null);
}

function montar() {
  return renderHook(() => useEnsayo(CANCION, C, 'major', deps));
}

beforeEach(() => {
  metronomo = new MetronomoFalso();
  deps = {
    createInput: () => new EntradaFalsa(),
    createEngine: () => new MotorFalso(),
    createChordEngine: () => new CromaFalso(),
    createMetronome: () => metronomo,
  };
  useSessionStore.getState().actions.setTempo(120, 4);
  useClaqueta.setState({ volumen: 0.5, callada: false, enLaToma: false });
});

describe('la cuenta atrás de ensayar', () => {
  it('cuenta dos compases antes de empezar, y lo dice golpe a golpe', async () => {
    const { result } = montar();

    await act(async () => {
      void result.current.empezar();
    });

    expect(result.current.fase).toBe('preparando');
    expect(result.current.cuenta).toBe(CUENTA);
    expect(result.current.paso).toBeNull();

    act(() => metronomo.pulsar(3));
    expect(result.current.cuenta).toBe(CUENTA - 3);

    await act(async () => {
      metronomo.pulsar(CUENTA - 3);
    });
    expect(result.current.cuenta).toBeNull();
    expect(result.current.fase).toBe('ensayando');
    expect(result.current.paso).toBe(0);
  });

  /**
   * La invariante de Tocando: el compás uno es el primer clic **después** de la
   * cuenta. Lo que suena durante la cuenta no puntúa —es tocar antes de
   * tiempo—, y lo que suena en el primer clic de después sí.
   */
  it('lo que suena durante la cuenta no cuenta, y el compás uno es el clic de después', async () => {
    const { result } = montar();
    await act(async () => {
      void result.current.empezar();
    });

    // El Do suena toda la cuenta y se calla justo al acabar: si la cuenta
    // puntuara, el primer compás saldría acertado.
    suenaDo();
    await act(async () => {
      metronomo.pulsar(CUENTA);
    });
    callar();
    await act(async () => {
      metronomo.pulsar(4);
    });
    expect(result.current.resultados).toEqual(['fallado']);
  });

  it('y tocado en su compás, acierta', async () => {
    const { result } = montar();
    await act(async () => {
      void result.current.empezar();
    });
    await act(async () => {
      metronomo.pulsar(CUENTA);
    });

    suenaDo();
    await act(async () => {
      metronomo.pulsar(4);
    });
    expect(result.current.resultados).toEqual(['acertado']);
  });

  // La cuenta suena con el volumen de la claqueta, como en Tocando: quien la
  // bajó porque toca con auriculares no quiere que el ensayo vuelva a subirla.
  it('suena con el volumen de la claqueta', async () => {
    const { result } = montar();
    await act(async () => {
      void result.current.empezar();
    });

    expect(metronomo.volumen).toBe(0.5);
  });
});

describe('la toma del ensayo', () => {
  /**
   * Mientras se ensaya la toma es suya: el metrónomo de la barra se aparta y no
   * suenan dos pulsos a la vez, y lo que mira si hay toma —el lector de
   * pantalla— se calla también.
   */
  it('se marca al empezar la cuenta y se suelta al terminar', async () => {
    const { result } = montar();
    await act(async () => {
      void result.current.empezar();
    });
    expect(useClaqueta.getState().enLaToma).toBe(true);

    await act(async () => {
      metronomo.pulsar(CUENTA + 8);
    });
    expect(result.current.fase).toBe('terminado');
    expect(useClaqueta.getState().enLaToma).toBe(false);
  });

  it('parar a medias también la suelta', async () => {
    const { result } = montar();
    await act(async () => {
      void result.current.empezar();
    });
    await act(async () => {
      metronomo.pulsar(CUENTA + 2);
    });

    act(() => result.current.parar());

    expect(result.current.fase).toBe('terminado');
    expect(useClaqueta.getState().enLaToma).toBe(false);
  });

  /**
   * Parar en mitad de la cuenta no es un ensayo a medias: no ha empezado nada.
   * Se vuelve a como estaba, sin números que enseñar.
   */
  it('parar en mitad de la cuenta la corta, y no puntúa', async () => {
    const { result } = montar();
    await act(async () => {
      void result.current.empezar();
    });
    act(() => metronomo.pulsar(2));

    await act(async () => {
      result.current.parar();
    });

    expect(result.current.fase).toBe('quieto');
    expect(result.current.resultado).toBeNull();
    expect(result.current.cuenta).toBeNull();
    expect(metronomo.running).toBe(false);
    expect(useClaqueta.getState().enLaToma).toBe(false);
    expect(useSessionStore.getState().listening).not.toBe('listening');
  });

  // Irse de la pantalla en mitad de la cuenta no puede dejar la toma marcada: el
  // metrónomo de la barra se quedaría apartado para siempre.
  it('irse en mitad de la cuenta la corta y la suelta', async () => {
    const { result, unmount } = montar();
    await act(async () => {
      void result.current.empezar();
    });

    await act(async () => {
      unmount();
    });

    expect(metronomo.dispuesto).toBe(true);
    expect(useClaqueta.getState().enLaToma).toBe(false);
  });
});

/**
 * Con el marco único, la barra sujeta el micro y no se va al navegar: el
 * arranque del ensayo sobrevive a la pantalla. Aquí la barra es otro gancho
 * montado aparte, que es lo que impide que el micro se cierre solo al
 * desmontar el ensayo.
 */
describe('irse de la pantalla del ensayo', () => {
  function montarLaBarra() {
    return renderHook(() => useListening(deps));
  }

  it('mientras el navegador pide el micro, no arranca nada', async () => {
    const entrada = new EntradaConPermiso();
    deps = { ...deps, createInput: () => entrada };
    const barra = montarLaBarra();
    const { result, unmount } = montar();

    let empezado: Promise<void> = Promise.resolve();
    await act(async () => {
      empezado = result.current.empezar();
    });
    expect(useSessionStore.getState().listening).toBe('requesting');

    await act(async () => {
      unmount();
    });
    await act(async () => {
      entrada.conceder();
      await empezado;
    });

    expect(metronomo.running).toBe(false);
    expect(useClaqueta.getState().enLaToma).toBe(false);
    expect(entrada.state).toBe('idle');
    expect(useSessionStore.getState().listening).not.toBe('listening');
    barra.unmount();
  });

  it('en mitad del ensayo, cierra el micro y el croma', async () => {
    const entrada = new EntradaFalsa();
    deps = { ...deps, createInput: () => entrada };
    const barra = montarLaBarra();
    const { result, unmount } = montar();

    await act(async () => {
      void result.current.empezar();
    });
    await act(async () => {
      metronomo.pulsar(CUENTA + 2);
    });
    expect(result.current.fase).toBe('ensayando');
    expect(entrada.state).toBe('running');

    await act(async () => {
      unmount();
    });

    expect(entrada.state).toBe('idle');
    expect(useSessionStore.getState().listening).toBe('idle');
    expect(useClaqueta.getState().enLaToma).toBe(false);
    barra.unmount();
  });

  // Terminado, la escucha ya se cerró; lo que esté abierto después es de la
  // barra, y salir de la pantalla no se lo cierra.
  it('terminado, no cierra el micro que abrió la barra después', async () => {
    const entrada = new EntradaFalsa();
    deps = { ...deps, createInput: () => entrada };
    const barra = montarLaBarra();
    const { result, unmount } = montar();

    await act(async () => {
      void result.current.empezar();
    });
    await act(async () => {
      metronomo.pulsar(CUENTA + 8);
    });
    expect(result.current.fase).toBe('terminado');

    await act(async () => {
      await barra.result.current.start();
    });
    expect(entrada.state).toBe('running');

    await act(async () => {
      unmount();
    });

    expect(entrada.state).toBe('running');
    await act(async () => {
      barra.unmount();
    });
  });
});
