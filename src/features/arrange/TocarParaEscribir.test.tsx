// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { StreamSource } from '@audio/stream-source';
import type { ChordEngine } from '@audio/chord-engine';
import type { PitchEngine } from '@audio/pitch-engine';
import { pitchClassFromName } from '@core/music';
import type { MicInput, MicState } from '@media/mic-input';
import type { Recording, RecorderState, SessionRecorder } from '@media/session-recorder';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { TocarParaEscribir } from './TocarParaEscribir';

/**
 * Componer tocando.
 *
 * Lo que se prueba es **el gesto**: que una sola pulsación abra el micro, grabe
 * y empiece a apuntar, y que al parar lo tocado esté ya en la canción. Estaba
 * construido entero y en dos tiempos —«apuntar» y luego «traer lo grabado»—, y
 * el segundo paso es justo el que se olvidaba
 * ([adr/0034](../../../docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
 */

/**
 * Los falsos del audio, con la misma forma que los de `use-listening.test`: aquí
 * no se prueba el motor, se prueba el gesto.
 */
class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;
  #oyentes = new Set<(state: AudioInputState) => void>();

  // **Avisa de su estado**, que es de donde se entera la escucha: quien no lo
  // hace deja el estado en «pidiendo permiso» para siempre, y eso no es un
  // detalle del falso sino lo que hace la entrada de verdad.
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

/**
 * Una entrada que **sí tiene flujo que prestar**, como la de verdad.
 *
 * `WebAudioInput` implementa `StreamSource`: guarda el `MediaStream` que abrió y
 * se lo presta a quien grabe. Con ésta se prueba el camino bueno —un micrófono,
 * no dos—; con `EntradaFalsa`, el de respaldo.
 */
class EntradaQuePresta extends EntradaFalsa implements StreamSource {
  stream: MediaStream | null = null;
  override async start(): Promise<void> {
    await super.start();
    this.stream = { id: 'el-de-analizar' } as MediaStream;
  }
  override async stop(): Promise<void> {
    await super.stop();
    this.stream = null;
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

class MicFalso implements MicInput {
  state: MicState = 'idle';
  errorMessage: string | null = null;
  stream: MediaStream | null = null;
  async start() {
    this.state = 'running';
    this.stream = {} as MediaStream;
  }
  async stop() {
    this.state = 'idle';
    this.stream = null;
  }
  subscribe(): () => void {
    return () => {};
  }
}

class GrabadorFalso implements SessionRecorder {
  state: RecorderState = 'idle';
  errorMessage: string | null = null;
  /** Con qué flujo arrancó: es lo que dice si se compartió el micro o no. */
  conFlujo: MediaStream | null = null;
  async start(options: { readonly audio: MediaStream }) {
    this.state = 'recording';
    this.conFlujo = options.audio;
  }
  pause(): void {}
  resume(): void {}
  subscribe(): () => void {
    return () => {};
  }
  async stop(): Promise<Recording> {
    this.state = 'idle';
    return {
      blob: new Blob(['x'], { type: 'audio/webm' }),
      filename: 'toma.webm',
      mimeType: 'audio/webm',
      durationMs: 4000,
    };
  }
}

const DEPS = {
  createInput: () => new EntradaFalsa(),
  createEngine: () => new MotorFalso(),
  createChordEngine: () => new CromaFalso(),
  createMic: () => new MicFalso(),
  createRecorder: () => new GrabadorFalso(),
};

const C = pitchClassFromName('C');

/**
 * El reloj avanza a saltos.
 *
 * Es `performance.now` quien marca el tramo apuntado, y en un test todo ocurre
 * en el mismo milisegundo: un acorde que dura cero no llega a un pulso y
 * `captureProgression` lo descarta, con razón. Con el reloj a saltos, lo que se
 * prueba deja de depender de lo rápido que vaya la máquina.
 */
let ahora = 0;

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  useArrangementStore.setState({ arrangement: { parts: [] }, past: [] });
  ahora = 0;
  vi.stubGlobal('performance', { ...performance, now: () => (ahora += 2000) });
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:toma',
    revokeObjectURL: () => undefined,
  });
});

/** Deja apuntado un acorde, como haría el motor de croma mientras suena. */
function suenaUnAcorde(): void {
  const { actions } = useSessionStore.getState();
  actions.setHeardChord({
    symbol: 'C',
    root: C,
    notes: [0, 4, 7],
    // Dentro del tramo apuntado: el reloj va por 2000 al empezar y estará en
    // 4000 al parar.
    at: 2500,
    score: 0.95,
    margin: 0.3,
    alternatives: [],
  });
}

describe('Tocar para escribir', () => {
  it('sin tonalidad no se puede empezar, y se dice por que', () => {
    render(<TocarParaEscribir deps={DEPS} />);

    expect(screen.getByText(/Elige una tonalidad y toca/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tocar$/ })).not.toBeInTheDocument();
  });

  it('una sola pulsacion abre el micro y empieza a apuntar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(useSessionStore.getState().listening).toBe('listening');
    expect(useSessionStore.getState().capturing).toBe(true);
    expect(screen.getByRole('button', { name: /Parar y escribirlo/ })).toBeInTheDocument();
  });

  // Tocar contra una pantalla quieta es tocar a ciegas: hay que ver que te oye.
  it('mientras suena se ve el acorde que reconoce', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    suenaUnAcorde();

    expect(await screen.findByText('C')).toBeInTheDocument();
  });

  /**
   * **El papel se elige antes de tocar, y cambia lo que se ve.**
   *
   * Los dos motores corren a la vez sobre la misma entrada, así que una toma
   * daba acordes y notas siempre y nadie decía cuál era la buena: un punteo
   * salía escrito como acordes. Con el punteo puesto, el acorde que el croma
   * cree reconocer **no se va a escribir**, así que enseñarlo sería prometer
   * algo que no pasa.
   */
  it('con el punteo puesto no se ensena el acorde que oye el croma', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Punteo' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    suenaUnAcorde();

    await waitFor(() => expect(screen.getByText('Punteo')).toBeInTheDocument());
    expect(screen.queryByText('C')).not.toBeInTheDocument();
    expect(screen.getByText(/escuchando el punteo/)).toBeInTheDocument();
  });

  it('y con la ritmica, que es lo de siempre, si', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Rítmica' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    suenaUnAcorde();

    expect(await screen.findByText('C')).toBeInTheDocument();
  });

  /**
   * El paso que se olvidaba: antes había que acordarse de pulsar además «traer
   * lo grabado», y sin eso lo tocado no entraba en ninguna parte.
   */
  it('al parar, lo tocado ya esta en la cancion', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    suenaUnAcorde();

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/Ya está en la canción/);
  });

  it('y el micro se cierra al parar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(useSessionStore.getState().listening).toBe('idle');
    expect(useSessionStore.getState().capturing).toBe(false);
  });

  /**
   * La toma se queda al lado de lo transcrito, y no es adorno: transcribir
   * pierde cosas a propósito —las notas iguales seguidas se funden, el croma
   * olvida la octava— y el sonido de verdad es lo que deja comprobar qué se
   * perdió.
   */
  it('la toma de audio se queda para poder oirla', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(screen.getByLabelText('La toma que acabas de grabar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeInTheDocument();
    // Y cuánto dura, dicho por nosotros: el WebM de `MediaRecorder` no lleva la
    // duración en la cabecera, así que el reproductor enseña «0:00» de total
    // hasta que la toma se reproduce entera.
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });

  it('y lleva a verlo escrito, que es a donde se va despues', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const ido: string[] = [];
    render(<TocarParaEscribir deps={DEPS} onEscrito={() => ido.push('escribir')} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    suenaUnAcorde();
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    await userEvent.click(screen.getByRole('button', { name: /Verlo en la partitura/ }));

    expect(ido).toEqual(['escribir']);
  });
});

/**
 * Un micrófono, no dos.
 *
 * Lo fueron: `audio/` abría el suyo para el tono y el croma y `media/` otro para
 * los bytes. Dos `getUserMedia` sobre el mismo aparato son dos permisos y dos
 * pilotos, y en un iPhone el segundo puede quedarse con el dispositivo y dejar
 * al primero sin señal, que es la mitad de la aplicación apagándose sola.
 */
describe('el microfono se comparte', () => {
  it('graba sobre el flujo que ya abrio el analisis, sin pedir otro', async () => {
    const mic = new MicFalso();
    const grabador = new GrabadorFalso();
    const entrada = new EntradaQuePresta();
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(
      <TocarParaEscribir
        deps={{
          ...DEPS,
          createInput: () => entrada,
          createMic: () => mic,
          createRecorder: () => grabador,
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(grabador.conFlujo).toBe(entrada.stream);
    // Y el de `media/` ni se toca: ése es el segundo permiso que ya no se pide.
    expect(mic.state).toBe('idle');
  });

  // Una entrada sin flujo que prestar —un doble, un navegador raro— sigue
  // teniendo su camino: quedarse sin la toma no puede ser la respuesta.
  it('y si no hay flujo que prestar, se abre el de media como siempre', async () => {
    const mic = new MicFalso();
    const grabador = new GrabadorFalso();
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(
      <TocarParaEscribir
        deps={{ ...DEPS, createMic: () => mic, createRecorder: () => grabador }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(mic.state).toBe('running');
    expect(grabador.conFlujo).toBe(mic.stream);
  });
});

/**
 * Lo que pasa cuando algo de todo esto falla, que es la mitad de lo que hace
 * este gesto: abrir el micro, grabar y apuntar son tres cosas, y solo la
 * primera es imprescindible.
 */
describe('cuando algo no sale', () => {
  /** Una entrada que no llega a arrancar: sin motor no hay nada que apuntar. */
  class EntradaQueNoArranca extends EntradaFalsa {
    override async start(): Promise<void> {}
  }

  class MicQueNoArranca implements MicInput {
    state: MicState = 'idle';
    errorMessage: string | null = 'No me dejan abrir el micrófono.';
    stream: MediaStream | null = null;
    async start() {
      this.state = 'error';
    }
    async stop() {}
    subscribe(): () => void {
      return () => {};
    }
  }

  class GrabadorQueNoArranca extends GrabadorFalso {
    override async start() {
      this.state = 'error';
      this.errorMessage = 'Este navegador no graba en ese formato.';
    }
  }

  it('sin motor no se empieza, y el boton vuelve a su sitio', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={{ ...DEPS, createInput: () => new EntradaQueNoArranca() }} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(useSessionStore.getState().capturing).toBe(false);
    expect(screen.getByRole('button', { name: /^Tocar$/ })).toBeInTheDocument();
  });

  /**
   * Sin sonido grabado sí se sigue: lo que se viene a hacer es escribir la
   * canción, y quedarse sin la toma no impide ninguna de las dos cosas. Lo que
   * no se puede es callárselo.
   */
  it('sin micro de respaldo se sigue, contando por que', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={{ ...DEPS, createMic: () => new MicQueNoArranca() }} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(useSessionStore.getState().capturing).toBe(true);
    expect(screen.getByText('No me dejan abrir el micrófono.')).toBeInTheDocument();
  });

  it('y si el que falla es el grabador, tambien', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const mic = new MicFalso();
    render(
      <TocarParaEscribir
        deps={{ ...DEPS, createMic: () => mic, createRecorder: () => new GrabadorQueNoArranca() }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(useSessionStore.getState().capturing).toBe(true);
    expect(screen.getByText('Este navegador no graba en ese formato.')).toBeInTheDocument();
    // Y el micro que se abrió para nada se cierra: es el peor fallo posible en
    // una aplicación cuya primera promesa es que el audio no sale de aquí.
    expect(mic.state).toBe('idle');
  });

  // Sin motivo que dar, una frase que al menos diga qué se ha perdido.
  it('sin motivo, se dice igual que no hay grabacion', async () => {
    class GrabadorMudo extends GrabadorQueNoArranca {
      override async start() {
        this.state = 'error';
        this.errorMessage = null;
      }
    }
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={{ ...DEPS, createRecorder: () => new GrabadorMudo() }} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(screen.getByText(/te sigo oyendo/)).toBeInTheDocument();
  });
});

describe('la toma, una detras de otra', () => {
  /**
   * Cada toma tiene su dirección, y la anterior se suelta: un `blob:` que nadie
   * libera se queda en memoria hasta que se cierra la pestaña, y aquí se graba
   * una vez detrás de otra.
   */
  it('al grabar otra, la anterior se suelta', async () => {
    const soltadas: string[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:toma',
      revokeObjectURL: (url: string) => soltadas.push(url),
    });
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    for (let vez = 0; vez < 2; vez += 1) {
      await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
      await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));
    }

    expect(soltadas).toEqual(['blob:toma']);
  });

  // Y se descarga: el sonido es tuyo y no sale de aquí si no lo sacas tú.
  it('se descarga con el nombre que trae', async () => {
    const pulsados: Array<{ href: string; download: string }> = [];
    const crear = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((etiqueta: string) => {
      const nodo = crear(etiqueta) as HTMLAnchorElement;
      if (etiqueta === 'a') {
        nodo.click = () => pulsados.push({ href: nodo.href, download: nodo.download });
      }
      return nodo;
    });
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    await userEvent.click(screen.getByRole('button', { name: /Descargar/ }));

    expect(pulsados).toEqual([{ href: 'blob:toma', download: 'toma.webm' }]);
    vi.restoreAllMocks();
  });

  /**
   * Y sin fábricas que sustituyan el micro y el grabador se usan los de verdad,
   * que en jsdom no arrancan: no hay toma, pero lo tocado se escribe igual.
   * Es el camino de un navegador que no deja grabar.
   */
  it('con el micro y el grabador de verdad, se escribe sin toma', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(
      <TocarParaEscribir
        deps={{
          createInput: () => new EntradaFalsa(),
          createEngine: () => new MotorFalso(),
          createChordEngine: () => new CromaFalso(),
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    suenaUnAcorde();
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(1);
    expect(screen.queryByLabelText('La toma que acabas de grabar')).not.toBeInTheDocument();
  });
});

describe('lo que se ve mientras tocas', () => {
  /**
   * El contador de segundos es una de las tres señales de que te está oyendo, y
   * la única que se mueve sola: sin él, una pantalla quieta durante medio minuto
   * se lee como que esto se ha colgado.
   */
  it('los segundos corren mientras se toca', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    // Con el reloj de verdad y no con uno falso: este fichero ya tiene
    // `performance.now` a saltos para medir el tramo apuntado, y dos relojes
    // fingidos a la vez dejan el contador donde estaba.
    await waitFor(() => expect(screen.getByText(/· 1s/)).toBeInTheDocument(), { timeout: 3000 });
  });

  /**
   * Y con el flujo prestado pero sin fábrica de grabador se usa el de verdad,
   * que en jsdom no tiene `MediaRecorder`: se sigue apuntando y se cuenta.
   */
  it('sin fabrica de grabador, el de verdad no arranca y se dice', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(
      <TocarParaEscribir
        deps={{
          createInput: () => new EntradaQuePresta(),
          createEngine: () => new MotorFalso(),
          createChordEngine: () => new CromaFalso(),
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(useSessionStore.getState().capturing).toBe(true);
    expect(screen.getByRole('button', { name: /Parar y escribirlo/ })).toBeInTheDocument();
  });

  /**
   * **Lo que ya llevas, delante.** Aquí había un botón sobre una pantalla en
   * negro —el 97 % del área vacío, medido— y lo que se toca entra como una
   * parte más al final: sin ver qué hay ya, se graba sin saber dónde.
   */
  it('ensena lo que ya llevas escrito antes de tocar', () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const id = useArrangementStore.getState().actions.addPart('Estrofa');
    useArrangementStore.getState().actions.addBlock(id, 'I', 4);

    render(<TocarParaEscribir deps={DEPS} />);

    const llevas = within(screen.getByRole('list', { name: 'Lo que ya llevas' }));
    expect(llevas.getByText('C')).toBeInTheDocument();
  });

  it('con la cancion en blanco no ensena nada', () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });

    render(<TocarParaEscribir deps={DEPS} />);

    expect(screen.queryByRole('list', { name: 'Lo que ya llevas' })).not.toBeInTheDocument();
  });

  /** Tocando estorba: lo que importa entonces es lo que te está oyendo. */
  it('mientras se toca, se quita de en medio', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const id = useArrangementStore.getState().actions.addPart('Estrofa');
    useArrangementStore.getState().actions.addBlock(id, 'I', 4);
    render(<TocarParaEscribir deps={DEPS} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    expect(screen.queryByRole('list', { name: 'Lo que ya llevas' })).not.toBeInTheDocument();
  });
});
