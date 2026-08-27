import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El hilo aparte donde se analiza la grabación.
 *
 * Son nueve líneas y aun así tienen un test, porque la que importa es el `catch`:
 * **que el análisis falle no puede tumbar nada**. Quien llama se queda con lo que
 * el motor oyó en vivo, que es lo que había antes de todo esto. Un worker que
 * lanza y no contesta deja la pantalla esperando hasta el tope de treinta
 * segundos.
 *
 * `self` no existe en Node, así que se pone uno de mentira antes de importar el
 * módulo: el fichero se registra como oyente al cargarse.
 */

const enviados: unknown[] = [];
let recibir: ((evento: { data: unknown }) => void) | null = null;

const chordsOfRecording = vi.fn();

vi.mock('./offline-chords', () => ({
  chordsOfRecording: (...a: unknown[]) => chordsOfRecording(...a),
}));

beforeEach(async () => {
  enviados.length = 0;
  recibir = null;
  chordsOfRecording.mockReset();
  vi.stubGlobal('self', {
    addEventListener: (_tipo: string, oyente: (e: { data: unknown }) => void) => {
      recibir = oyente;
    },
    postMessage: (mensaje: unknown) => enviados.push(mensaje),
  });
  vi.resetModules();
  await import('./analizador.worker');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PETICION = {
  data: { samples: new Float32Array(16), options: { sampleRate: 8000 } },
};

describe('el analizador de fuera del hilo', () => {
  it('se registra como oyente al cargarse', () => {
    expect(recibir).not.toBeNull();
  });

  it('contesta los acordes que encuentre', () => {
    const acordes = [{ symbol: 'Am', startMs: 0, durationMs: 500 }];
    chordsOfRecording.mockReturnValue(acordes);

    recibir!(PETICION);

    expect(enviados).toEqual([{ ok: true, chords: acordes }]);
  });

  it('le pasa las muestras y las opciones tal cual', () => {
    chordsOfRecording.mockReturnValue([]);

    recibir!(PETICION);

    expect(chordsOfRecording).toHaveBeenCalledWith(PETICION.data.samples, PETICION.data.options);
  });

  it('si el analisis revienta, contesta que no y no se queda callado', () => {
    // Callarse dejaría a quien espera colgado hasta el tope de treinta segundos.
    chordsOfRecording.mockImplementation(() => {
      throw new Error('vaya');
    });

    recibir!(PETICION);

    expect(enviados).toEqual([{ ok: false, chords: [] }]);
  });
});
