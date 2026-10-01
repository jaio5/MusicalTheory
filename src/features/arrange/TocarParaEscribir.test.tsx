// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { StreamSource } from '@audio/stream-source';
import type { ChordEngine } from '@audio/chord-engine';
import type { Metronome, MetronomeOptions } from '@audio/metronome';
import type { PitchEngine, PitchFrame } from '@audio/pitch-engine';
import { pitchClassFromName } from '@core/music';
import type { MicInput, MicState } from '@media/mic-input';
import type { Recording, RecorderState, SessionRecorder } from '@media/session-recorder';
import { useArrangementStore } from '@state/arrangement-store';
import { useClaqueta, VOLUMEN_DE_PARTIDA } from '@state/claqueta';
import { useListening } from '@state/use-listening';
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

/**
 * Un motor que además entrega cada análisis, como el de verdad: es lo que lee la
 * toma para transcribir un punteo entero.
 */
class MotorConFotogramas extends MotorFalso {
  static ultimo: MotorConFotogramas | null = null;
  #oyentes = new Set<(frame: PitchFrame) => void>();
  constructor() {
    super();
    MotorConFotogramas.ultimo = this;
  }
  subscribeFrames(oyente: (frame: PitchFrame) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }
  emitir(frame: PitchFrame): void {
    for (const oyente of this.#oyentes) {
      oyente(frame);
    }
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

/**
 * Un metrónomo de mentira: los pulsos los da el test.
 *
 * Hace falta uno porque en jsdom no hay `AudioContext`, así que el de verdad no
 * arranca y la cuenta se salta sola —a propósito, para no colgar la grabación—.
 * Con esto se puede probar la cuenta de verdad, golpe a golpe.
 */
class MetronomoFalso implements Metronome {
  static ultimo: MetronomoFalso | null = null;
  running = false;
  /** El volumen con el que arrancó y los que se le han ido poniendo. */
  volumenes: number[] = [];
  #onBeat: ((beat: number, instante?: number) => void) | undefined;
  #dados = 0;

  constructor() {
    MetronomoFalso.ultimo = this;
  }

  async start(options: MetronomeOptions): Promise<void> {
    this.#onBeat = options.onBeat;
    this.volumenes.push(options.volume ?? 1);
    this.running = true;
  }

  setBpm(): void {}

  setVolume(volumen: number): void {
    this.volumenes.push(volumen);
  }

  stop(): void {
    this.running = false;
  }

  async dispose(): Promise<void> {
    this.running = false;
  }

  /** Un golpe, como si hubiera sonado el clic. */
  pulso(): void {
    this.#onBeat?.(this.#dados % 4);
    this.#dados += 1;
  }
}

const DEPS = {
  createInput: () => new EntradaFalsa(),
  createEngine: () => new MotorFalso(),
  createChordEngine: () => new CromaFalso(),
  createMic: () => new MicFalso(),
  createRecorder: () => new GrabadorFalso(),
};

/** Lo mismo, pero con una claqueta que se puede llevar a mano. */
const DEPS_CON_CLAQUETA = { ...DEPS, createMetronome: () => new MetronomoFalso() };

/** Da los golpes que se le digan, esperando a que React se entere. */
async function golpes(cuantos: number): Promise<void> {
  for (let i = 0; i < cuantos; i += 1) {
    await act(async () => {
      MetronomoFalso.ultimo?.pulso();
    });
  }
}

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
  useClaqueta.setState({ volumen: VOLUMEN_DE_PARTIDA, callada: false, enLaToma: false });
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

/**
 * **La claqueta: dos compases y se calla.**
 *
 * Antes de esto se apuntaba desde la pulsación, y la transcripción convertía lo
 * tocado con el `bpm` de los ajustes: si tocabas a otro tempo, todo caía en el
 * sitio equivocado y nadie te había dado un pulso al que agarrarte
 * ([adr/0053](../../../docs/adr/0053-la-claqueta-cuenta-y-se-calla.md)).
 */
describe('la claqueta antes de apuntar', () => {
  beforeEach(() => {
    MetronomoFalso.ultimo = null;
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
  });

  it('cuenta dos compases antes de empezar a apuntar', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    // La toma empieza en la cuenta: la barra ya se ha apartado.
    expect(useClaqueta.getState().enLaToma).toBe(true);

    // Contando: ni se apunta todavía, ni el botón dice «parar y escribirlo».
    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(useSessionStore.getState().capturing).toBe(false);
    expect(screen.getByRole('button', { name: /Dejarlo/ })).toBeInTheDocument();

    // Siete golpes y sigue contando; con el octavo, arranca.
    await golpes(7);
    expect(useSessionStore.getState().capturing).toBe(false);

    await golpes(1);
    await waitFor(() => {
      expect(useSessionStore.getState().capturing).toBe(true);
    });
    expect(screen.getByRole('button', { name: /Parar y escribirlo/ })).toBeInTheDocument();
  });

  /**
   * **Y sigue sonando mientras se toca**, que es lo que cambia: antes se callaba
   * porque el micro lo oía. Ahora el golpe no tiene altura y vive por encima de
   * lo que se analiza, así que el pulso acompaña la toma entera y se calla al
   * parar.
   */
  it('sigue sonando durante la toma, y se calla al parar', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await golpes(8);
    await waitFor(() => {
      expect(useSessionStore.getState().capturing).toBe(true);
    });

    expect(MetronomoFalso.ultimo?.running, 'la claqueta se ha callado').toBe(true);
    // La barra sabe que hay toma, y se aparta.
    expect(useClaqueta.getState().enLaToma).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));
    expect(MetronomoFalso.ultimo?.running).toBe(false);
    expect(useClaqueta.getState().enLaToma).toBe(false);
  });

  // La luz del pulso, para quien ha quitado el clic: se ve y no se anuncia.
  it('mientras se toca se ve el pulso y que se esta grabando', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await golpes(8);
    await waitFor(() => {
      expect(screen.getByText('Grabando')).toBeInTheDocument();
    });
    await golpes(2);

    const luces = screen
      .getByText('Grabando')
      .parentElement!.querySelectorAll('span[aria-hidden="true"] > span');
    expect(luces).toHaveLength(4);
    // Dos clics de la toma: el uno y el dos. Luce el segundo.
    expect(luces[1]).toHaveClass('bg-text-muted');
    expect(luces[0]).toHaveClass('bg-border');

    await golpes(3);
    expect(luces[0]).toHaveClass('bg-brass-bright');
  });

  /**
   * **Se puede bajar y quitar**, antes y durante. Quitarlo no para el pulso: el
   * metrónomo sigue contando en silencio, y la rejilla sigue sabiendo dónde cae
   * cada compás.
   */
  it('el clic se baja y se quita, tambien mientras suena', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);
    const volumen = screen.getByRole('slider', { name: 'Volumen del clic' });
    expect(volumen).toHaveValue(String(VOLUMEN_DE_PARTIDA * 100));
    expect(volumen).toHaveAttribute('aria-valuetext', '80 por ciento');

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await golpes(8);
    // Arranca con el volumen puesto.
    expect(MetronomoFalso.ultimo?.volumenes[0]).toBe(VOLUMEN_DE_PARTIDA);

    const quitar = screen.getByRole('button', { name: 'Clic durante la toma' });
    expect(quitar).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(quitar);
    expect(quitar).toHaveAttribute('aria-pressed', 'false');
    expect(MetronomoFalso.ultimo?.volumenes.at(-1)).toBe(0);
    expect(screen.getByRole('slider', { name: 'Volumen del clic' })).toHaveAttribute(
      'aria-valuetext',
      'Sin clic',
    );
    // Y sigue llevando el pulso.
    expect(MetronomoFalso.ultimo?.running).toBe(true);

    // Mover el volumen es querer oírlo: vuelve.
    act(() => {
      useClaqueta.getState().acciones.ponerVolumen(0.3);
    });
    await waitFor(() => {
      expect(MetronomoFalso.ultimo?.volumenes.at(-1)).toBe(0.3);
    });
    expect(screen.getByRole('button', { name: 'Clic durante la toma' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('el volumen se mueve con el deslizador', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);
    const volumen = screen.getByRole('slider', { name: 'Volumen del clic' });

    // `fireEvent` y no `userEvent`: jsdom no sabe arrastrar un deslizador.
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(volumen, { target: { value: '40' } });

    expect(useClaqueta.getState().volumen).toBe(0.4);
  });

  // La cuenta se ve además de oírse:  // La cuenta se ve además de oírse: dos compases sin nada en pantalla se leen
  // como que la aplicación se ha quedado colgada.
  it('la cuenta se ve bajar', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    expect(await screen.findByText('8')).toBeInTheDocument();

    await golpes(3);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  /**
   * **Al lector, dos frases y no ocho números.** Su voz sale por el altavoz y el
   * micro está abierto, así que cada número leído se pisaba con la claqueta y el
   * último caía dentro de la toma. Y la región existe antes de contar: una que
   * nace con el texto dentro no se anuncia, y se perdía el primer aviso.
   */
  it('la cuenta se anuncia poco, y en una region que ya estaba', async () => {
    const { container } = render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);
    const region = container.querySelector('p.sr-only[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region).toBeEmptyDOMElement();

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await screen.findByText('8');
    // El número grande no habla: si lo hiciera, leería los ocho pulsos.
    expect(screen.getByText('8').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(region).toHaveTextContent(/Faltan dos compases/);

    await golpes(3);
    expect(region).toHaveTextContent(/Faltan dos compases/);

    await golpes(1);
    expect(region).toHaveTextContent('Último compás. Después, grabando.');

    await golpes(4);
    await waitFor(() => {
      expect(useSessionStore.getState().capturing).toBe(true);
    });
    // **El mismo texto**, así que no se vuelve a leer: nada suena encima del
    // compás uno, y lo que se dijo en el último compás ya anunciaba la grabación.
    expect(region).toHaveTextContent('Último compás. Después, grabando.');

    // Al parar, con el micro ya cerrado, se dice.
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));
    expect(region).toHaveTextContent('Toma parada.');
  });

  /**
   * Cortar la cuenta no es fallar al tocar. Sin un camino propio, parar aquí
   * pasaba por apuntar lo tocado —que es nada— y contestaba «no he podido leer
   * nada», que es culpar a quien solo ha cambiado de idea.
   */
  it('cortarla no escribe nada ni dice que no se ha entendido', async () => {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await golpes(2);
    await userEvent.click(screen.getByRole('button', { name: /Dejarlo/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Tocar$/ })).toBeInTheDocument();
    });
    expect(useClaqueta.getState().enLaToma).toBe(false);
    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
    expect(screen.queryByText(/no he podido leer/i)).not.toBeInTheDocument();
  });
});

/**
 * **El punteo se transcribe de cada análisis, y la toma no tiene tope.**
 *
 * Se leía del historial de la sesión, que guarda las veinticuatro últimas
 * entradas: una toma de veinte notas se quedaba en las cinco del final, medido en
 * el navegador. Ahora se apunta cada análisis del motor mientras se toca.
 */
describe('el punteo de una toma entera', () => {
  beforeEach(() => {
    MetronomoFalso.ultimo = null;
    MotorConFotogramas.ultimo = null;
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    // A 60, un pulso es un segundo.
    useSessionStore.getState().actions.setTempo(60, 4);
  });

  it('cuarenta notas seguidas entran todas, con su sitio en la rejilla', async () => {
    render(
      <TocarParaEscribir
        deps={{ ...DEPS_CON_CLAQUETA, createEngine: () => new MotorConFotogramas() }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Punteo' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    // El reloj del test avanza 2000 en cada lectura: los clics de la cuenta caen
    // donde caigan, y el compás uno es un pulso después del octavo.
    await golpes(8);
    await waitFor(() => {
      expect(useSessionStore.getState().capturing).toBe(true);
    });
    const desde = useSessionStore.getState().captureStartedAt;
    // Cambiar el tempo a mitad no cambia contra qué se mide: se tocó a 60.
    useSessionStore.getState().actions.setTempo(120, 4);

    // Cuarenta negras, Do y Re alternos, cada una con cuatro análisis.
    act(() => {
      for (let nota = 0; nota < 40; nota += 1) {
        for (let k = 0; k < 4; k += 1) {
          MotorConFotogramas.ultimo!.emitir({
            at: desde + 40 + nota * 1000 + k * 200,
            frequency: nota % 2 === 0 ? 261.63 : 293.66,
            clarity: 0.98,
            rms: 0.1 - k * 0.01,
          });
        }
      }
      // Y el silencio del final, que también se apunta: es donde acaba la última.
      MotorConFotogramas.ultimo!.emitir({
        at: desde + 40 + 40 * 1000,
        frequency: null,
        clarity: 0,
        rms: 0.0004,
      });
    });
    // Que el final quede detrás de la última nota.
    ahora = desde + 50_000;
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    const [parte] = useArrangementStore.getState().arrangement.parts;
    expect(parte!.notes).toHaveLength(40);
    expect(parte!.notes.map((nota) => nota.start)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect(screen.getByText(/He apuntado 40 notas de punteo/)).toBeInTheDocument();
  });

  /**
   * Si el micro se cierra durante la cuenta —desde otro botón de escuchar—, la
   * toma no tiene motor del que apuntarse: sigue, y al parar no escribe notas.
   */
  it('si el micro se cierra durante la cuenta, la toma no revienta', async () => {
    function CerrarMicro() {
      const { stop } = useListening();
      return (
        <button type="button" onClick={() => void stop()}>
          Cerrar el micro
        </button>
      );
    }
    render(
      <>
        <TocarParaEscribir
          deps={{ ...DEPS_CON_CLAQUETA, createEngine: () => new MotorConFotogramas() }}
        />
        <CerrarMicro />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Punteo' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el micro' }));
    await golpes(8);
    await waitFor(() => {
      expect(useSessionStore.getState().capturing).toBe(true);
    });

    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));
    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
  });

  /**
   * **Diez minutos y se para sola, escribiendo lo tocado.** No es un tope musical:
   * es la red para quien deja el micro abierto y se va.
   */
  it('a los diez minutos se para y escribe, y lo dice', async () => {
    let reloj = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => reloj);
    render(<TocarParaEscribir deps={DEPS} />);
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    suenaUnAcorde();

    reloj = 601_000;
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /^Tocar$/ })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText(/ha llegado a los 10 minutos y se ha parado sola/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

/**
 * **Solo grabar: el tercer papel, que antes era otra pantalla.**
 *
 * Había una herramienta aparte —una pastilla «Grabar» en la fila de abajo— que
 * hacía lo mismo que esto menos transcribir, con su propio reproductor, su propia
 * descarga y **su propio micrófono**. Lo único suyo era no escribir en la canción,
 * y eso es un papel de la toma
 * ([adr/0056](../../../docs/adr/0056-grabar-es-un-papel-de-la-toma.md)).
 */
describe('solo grabar', () => {
  beforeEach(() => {
    MetronomoFalso.ultimo = null;
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
  });

  /** Elige «Solo grabar», graba y para. */
  async function unaToma() {
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);
    await userEvent.click(screen.getByRole('button', { name: 'Solo grabar' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Parar y escribirlo/ })).toBeInTheDocument();
    });
    suenaUnAcorde();
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));
  }

  /**
   * **No cuenta los dos compases.** No se escribe nada, así que no hay rejilla que
   * cuadrar y contar sería esperar por esperar.
   */
  it('no cuenta compases antes de empezar', async () => {
    const { container } = render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);
    await userEvent.click(screen.getByRole('button', { name: 'Solo grabar' }));
    // Sin rejilla no hay clic, y no se ofrece.
    expect(screen.queryByRole('slider', { name: 'Volumen del clic' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));

    await waitFor(() => {
      expect(useSessionStore.getState().capturing).toBe(true);
    });
    expect(screen.queryByText('8'), 'ha contado').not.toBeInTheDocument();
    // Aquí sí se dice «grabando»: lo que se oiga de la voz no se va a escribir.
    expect(container.querySelector('p.sr-only[aria-live="polite"]')).toHaveTextContent('Grabando.');
  });

  /**
   * Y no escribe. Sin este camino, la toma pasaba por leer los dos motores, no
   * encontraba nada —porque no se le ha pedido— y contestaba «no he podido leer ni
   * un acorde», que es culpar al micro de hacer lo que se le mandó.
   */
  it('no escribe nada en la cancion, y no lo llama fallo', async () => {
    await unaToma();

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
    expect(screen.queryByText(/no he podido leer/i)).not.toBeInTheDocument();
  });

  // La toma sí se queda: para oírla y llevártela, que es a lo que se venía.
  it('la toma se queda para oirla y descargarla', async () => {
    await unaToma();

    expect(await screen.findByLabelText('La toma que acabas de grabar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeInTheDocument();
  });

  /**
   * **Y se puede grabar sin haber elegido tonalidad**, que era lo único que el
   * grabador suelto hacía y esto no: los otros dos papeles escriben grados sobre
   * una tonalidad, y este no escribe nada.
   *
   * Aquí se prueba la pantalla sola. En `/componer` hay otra puerta antes —la
   * pantalla entera pide la tonalidad—, y eso está dicho en
   * [adr/0056](../../../docs/adr/0056-grabar-es-un-papel-de-la-toma.md).
   */
  it('sin tonalidad se puede grabar, y se llega desde el aviso', async () => {
    useSessionStore.getState().actions.reset();
    render(<TocarParaEscribir deps={DEPS_CON_CLAQUETA} />);

    // Sin tonalidad lo que sale es el aviso, con la salida a mano.
    expect(screen.getByText(/Elige una tonalidad y toca/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Solo grabar' }));

    await userEvent.click(screen.getByRole('button', { name: /^Tocar$/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Parar y escribirlo/ })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /Parar y escribirlo/ }));

    expect(await screen.findByLabelText('La toma que acabas de grabar')).toBeInTheDocument();
    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
  });

  /**
   * Y se puede tirar. Lo traía el grabador suelto y aquí no estaba: la toma solo
   * desaparecía cuando la reemplazaba la siguiente.
   */
  it('se puede tirar la toma', async () => {
    await unaToma();
    expect(await screen.findByLabelText('La toma que acabas de grabar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Descartar la toma' }));

    expect(screen.queryByLabelText('La toma que acabas de grabar')).not.toBeInTheDocument();
  });
});

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

  /**
   * El papel elegido iba en latón macizo, el mismo que «Tocar» justo debajo, y
   * no se sabía cuál de los dos empezaba. Es un segmentado: la elegida dice que
   * está puesta, y el latón macizo queda solo para la acción.
   */
  it('el papel elegido no se viste como la accion de tocar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<TocarParaEscribir deps={DEPS} />);

    const papeles = within(screen.getByRole('group', { name: 'Qué vas a tocar' }));
    await userEvent.click(papeles.getByRole('button', { name: 'Punteo' }));

    const elegido = papeles.getByRole('button', { name: 'Punteo' });
    expect(elegido).toHaveAttribute('aria-pressed', 'true');
    expect(papeles.getByRole('button', { name: 'Rítmica' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(elegido.className).not.toContain('bg-brass ');
    expect(screen.getByRole('button', { name: /^Tocar$/ }).className).toContain('bg-brass');
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
