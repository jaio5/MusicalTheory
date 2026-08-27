// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasSessionRecorder } from './canvas-session-recorder';
import type { OverlayFrame, RecordingOptions } from './session-recorder';

/**
 * Componer la cámara y el overlay en un canvas, y grabar el resultado.
 *
 * `MediaRecorder` no sabe dibujar encima del vídeo, así que hay que componer a
 * mano: vídeo oculto → canvas → `captureStream` → `MediaRecorder`. Nada de eso
 * existe en jsdom, así que aquí está fingido y lo que se comprueba es la cadena:
 * que se negocia el formato antes de nada, que el audio se enchufa al flujo
 * compuesto, que se trocea, y que **la duración se mide con el reloj y no
 * contando fotogramas**.
 *
 * Ese último es el que importa: contando fotogramas, un hilo atascado —y aquí
 * hay dos motores de análisis corriendo— daría una duración más corta que la
 * real, y la pausa no descontaría nada.
 */

interface ContextoPintado {
  ordenes: string[];
  textos: string[];
}

let pintado: ContextoPintado;
let grabadora: GrabadoraFalsa;
let pistasAnadidas: string[];

class GrabadoraFalsa {
  static soportados = new Set<string>(['video/webm;codecs=vp9,opus']);
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  /** Cada cuánto trocea. Sin trocear, una sesión larga se retiene entera. */
  troceoMs: number | null = null;

  constructor(
    readonly stream: MediaStream,
    readonly options: { mimeType: string },
  ) {
    // Así se alcanza desde el test la que acaba de construir el código.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    grabadora = this;
  }

  start(troceoMs?: number) {
    this.troceoMs = troceoMs ?? null;
    this.state = 'recording';
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
  /** Un trozo de vídeo, como los que va soltando la de verdad. */
  soltar(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
  }
}

/** Un contexto 2D que apunta lo que se le manda pintar. */
function contextoFalso(): CanvasRenderingContext2D {
  const registro: ContextoPintado = { ordenes: [], textos: [] };
  pintado = registro;
  return {
    drawImage: () => registro.ordenes.push('video'),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    fillRect: () => registro.ordenes.push('velo'),
    fillText: (texto: string) => {
      registro.ordenes.push('texto');
      registro.textos.push(texto);
    },
    set font(_: string) {},
    set fillStyle(_: unknown) {},
    set textAlign(_: string) {},
    set textBaseline(_: string) {},
  } as unknown as CanvasRenderingContext2D;
}

/** Un flujo de cámara de 640×480. */
function video(): MediaStream {
  return {
    getVideoTracks: () => [{ getSettings: () => ({ width: 640, height: 480 }) }],
  } as unknown as MediaStream;
}

const FOTOGRAMA: OverlayFrame = {
  noteName: 'A2',
  cents: -7,
  keyName: 'La menor',
  chordSymbol: 'Am',
  elapsedMs: 0,
};

function opciones(extra: Partial<RecordingOptions> = {}): RecordingOptions {
  return { video: video(), overlay: () => FOTOGRAMA, ...extra };
}

let contexto2d: CanvasRenderingContext2D | null;

beforeEach(() => {
  vi.useFakeTimers();
  pistasAnadidas = [];
  contexto2d = contextoFalso();
  GrabadoraFalsa.soportados = new Set(['video/webm;codecs=vp9,opus']);

  vi.stubGlobal(
    'MediaRecorder',
    Object.assign(GrabadoraFalsa, {
      isTypeSupported: (t: string) => GrabadoraFalsa.soportados.has(t),
    }),
  );

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexto2d);
  (HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = () => ({
    addTrack: (pista: { id: string }) => pistasAnadidas.push(pista.id),
  });
  // jsdom no sabe reproducir vídeo, y `playQuietly` existe justo para eso.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('jsdom'));
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('empezar a grabar', () => {
  it('un navegador sin MediaRecorder lo dice en vez de fallar al pulsar', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const rec = new CanvasSessionRecorder();

    await rec.start(opciones());

    expect(rec.state).toBe('unsupported');
    expect(rec.errorMessage).toMatch(/Chrome o Firefox/);
  });

  it('un navegador sin ningun formato de los nuestros, tambien', async () => {
    GrabadoraFalsa.soportados = new Set();
    const rec = new CanvasSessionRecorder();

    await rec.start(opciones());

    expect(rec.state).toBe('unsupported');
    expect(rec.errorMessage).toMatch(/formatos de vídeo/);
  });

  it('graba con el primer formato que acepte el navegador', async () => {
    const rec = new CanvasSessionRecorder();

    await rec.start(opciones());

    expect(rec.state).toBe('recording');
    expect(grabadora.options.mimeType).toBe('video/webm;codecs=vp9,opus');
  });

  it('trocea, para no retener una sesion larga entera en un solo Blob', async () => {
    await new CanvasSessionRecorder().start(opciones());

    expect(grabadora.troceoMs).toBe(1000);
  });

  it('el audio se enchufa al flujo compuesto', async () => {
    // El canvas solo lleva imagen: sin esto, el vídeo sale mudo.
    const audio = {
      getAudioTracks: () => [{ id: 'pista-de-audio' }],
    } as unknown as MediaStream;

    await new CanvasSessionRecorder().start(opciones({ audio }));

    expect(pistasAnadidas).toEqual(['pista-de-audio']);
  });

  it('sin audio no se enchufa nada, y sigue grabando', async () => {
    await new CanvasSessionRecorder().start(opciones());

    expect(pistasAnadidas).toEqual([]);
    expect(grabadora.state).toBe('recording');
  });

  it('si el canvas no da contexto, se dice y no se queda a medias', async () => {
    contexto2d = null;
    const rec = new CanvasSessionRecorder();

    await rec.start(opciones());

    expect(rec.state).toBe('error');
    expect(rec.errorMessage).toMatch(/composición/);
  });

  it('avisa de cada cambio de estado, y se puede dejar de escuchar', async () => {
    const estados: string[] = [];
    const rec = new CanvasSessionRecorder();
    const dejar = rec.subscribe((e) => estados.push(e));

    await rec.start(opciones());
    dejar();
    rec.pause();

    expect(estados).toEqual(['recording']);
  });
});

describe('componer el fotograma', () => {
  it('pinta el video, luego el velo y luego el texto, en ese orden', async () => {
    // El velo va entre medias porque sin él el texto se pierde sobre una camisa
    // clara; encima del texto lo taparía.
    await new CanvasSessionRecorder().start(opciones({ frameRate: 10 }));

    await vi.advanceTimersByTimeAsync(100);

    expect(pintado.ordenes.slice(0, 3)).toEqual(['video', 'velo', 'texto']);
  });

  it('lo que se pinta sale de quien llama, fotograma a fotograma', async () => {
    await new CanvasSessionRecorder().start(opciones({ frameRate: 10 }));

    await vi.advanceTimersByTimeAsync(100);

    expect(pintado.textos.join(' ')).toContain('Am');
  });
});

describe('la duracion', () => {
  it('se mide con el reloj, no contando fotogramas', async () => {
    // Con el hilo atascado, el temporizador se retrasa y el conteo mentiría.
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones({ frameRate: 30 }));

    await vi.advanceTimersByTimeAsync(2000);
    grabadora.soltar(64);
    const grabacion = await rec.stop();

    expect(grabacion.durationMs).toBeGreaterThan(1800);
    expect(grabacion.durationMs).toBeLessThan(2200);
  });

  it('lo que se pasa en pausa no cuenta', async () => {
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones({ frameRate: 30 }));

    await vi.advanceTimersByTimeAsync(1000);
    rec.pause();
    await vi.advanceTimersByTimeAsync(5000);
    rec.resume();
    await vi.advanceTimersByTimeAsync(1000);
    const grabacion = await rec.stop();

    expect(grabacion.durationMs).toBeLessThan(2500);
  });
});

describe('pausar y seguir', () => {
  it('pausar y reanudar cambian el estado', async () => {
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones());

    rec.pause();
    expect(rec.state).toBe('paused');

    rec.resume();
    expect(rec.state).toBe('recording');
  });

  it('pausar sin estar grabando no hace nada', () => {
    const rec = new CanvasSessionRecorder();

    rec.pause();
    rec.resume();

    expect(rec.state).toBe('idle');
  });

  it('reanudar lo que no estaba pausado tampoco', async () => {
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones());

    rec.resume();

    expect(rec.state).toBe('recording');
  });
});

describe('parar', () => {
  it('sin nada en marcha, lo dice', async () => {
    await expect(new CanvasSessionRecorder().stop()).rejects.toThrow(/ninguna grabación/);
  });

  it('devuelve el fichero con su tipo y su nombre', async () => {
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones());
    grabadora.soltar(128);

    const grabacion = await rec.stop();

    expect(grabacion.mimeType).toBe('video/webm;codecs=vp9,opus');
    expect(grabacion.filename).toMatch(/^caos-ordenado-\d{4}-\d{2}-\d{2}-\d{4}\.webm$/);
    expect(grabacion.blob.size).toBeGreaterThan(0);
  });

  it('los trozos vacios no entran en el fichero', async () => {
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones());
    grabadora.ondataavailable!({ data: new Blob([]) });
    grabadora.soltar(64);

    expect((await rec.stop()).blob.size).toBe(64);
  });

  it('deja de pintar y suelta la camara', async () => {
    // Sin esto, el temporizador de fotogramas sigue corriendo con la pestaña
    // abierta y pintando sobre un canvas que ya no graba nadie.
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones({ frameRate: 10 }));
    await vi.advanceTimersByTimeAsync(200);

    await rec.stop();
    const pintados = pintado.ordenes.length;
    await vi.advanceTimersByTimeAsync(1000);

    expect(pintado.ordenes.length).toBe(pintados);
    expect(rec.state).toBe('idle');
  });

  it('parar dos veces avisa en vez de devolver un fichero vacio', async () => {
    const rec = new CanvasSessionRecorder();
    await rec.start(opciones());
    await rec.stop();

    await expect(rec.stop()).rejects.toThrow(/ninguna grabación/);
  });
});
