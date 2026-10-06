// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioInput, AudioInputError, AudioInputState } from '@audio/audio-input';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';

import { useClaqueta } from './claqueta';
import { useMicrofono } from './microfono';
import { useSessionStore } from './session-store';
import {
  cambiarDeMicro,
  entradaActiva,
  sujetarLaEntrada,
  useListening,
  type ListeningDeps,
} from './use-listening';

/**
 * **El micro que se elige es uno para toda la aplicación**, y la escucha lo usa:
 * lo abre al arrancar, cae al del sistema si no está, lo cambia en caliente si
 * ya escucha y espera a que acabe la toma si la hay.
 *
 * En su propio fichero porque el módulo guarda el micro abierto, y aquí se juega
 * con él de maneras que estorbarían a las pruebas de siempre.
 */

type Resultado = Extract<AudioInputState, 'running' | 'error' | 'denied'>;

/** Una entrada que abre lo que se le diga y avisa de su estado como la de verdad. */
class Entrada implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error: AudioInputError | null = null;
  /** La pista, para saber de qué aparato sale y si sigue viva. */
  readonly stream: { getAudioTracks(): unknown[] };
  viva = true;
  readonly #oyentes = new Set<(estado: AudioInputState) => void>();

  constructor(
    readonly id: string | undefined,
    readonly resultado: Resultado = 'running',
  ) {
    this.stream = {
      getAudioTracks: () => [
        {
          getSettings: () => ({ deviceId: id ?? 'default' }),
          readyState: this.viva ? 'live' : 'ended',
        },
      ],
    };
  }

  async start(): Promise<void> {
    if (this.resultado !== 'running') {
      this.error = { state: this.resultado, message: `fallo ${this.resultado}` };
    }
    this.#pasar(this.resultado);
  }
  async stop(): Promise<void> {
    if (this.state === 'running') {
      this.#pasar('idle');
    }
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  subscribe(oyente: (estado: AudioInputState) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }
  #pasar(estado: AudioInputState): void {
    this.state = estado;
    for (const oyente of this.#oyentes) {
      oyente(estado);
    }
  }
}

class Motor implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
  readonly entradas: AudioInput[] = [];
  async start(input: AudioInput): Promise<void> {
    this.entradas.push(input);
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

class Croma implements ChordEngine {
  readonly running = false;
  readonly entradas: AudioInput[] = [];
  setAccidental(): void {}
  async start(input: AudioInput): Promise<void> {
    this.entradas.push(input);
  }
  stop(): void {}
  subscribe(): () => void {
    return () => {};
  }
}

/** Los aparatos que dice el navegador, y quien escucha si cambian. */
let aparatos: Array<{ deviceId: string; label: string; kind: string }> = [];
let alCambiar: (() => void) | null = null;

function navegadorCon(lista: typeof aparatos | null): void {
  aparatos = lista ?? [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value:
      lista === null
        ? {}
        : {
            mediaDevices: {
              enumerateDevices: async () => aparatos,
              addEventListener: (_: string, oyente: () => void) => {
                alCambiar = oyente;
              },
              removeEventListener: () => {
                alCambiar = null;
              },
            },
          },
  });
}

const DOS = [
  { deviceId: 'default', label: 'Por defecto - Portátil', kind: 'audioinput' },
  { deviceId: 'portatil', label: 'Portátil', kind: 'audioinput' },
  { deviceId: 'tarjeta', label: 'Scarlett', kind: 'audioinput' },
];

/** Monta la escucha con una fábrica que apunta qué se pide. */
function montar(fabrica?: (id: string | undefined) => Entrada) {
  const pedidas: Array<string | undefined> = [];
  const abiertas: Entrada[] = [];
  const motor = new Motor();
  const croma = new Croma();
  const deps: ListeningDeps = {
    chords: true,
    createInput: (id) => {
      pedidas.push(id);
      const entrada = fabrica?.(id) ?? new Entrada(id);
      abiertas.push(entrada);
      return entrada;
    },
    createEngine: () => motor,
    createChordEngine: () => croma,
  };
  const vista = renderHook(() => useListening(deps));
  return { ...vista, pedidas, abiertas, motor, croma };
}

function elegido(id: string | null, nombre = ''): void {
  useMicrofono.setState({ elegido: id, nombreElegido: nombre, cargado: true });
}

beforeEach(() => {
  navegadorCon(DOS);
  useMicrofono.setState({
    elegido: null,
    nombreElegido: '',
    cargado: true,
    entradas: [],
    cayo: false,
    pendiente: false,
    anuncio: '',
  });
  useClaqueta.getState().acciones.marcarToma(false);
  useSessionStore.getState().actions.reset();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('al arrancar', () => {
  it('sin decir cuál, abre el elegido', async () => {
    elegido('tarjeta');
    const { result, pedidas } = montar();

    await act(() => result.current.start());

    expect(pedidas).toEqual(['tarjeta']);
    expect(useMicrofono.getState().cayo).toBe(false);
    // Y con el permiso dado, la lista ya trae los nombres.
    await waitFor(() => expect(useMicrofono.getState().conNombres).toBe(true));
  });

  it('sin elegido, el del sistema, y sin preguntar la lista', async () => {
    const { result, pedidas } = montar();

    await act(() => result.current.start());

    expect(pedidas).toEqual([undefined]);
  });

  it('lo guardado se lee aunque nadie lo hubiera leído', async () => {
    useMicrofono.setState({ cargado: false, elegido: null });
    localStorage.setItem(
      'caos-ordenado:workspace',
      JSON.stringify({ microfono: { id: 'tarjeta', nombre: 'Scarlett' } }),
    );
    const { result, pedidas } = montar();

    await act(() => result.current.start());

    expect(pedidas).toEqual(['tarjeta']);
  });

  /**
   * El navegador cambia el identificador en cada página si el permiso no es para
   * siempre: el elegido se reconoce por el nombre.
   */
  it('si el elegido cambió de identificador, se le reconoce por el nombre', async () => {
    elegido('tarjeta-de-ayer', 'Scarlett');
    const { result, pedidas } = montar();

    await act(() => result.current.start());

    expect(pedidas).toEqual(['tarjeta']);
    expect(useMicrofono.getState().elegido).toBe('tarjeta');
  });

  it('si el elegido no está en la lista, el del sistema, y lo dice', async () => {
    elegido('desenchufada', 'Otra');
    const { result, pedidas } = montar();

    await act(() => result.current.start());

    expect(pedidas).toEqual([undefined]);
    expect(useMicrofono.getState().cayo).toBe(true);
    expect(useMicrofono.getState().anuncio).toMatch(/no está conectado/);
    expect(useSessionStore.getState().listening).toBe('listening');
  });

  /**
   * Sin permiso la lista no trae identificadores y no se sabe si está: se prueba,
   * y si falla se cae igual. **Sin decir el fallo**: dentro de un `role="alert"`,
   * «no se ha encontrado» se leería un instante para nada.
   */
  it('sin lista que mirar, se prueba; si falla, el del sistema, sin enseñar el error', async () => {
    navegadorCon(null);
    elegido('tarjeta');
    const vistos: string[] = [];
    const dejar = useSessionStore.subscribe((estado) => vistos.push(estado.listening));
    const { result, pedidas } = montar(
      (id) => new Entrada(id, id === undefined ? 'running' : 'error'),
    );

    await act(() => result.current.start());
    dejar();

    expect(pedidas).toEqual(['tarjeta', undefined]);
    expect(vistos).not.toContain('error');
    expect(useMicrofono.getState().cayo).toBe(true);
    expect(entradaActiva()?.state).toBe('running');
  });

  it('si lo que falla es el permiso, no se prueba otro', async () => {
    navegadorCon(null);
    elegido('tarjeta');
    const { result, pedidas } = montar((id) => new Entrada(id, 'denied'));

    await act(() => result.current.start());

    expect(pedidas).toEqual(['tarjeta']);
    expect(useSessionStore.getState().listening).toBe('denied');
    expect(entradaActiva()).toBeNull();
  });

  it('parar mientras se suelta el que falló no abre el del sistema', async () => {
    navegadorCon(null);
    elegido('tarjeta');
    let parar = (): Promise<void> => Promise.resolve();
    const { result, pedidas } = montar((id) => {
      const entrada = new Entrada(id, 'error');
      entrada.stop = async () => {
        await parar();
      };
      return entrada;
    });
    parar = result.current.stop;

    await act(() => result.current.start());

    expect(pedidas).toEqual(['tarjeta']);
    expect(useSessionStore.getState().listening).toBe('idle');
  });

  it('parar mientras se mira la lista no pide nada', async () => {
    elegido('tarjeta');
    const { result, pedidas } = montar();
    const lista = navigator.mediaDevices.enumerateDevices;
    Object.assign(navigator.mediaDevices, {
      enumerateDevices: async () => {
        await result.current.stop();
        return lista.call(navigator.mediaDevices);
      },
    });

    await act(() => result.current.start());

    expect(pedidas).toEqual([]);
  });
});

/**
 * Sin fábrica, la entrada nueva es la de casa: se descarga al pulsar. Aquí se
 * sustituye para no necesitar un micrófono.
 */
vi.mock('@audio/web-audio-input', () => ({
  WebAudioInput: class {
    constructor({ deviceId }: { deviceId?: string }) {
      return new Entrada(deviceId);
    }
  },
}));

describe('cambiar de micro', () => {
  it('con la entrada de casa, la nueva también es de casa', async () => {
    const motor = new Motor();
    const { result } = renderHook(() => useListening({ createEngine: () => motor }));
    await act(() => result.current.start());

    await act(() => cambiarDeMicro('tarjeta'));

    expect((entradaActiva() as Entrada).id).toBe('tarjeta');
  });

  it('parar y volver a abrir en mitad de un cambio deja el arranque nuevo', async () => {
    let soltar = (): void => {};
    const espera = new Promise<void>((listo) => {
      soltar = listo;
    });
    const { result, pedidas } = montar((id) => {
      const entrada = new Entrada(id);
      if (id === 'tarjeta') {
        const arrancar = entrada.start.bind(entrada);
        entrada.start = async () => {
          await espera;
          await arrancar();
        };
      }
      return entrada;
    });
    await act(() => result.current.start());
    let cambio: Promise<void> = Promise.resolve();
    act(() => {
      cambio = cambiarDeMicro('tarjeta');
    });
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));

    await act(() => result.current.stop());
    useMicrofono.setState({ elegido: null });
    await act(() => result.current.start());
    soltar();
    await act(() => cambio);

    expect((entradaActiva() as Entrada).id).toBeUndefined();
    expect(entradaActiva()?.state).toBe('running');
  });

  it('con el micro cerrado, solo se guarda y se dice', async () => {
    montar();
    useMicrofono.getState().acciones.ponerEntradas(DOS as MediaDeviceInfo[]);

    await act(() => cambiarDeMicro('tarjeta'));

    expect(useMicrofono.getState().elegido).toBe('tarjeta');
    expect(JSON.parse(localStorage.getItem('caos-ordenado:workspace')!).microfono).toEqual({
      id: 'tarjeta',
      nombre: 'Scarlett',
    });
    expect(useMicrofono.getState().anuncio).toBe('Micrófono: Scarlett.');
  });

  /**
   * En caliente: se abre la nueva antes de cerrar la vieja, y **los motores son
   * los mismos** —quien estaba apuntado a ellos no se entera—.
   */
  it('escuchando, cambia la entrada y deja los mismos motores', async () => {
    const { result, abiertas, motor, croma } = montar();
    await act(() => result.current.start());
    const vieja = abiertas[0]!;

    await act(() => cambiarDeMicro('tarjeta'));

    const nueva = abiertas[1]!;
    expect(nueva.id).toBe('tarjeta');
    expect(entradaActiva()).toBe(nueva);
    expect(vieja.state).toBe('idle');
    expect(motor.entradas.at(-1)).toBe(nueva);
    expect(croma.entradas.at(-1)).toBe(nueva);
    expect(useSessionStore.getState().listening).toBe('listening');
    expect(useMicrofono.getState().anuncio).toBe('Micrófono cambiado: Scarlett.');

    // La nueva sigue diciendo su estado a la sesión.
    await act(() => nueva.stop());
    expect(useSessionStore.getState().listening).toBe('idle');
  });

  it('si la elegida no abre, prueba el del sistema', async () => {
    navegadorCon(null);
    const { result, pedidas } = montar(
      (id) => new Entrada(id, id === 'tarjeta' ? 'error' : 'running'),
    );
    await act(() => result.current.start());

    await act(() => cambiarDeMicro('tarjeta'));

    expect(pedidas).toEqual([undefined, 'tarjeta', undefined]);
    expect(useMicrofono.getState().cayo).toBe(true);
  });

  it('y si no abre ninguna, sigue con la de antes', async () => {
    navegadorCon(null);
    let abrir = true;
    const { result, abiertas } = montar((id) => new Entrada(id, abrir ? 'running' : 'error'));
    await act(() => result.current.start());
    abrir = false;

    await act(() => cambiarDeMicro('tarjeta'));

    expect(entradaActiva()).toBe(abiertas[0]);
    expect(abiertas[0]!.state).toBe('running');
    expect(useMicrofono.getState().anuncio).toMatch(/sigo con el de antes/);
  });

  it('si la nueva pide un permiso que se niega, tampoco cae a otra', async () => {
    let abrir: Resultado = 'running';
    const { result, pedidas } = montar((id) => new Entrada(id, abrir));
    await act(() => result.current.start());
    abrir = 'denied';

    await act(() => cambiarDeMicro('tarjeta'));

    expect(pedidas).toEqual([undefined, 'tarjeta']);
    expect(useSessionStore.getState().listening).toBe('listening');
  });

  it('si revienta a mitad, lo dice y suelta lo abierto', async () => {
    const { result, motor } = montar();
    await act(() => result.current.start());
    motor.start = () => Promise.reject(new Error('roto'));

    await act(() => cambiarDeMicro('tarjeta'));

    expect(useSessionStore.getState().listening).toBe('error');
    expect(useSessionStore.getState().message).toMatch(/no he podido cambiar de micrófono/i);
    expect(entradaActiva()).toBeNull();
  });

  it.each(['lista', 'fabrica', 'arranque'] as const)(
    'parar en mitad del cambio (%s) no deja nada abierto',
    async (cuando) => {
      let parar = (): Promise<void> => Promise.resolve();
      const { result, abiertas } = montar((id) => {
        const entrada = new Entrada(id);
        if (id === 'tarjeta' && cuando === 'fabrica') {
          void parar();
        }
        if (id === 'tarjeta' && cuando === 'arranque') {
          const arrancar = entrada.start.bind(entrada);
          entrada.start = async () => {
            await arrancar();
            await parar();
          };
        }
        return entrada;
      });
      parar = result.current.stop;
      await act(() => result.current.start());
      if (cuando === 'lista') {
        const lista = navigator.mediaDevices.enumerateDevices;
        Object.assign(navigator.mediaDevices, {
          enumerateDevices: async () => {
            await parar();
            return lista.call(navigator.mediaDevices);
          },
        });
      }

      await act(() => cambiarDeMicro('tarjeta'));

      expect(entradaActiva()).toBeNull();
      expect(abiertas.every((entrada) => entrada.state !== 'running')).toBe(true);
    },
  );

  it('si se elige otro mientras se abre, se cambia al acabar de abrir', async () => {
    let soltar = (): void => {};
    const espera = new Promise<void>((listo) => {
      soltar = listo;
    });
    const { result, pedidas } = montar((id) => {
      const entrada = new Entrada(id);
      if (id === undefined) {
        const arrancar = entrada.start.bind(entrada);
        entrada.start = async () => {
          await espera;
          await arrancar();
        };
      }
      return entrada;
    });

    let arranque: Promise<void> = Promise.resolve();
    act(() => {
      arranque = result.current.start();
    });
    await waitFor(() => expect(pedidas).toEqual([undefined]));
    await act(() => cambiarDeMicro('tarjeta'));
    expect(pedidas).toEqual([undefined]);

    soltar();
    await act(() => arranque);

    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));
    await waitFor(() => expect((entradaActiva() as Entrada).id).toBe('tarjeta'));
  });

  it('elegir el del sistema mientras se abre otro también cambia al acabar', async () => {
    elegido('tarjeta', 'Scarlett');
    let soltar = (): void => {};
    const espera = new Promise<void>((listo) => {
      soltar = listo;
    });
    const { result, pedidas } = montar((id) => {
      const entrada = new Entrada(id);
      if (id === 'tarjeta') {
        const arrancar = entrada.start.bind(entrada);
        entrada.start = async () => {
          await espera;
          await arrancar();
        };
      }
      return entrada;
    });

    let arranque: Promise<void> = Promise.resolve();
    act(() => {
      arranque = result.current.start();
    });
    await waitFor(() => expect(pedidas).toEqual(['tarjeta']));
    await act(() => cambiarDeMicro(null));
    soltar();
    await act(() => arranque);

    await waitFor(() => expect(pedidas).toEqual(['tarjeta', undefined]));
  });

  it('si se elige mientras se mira la lista, abre ése y una sola vez', async () => {
    elegido('portatil', 'Portátil');
    let darLista = (): void => {};
    const lista = new Promise<void>((listo) => {
      darLista = listo;
    });
    const dispositivos = navigator.mediaDevices as { enumerateDevices: () => Promise<unknown> };
    dispositivos.enumerateDevices = async () => {
      await lista;
      return aparatos;
    };
    const { result, pedidas } = montar();

    let arranque: Promise<void> = Promise.resolve();
    act(() => {
      arranque = result.current.start();
    });
    // Todavía no hay entrada: se está mirando qué pedir.
    expect(entradaActiva()).toBeNull();
    await act(() => cambiarDeMicro('tarjeta'));
    darLista();
    await act(() => arranque);
    await act(() => new Promise((listo) => setTimeout(listo, 5)));

    expect(pedidas).toEqual(['tarjeta']);
  });

  it('y si se elige otro mientras se cambia, se cambia otra vez', async () => {
    let soltar = (): void => {};
    const espera = new Promise<void>((listo) => {
      soltar = listo;
    });
    const { result, pedidas } = montar((id) => {
      const entrada = new Entrada(id);
      if (id === 'tarjeta') {
        const arrancar = entrada.start.bind(entrada);
        entrada.start = async () => {
          await espera;
          await arrancar();
        };
      }
      return entrada;
    });
    await act(() => result.current.start());

    let primero: Promise<void> = Promise.resolve();
    act(() => {
      primero = cambiarDeMicro('tarjeta');
    });
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));
    await act(() => cambiarDeMicro('portatil'));
    soltar();
    await act(() => primero);

    await waitFor(() => expect((entradaActiva() as Entrada).id).toBe('portatil'));
  });
});

/**
 * **Durante una toma el cambio espera.** La toma graba el flujo del aparato que
 * hay, y un `MediaRecorder` no cambia de pista a mitad: cerrar la vieja le
 * cortaría el sonido.
 */
describe('con una toma en marcha', () => {
  it('con la claqueta marcada, espera a que acabe y entonces cambia', async () => {
    const { result, pedidas } = montar();
    await act(() => result.current.start());
    useClaqueta.getState().acciones.marcarToma(true);

    await act(() => cambiarDeMicro('tarjeta'));
    // Dos elecciones seguidas no ponen dos vigilantes.
    await act(() => cambiarDeMicro('tarjeta'));

    expect(pedidas).toEqual([undefined]);
    expect(useMicrofono.getState().pendiente).toBe(true);

    // Lo que cambie en la sesión mientras sigue la toma no lo aplica.
    act(() => useSessionStore.getState().actions.setListening('listening'));
    expect(useMicrofono.getState().pendiente).toBe(true);

    act(() => useClaqueta.getState().acciones.marcarToma(false));
    expect(useMicrofono.getState().pendiente).toBe(false);
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));
  });

  it('con la captura en marcha, también', async () => {
    const { result, pedidas } = montar();
    await act(() => result.current.start());
    act(() => useSessionStore.getState().actions.startCapture(0));

    await act(() => cambiarDeMicro('tarjeta'));
    expect(pedidas).toEqual([undefined]);

    act(() => useSessionStore.getState().actions.stopCapture(1));
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));
  });

  it('con la entrada sujeta por el grabador, espera a que la suelte', async () => {
    const { result, pedidas } = montar();
    await act(() => result.current.start());
    // La toma ya soltó la claqueta y la captura, pero el grabador sigue.
    const soltar = sujetarLaEntrada();

    await act(() => cambiarDeMicro('tarjeta'));
    expect(pedidas).toEqual([undefined]);
    expect(useMicrofono.getState().pendiente).toBe(true);

    act(() => soltar());
    // Soltar dos veces no descuenta otra toma.
    act(() => soltar());
    expect(useMicrofono.getState().pendiente).toBe(false);
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));

    await act(() => cambiarDeMicro('portatil'));
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta', 'portatil']));
  });

  it('si al acabar la toma el micro ya está cerrado, no abre nada', async () => {
    const { result, pedidas } = montar();
    await act(() => result.current.start());
    useClaqueta.getState().acciones.marcarToma(true);
    await act(() => cambiarDeMicro('tarjeta'));

    await act(() => result.current.stop());
    act(() => useClaqueta.getState().acciones.marcarToma(false));
    await act(() => new Promise((listo) => setTimeout(listo, 5)));

    expect(pedidas).toEqual([undefined]);
    expect(useMicrofono.getState().elegido).toBe('tarjeta');
  });

  it('irse el último en mitad lo olvida', async () => {
    const { result, unmount } = montar();
    await act(() => result.current.start());
    useClaqueta.getState().acciones.marcarToma(true);
    await act(() => cambiarDeMicro('tarjeta'));

    unmount();

    expect(useMicrofono.getState().pendiente).toBe(false);
  });
});

/** Al enchufar o desenchufar algo, la lista se pone al día y la escucha también. */
describe('al conectar y desconectar', () => {
  it('con el micro cerrado, solo pone al día la lista', async () => {
    montar();
    aparatos = [...DOS, { deviceId: 'nueva', label: 'Nueva', kind: 'audioinput' }];

    await act(async () => alCambiar?.());

    await waitFor(() => expect(useMicrofono.getState().entradas).toHaveLength(3));
  });

  it('si se va la que suena, cambia ya al del sistema', async () => {
    elegido('tarjeta', 'Scarlett');
    const { result, pedidas, abiertas } = montar();
    await act(() => result.current.start());
    abiertas[0]!.viva = false;
    aparatos = DOS.filter((aparato) => aparato.deviceId !== 'tarjeta');

    await act(async () => alCambiar?.());

    await waitFor(() => expect(pedidas).toEqual(['tarjeta', undefined]));
    expect(useMicrofono.getState().cayo).toBe(true);
  });

  it('sin elegido, si se va la que suena, vuelve a abrir la del sistema', async () => {
    const { result, pedidas, abiertas } = montar();
    await act(() => result.current.start());
    abiertas[0]!.viva = false;

    await act(async () => alCambiar?.());

    await waitFor(() => expect(pedidas).toEqual([undefined, undefined]));
    expect(useMicrofono.getState().anuncio).toMatch(/escucho por el del sistema/);
  });

  it('si vuelve la elegida, vuelve a ella', async () => {
    elegido('tarjeta', 'Scarlett');
    aparatos = DOS.filter((aparato) => aparato.deviceId !== 'tarjeta');
    const { result, pedidas } = montar();
    await act(() => result.current.start());
    expect(useMicrofono.getState().cayo).toBe(true);
    aparatos = DOS;

    await act(async () => alCambiar?.());

    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));
    expect(useMicrofono.getState().cayo).toBe(false);
    expect(useMicrofono.getState().anuncio).toMatch(/Ha vuelto/);
  });

  it('y si vuelve en plena toma, espera a que acabe', async () => {
    elegido('tarjeta', 'Scarlett');
    aparatos = DOS.filter((aparato) => aparato.deviceId !== 'tarjeta');
    const { result, pedidas } = montar();
    await act(() => result.current.start());
    useClaqueta.getState().acciones.marcarToma(true);
    aparatos = DOS;

    await act(async () => alCambiar?.());

    await waitFor(() => expect(useMicrofono.getState().pendiente).toBe(true));
    expect(pedidas).toEqual([undefined]);
    act(() => useClaqueta.getState().acciones.marcarToma(false));
    await waitFor(() => expect(pedidas).toEqual([undefined, 'tarjeta']));
  });

  it('con todo en su sitio, no toca nada', async () => {
    const { result, pedidas } = montar();
    await act(() => result.current.start());

    await act(async () => alCambiar?.());

    expect(pedidas).toEqual([undefined]);
  });

  it('al irse el último deja de vigilar', () => {
    const { unmount } = montar();
    expect(alCambiar).not.toBeNull();

    unmount();

    expect(alCambiar).toBeNull();
  });
});
