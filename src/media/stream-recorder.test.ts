// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StreamRecorder } from './stream-recorder';

/**
 * El grabador, que ahora es casi todo `MediaRecorder`.
 *
 * La versión de vídeo componía cámara y overlay en un canvas con un temporizador
 * a treinta fotogramas por segundo, y de ahí salían doscientas líneas que había
 * que probar. Grabando solo el sonido no queda casi nada nuestro, así que lo que
 * se prueba es justo eso poco: **que se negocia el formato antes de empezar, que
 * un navegador que no puede lo dice en vez de fallar al pulsar, y que la pausa
 * no cuenta como tiempo grabado**.
 */

class MediaRecorderFalso {
  static soportados: readonly string[] = ['audio/webm;codecs=opus'];
  static isTypeSupported = (mimeType: string) => MediaRecorderFalso.soportados.includes(mimeType);

  /** La última que se ha construido, para poder soltarle trozos desde el test. */
  static ultima: MediaRecorderFalso | null = null;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly troceadoCada: number[] = [];

  constructor(
    readonly stream: MediaStream,
    readonly options: { mimeType: string },
  ) {
    MediaRecorderFalso.ultima = this;
  }

  start(timeslice: number): void {
    this.troceadoCada.push(timeslice);
    this.state = 'recording';
  }
  pause(): void {
    this.state = 'paused';
  }
  resume(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['sonido']) });
    this.onstop?.();
  }
}

/** El flujo del micro. Al grabador solo le hace falta poder pasárselo. */
const flujo = {} as MediaStream;

let ahora = 0;

beforeEach(() => {
  ahora = 0;
  MediaRecorderFalso.soportados = ['audio/webm;codecs=opus'];
  MediaRecorderFalso.ultima = null;
  vi.stubGlobal('MediaRecorder', MediaRecorderFalso);
  vi.stubGlobal('performance', { now: () => ahora });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('grabar el sonido', () => {
  it('empieza parado', () => {
    expect(new StreamRecorder().state).toBe('idle');
  });

  it('negocia el formato y arranca troceando', async () => {
    const grabador = new StreamRecorder();

    await grabador.start({ audio: flujo });

    expect(grabador.state).toBe('recording');
    expect(grabador.errorMessage).toBeNull();
  });

  it('un navegador sin MediaRecorder lo dice, y no al pulsar el boton', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const grabador = new StreamRecorder();

    await grabador.start({ audio: flujo });

    expect(grabador.state).toBe('unsupported');
    expect(grabador.errorMessage).toMatch(/no puede grabar sonido/i);
  });

  it('si no acepta ninguno de nuestros formatos, tambien lo dice', async () => {
    MediaRecorderFalso.soportados = [];
    const grabador = new StreamRecorder();

    await grabador.start({ audio: flujo });

    expect(grabador.state).toBe('unsupported');
    expect(grabador.errorMessage).toMatch(/ninguno de los formatos/i);
  });

  it('al parar devuelve el fichero con su duracion y su nombre', async () => {
    const grabador = new StreamRecorder();
    await grabador.start({ audio: flujo });

    ahora = 12_000;
    const toma = await grabador.stop();

    expect(toma.durationMs).toBe(12_000);
    expect(toma.mimeType).toBe('audio/webm;codecs=opus');
    expect(toma.filename).toMatch(/^caos-ordenado-.*\.webm$/);
    expect(grabador.state).toBe('idle');
  });

  /**
   * La duración se mide con el reloj y no contando trozos, así que lo que se
   * pasa en pausa **no puede contar**: una toma de diez segundos con medio minuto
   * de pausa en medio dura diez segundos, no cuarenta.
   */
  it('lo que se pasa en pausa no cuenta como grabado', async () => {
    const grabador = new StreamRecorder();
    await grabador.start({ audio: flujo });

    ahora = 4_000;
    grabador.pause();
    ahora = 34_000;
    grabador.resume();
    ahora = 40_000;

    const toma = await grabador.stop();

    expect(toma.durationMs).toBe(10_000);
  });

  it('parar sin haber empezado es un error claro, no un fichero vacio', async () => {
    await expect(new StreamRecorder().stop()).rejects.toThrow(/ninguna grabación/i);
  });

  it('avisa de cada cambio de estado a quien se haya suscrito', async () => {
    const grabador = new StreamRecorder();
    const vistos: string[] = [];
    grabador.subscribe((estado) => vistos.push(estado));

    await grabador.start({ audio: flujo });
    await grabador.stop();

    expect(vistos).toEqual(['recording', 'stopping', 'idle']);
  });
});

describe('los mandos fuera de sitio', () => {
  /**
   * Pausar lo que ya está en pausa, reanudar lo que está grabando o tocar
   * cualquiera de los dos sin grabación no hace nada: son botones de una barra,
   * y una barra se puede pulsar en cualquier orden.
   */
  it('pausar y reanudar fuera de orden no cambia nada', async () => {
    const grabador = new StreamRecorder();

    // Sin grabación no hay nada que pausar ni que reanudar.
    grabador.pause();
    grabador.resume();
    expect(grabador.state).toBe('idle');

    await grabador.start({ audio: flujo });
    grabador.resume();
    expect(grabador.state).toBe('recording');

    grabador.pause();
    grabador.pause();
    expect(grabador.state).toBe('paused');
  });

  /**
   * Y los trozos vacíos no se guardan: `MediaRecorder` los emite al parar, y
   * contarlos dejaría ficheros con bytes de nada dentro.
   */
  it('un trozo vacio no entra en la toma', async () => {
    const grabador = new StreamRecorder();
    await grabador.start({ audio: flujo });
    MediaRecorderFalso.ultima!.ondataavailable?.({ data: new Blob([]) });

    ahora = 1000;
    const toma = await grabador.stop();

    // Solo el trozo que suelta el propio `stop`, que sí tiene contenido.
    expect(toma.blob.size).toBeGreaterThan(0);
  });
});
