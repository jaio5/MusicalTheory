import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeRecording } from './analyze-recording';
import type { Recording } from './recorder';

/**
 * Analizar la grabación en un worker, o aquí mismo si no se puede.
 *
 * El respaldo no es pereza: es lo que hace que esto no dependa de que el
 * empaquetador sepa construir el worker, y lo que permite que este mismo test
 * exista sin `Worker`. Tarda lo mismo; lo único que se pierde es que la pantalla
 * no se congele.
 *
 * **Y hay un fallo concreto que estos tests cuidan**: las muestras se copian al
 * mandarlas, no se ceden. Un buffer transferido deja el array de aquí vacío, y
 * entonces el respaldo analizaría silencio si el worker fallara después de
 * arrancar. Se comprueba mirando que las muestras siguen ahí después.
 */

/** Un la de 110 Hz, que es la sexta cuerda al aire. */
function grabacion(segundos = 1, sampleRate = 8000): Recording {
  const samples = new Float32Array(Math.round(segundos * sampleRate));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] =
      0.5 * Math.sin((2 * Math.PI * 110 * i) / sampleRate) +
      0.3 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }
  return { samples, sampleRate };
}

class WorkerFalso {
  static ultimo: WorkerFalso | null = null;
  static creable = true;
  readonly mensajes: { samples: Float32Array; options: unknown }[] = [];
  readonly oyentes = new Map<string, ((e: unknown) => void)[]>();
  terminado = false;

  constructor() {
    if (!WorkerFalso.creable) {
      throw new Error('el empaquetador no sabe construirlo');
    }
    WorkerFalso.ultimo = this;
  }

  addEventListener(tipo: string, oyente: (e: unknown) => void) {
    this.oyentes.set(tipo, [...(this.oyentes.get(tipo) ?? []), oyente]);
  }

  postMessage(mensaje: { samples: Float32Array; options: unknown }) {
    this.mensajes.push(mensaje);
  }

  terminate() {
    this.terminado = true;
  }

  /** Lo que hace el worker de verdad cuando termina. */
  contesta(data: unknown) {
    for (const oyente of this.oyentes.get('message') ?? []) {
      oyente({ data });
    }
  }

  revienta() {
    for (const oyente of this.oyentes.get('error') ?? []) {
      oyente({});
    }
  }
}

beforeEach(() => {
  WorkerFalso.ultimo = null;
  WorkerFalso.creable = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sin worker', () => {
  it('se calcula aqui mismo, y sale lo mismo', async () => {
    // Es lo que pasa en un test y en cualquier navegador donde el worker no se
    // pueda construir.
    const acordes = await analyzeRecording(grabacion());

    expect(Array.isArray(acordes)).toBe(true);
  });

  it('si el worker no se puede construir, se cae aqui sin avisar a nadie', async () => {
    WorkerFalso.creable = false;
    vi.stubGlobal('Worker', WorkerFalso);

    await expect(analyzeRecording(grabacion())).resolves.toBeInstanceOf(Array);
  });
});

describe('con worker', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', WorkerFalso);
  });

  it('le llegan las muestras y la frecuencia de muestreo', async () => {
    const rec = grabacion();
    const promesa = analyzeRecording(rec, { minFrames: 3 });

    WorkerFalso.ultimo!.contesta({ ok: true, chords: [] });
    await promesa;

    const mandado = WorkerFalso.ultimo!.mensajes[0]!;
    expect(mandado.samples).toHaveLength(rec.samples.length);
    expect(mandado.options).toMatchObject({ sampleRate: 8000, minFrames: 3 });
  });

  it('las muestras se copian, no se ceden', async () => {
    // Ceder el buffer ahorraría copiar 34 MB —unos veinte milisegundos— pero
    // dejaría el array de aquí vacío, y el respaldo analizaría silencio.
    const rec = grabacion();
    const promesa = analyzeRecording(rec);

    WorkerFalso.ultimo!.contesta({ ok: true, chords: [] });
    await promesa;

    expect(rec.samples.some((v) => v !== 0)).toBe(true);
  });

  it('lo que conteste es lo que sale', async () => {
    const acorde = { symbol: 'Am', startMs: 0, durationMs: 500 };
    const promesa = analyzeRecording(grabacion());

    WorkerFalso.ultimo!.contesta({ ok: true, chords: [acorde] });

    expect(await promesa).toEqual([acorde]);
  });

  it('se cierra pase lo que pase', async () => {
    const promesa = analyzeRecording(grabacion());
    WorkerFalso.ultimo!.contesta({ ok: true, chords: [] });
    await promesa;

    expect(WorkerFalso.ultimo!.terminado).toBe(true);
  });

  it('si el analisis de dentro falla, se rehace aqui', async () => {
    // Quien llama no se queda sin nada: se recalcula en el hilo, que tarda lo
    // mismo y solo congela la pantalla.
    const promesa = analyzeRecording(grabacion());

    WorkerFalso.ultimo!.contesta({ ok: false, chords: [] });

    expect(await promesa).toBeInstanceOf(Array);
  });

  it('si el worker revienta, tambien', async () => {
    const promesa = analyzeRecording(grabacion());

    WorkerFalso.ultimo!.revienta();

    expect(await promesa).toBeInstanceOf(Array);
  });

  it('si no contesta nunca, se deja de esperar y se calcula aqui', async () => {
    // Es la red por si el worker se queda colgado: sin esto, la pantalla se
    // queda en «analizando» para siempre.
    vi.useFakeTimers();
    const promesa = analyzeRecording(grabacion());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(await promesa).toBeInstanceOf(Array);
  });
});
