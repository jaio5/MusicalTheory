import { describe, expect, it, vi } from 'vitest';

import type { Metronome, MetronomeOptions } from '@audio/metronome';
import { msPerBeat, pulsosDeCuenta } from '@core/music';

import { contarAtras } from './cuenta-atras';

/**
 * La cuenta atrás antes de apuntar.
 *
 * Lo que hay que sujetar aquí son dos cosas, y ninguna es que suene: que diga
 * **cuándo cae el compás uno**, que es un pulso después del último clic y no el
 * último clic ([adr/0053](../../docs/adr/0053-la-claqueta-cuenta-y-se-calla.md)),
 * y que **después siga dando cada clic con su instante**, porque la claqueta ya
 * no se calla al acabar la cuenta: suena toda la toma.
 */

/** Un metrónomo de mentira al que se le dan los pulsos a mano. */
function metronomoFalso(opciones: { readonly arranca?: boolean } = {}): {
  readonly metronomo: Metronome;
  /** Da un pulso, como si hubiera sonado el clic. */
  readonly pulso: () => void;
  readonly paradas: () => number;
  /** Un pulso con el instante en que sonó, como lo da el metrónomo de verdad. */
  readonly pulsoEn: (instante: number) => void;
  readonly volumen: () => number | undefined;
} {
  let onBeat: ((beat: number, instante?: number) => void) | undefined;
  let volumen: number | undefined;
  let dados = 0;
  let paradas = 0;
  let corriendo = false;

  const metronomo: Metronome = {
    get running() {
      return corriendo;
    },
    start: async (options: MetronomeOptions) => {
      onBeat = options.onBeat;
      volumen = options.volume;
      corriendo = opciones.arranca ?? true;
    },
    setBpm: () => {},
    stop: () => {
      paradas += 1;
      corriendo = false;
    },
    dispose: async () => {
      paradas += 1;
      corriendo = false;
    },
  };

  return {
    metronomo,
    pulso: () => {
      onBeat?.(dados % 4);
      dados += 1;
    },
    paradas: () => paradas,
    pulsoEn: (instante) => {
      onBeat?.(dados % 4, instante);
      dados += 1;
    },
    volumen: () => volumen,
  };
}

describe('la cuenta atrás', () => {
  /**
   * **El instante es el del sonido, no el del aviso.** El aviso va por
   * temporizador y llega cuando llega; el metrónomo dice cuándo sonó de verdad, y
   * el compás uno se cuenta desde ahí.
   */
  it('el compas uno cae un pulso despues del instante en que sono el ultimo', async () => {
    const { metronomo, pulsoEn } = metronomoFalso();
    const cuenta = contarAtras({ metronomo, bpm: 120, beatsPerBar: 4, alQuedar: () => {} });

    for (let i = 0; i < 8; i += 1) {
      pulsoEn(1000 + i * 500);
    }

    await expect(cuenta.terminada).resolves.toBe(1000 + 7 * 500 + 500);
  });

  /** **Y sigue sonando**: cada clic de después se apunta con su instante. */
  it('despues de la cuenta, cada clic llega con su instante', async () => {
    const { metronomo, pulsoEn, paradas, volumen } = metronomoFalso();
    const clics: number[] = [];
    const quedan: number[] = [];
    const cuenta = contarAtras({
      metronomo,
      bpm: 120,
      beatsPerBar: 4,
      volumen: 0.4,
      alQuedar: (n) => quedan.push(n),
      alClic: (instante) => clics.push(instante),
    });

    for (let i = 0; i < 11; i += 1) {
      pulsoEn(i * 500);
    }
    await cuenta.terminada;

    expect(volumen()).toBe(0.4);
    expect(clics).toEqual([4000, 4500, 5000]);
    // La cuenta no se toca después: sigue en cero.
    expect(quedan.at(-1)).toBe(0);
    // Y no se para sola: callarla es de quien la creó.
    expect(paradas()).toBe(0);
  });

  it('sin oyente de clics, los de despues se ignoran sin romper nada', async () => {
    const { metronomo, pulso } = metronomoFalso();
    const cuenta = contarAtras({ metronomo, bpm: 120, beatsPerBar: 4, alQuedar: () => {} });
    for (let i = 0; i < 10; i += 1) {
      pulso();
    }
    await expect(cuenta.terminada).resolves.not.toBeNull();
  });

  it('cortada, los golpes que lleguen despues no cuentan', async () => {
    const { metronomo, pulso } = metronomoFalso();
    const quedan: number[] = [];
    const cuenta = contarAtras({
      metronomo,
      bpm: 120,
      beatsPerBar: 4,
      alQuedar: (n) => quedan.push(n),
    });
    pulso();
    cuenta.cortar();
    pulso();

    await expect(cuenta.terminada).resolves.toBeNull();
    expect(quedan).toEqual([8, 7]);
  });

  it('cuenta dos compases y no acaba antes', async () => {
    const { metronomo, pulso } = metronomoFalso();
    const quedan: number[] = [];
    const cuenta = contarAtras({
      metronomo,
      bpm: 120,
      beatsPerBar: 4,
      alQuedar: (n) => quedan.push(n),
    });

    // Ocho golpes: dos compases de cuatro.
    expect(pulsosDeCuenta(4)).toBe(8);

    let terminada = false;
    void cuenta.terminada.then(() => {
      terminada = true;
    });

    for (let i = 0; i < 7; i += 1) {
      pulso();
    }
    await Promise.resolve();
    expect(terminada, 'ha acabado con siete golpes').toBe(false);

    pulso();
    await cuenta.terminada;
    // Avisa de todos: los ocho que quedan al empezar y uno menos en cada golpe.
    expect(quedan).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  /**
   * **La que de verdad importa.** El compás uno cae un pulso después del último
   * clic, y el tramo se mide desde ese instante: poner el origen en el último
   * clic desplazaría la canción entera un pulso.
   */
  it('el compas uno cae un pulso despues del ultimo clic', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { metronomo, pulso } = metronomoFalso();
    const cuenta = contarAtras({ metronomo, bpm: 120, beatsPerBar: 4, alQuedar: () => {} });

    for (let i = 0; i < 8; i += 1) {
      pulso();
    }

    // A 120, un pulso son 500 ms.
    expect(msPerBeat(120)).toBe(500);
    await expect(cuenta.terminada).resolves.toBe(1500);
    vi.restoreAllMocks();
  });

  // Los pulsos por compás no son siempre cuatro: en 3/4 son seis golpes.
  it('en un compas de tres, seis golpes', async () => {
    const { metronomo, pulso } = metronomoFalso();
    const cuenta = contarAtras({ metronomo, bpm: 100, beatsPerBar: 3, alQuedar: () => {} });

    for (let i = 0; i < 6; i += 1) {
      pulso();
    }

    await expect(cuenta.terminada).resolves.toBeGreaterThan(0);
  });

  it('cortarla la deja en nulo', async () => {
    const { metronomo, pulso } = metronomoFalso();
    const cuenta = contarAtras({ metronomo, bpm: 120, beatsPerBar: 4, alQuedar: () => {} });

    pulso();
    cuenta.cortar();

    await expect(cuenta.terminada).resolves.toBeNull();
  });

  /**
   * **Y si la claqueta no puede sonar, no se espera a nada.**
   *
   * Sin esto, un metrónomo que no arranca deja la promesa sin resolver para
   * siempre: grabar se queda colgado en la cuenta, y eso no se parece a un fallo,
   * se parece a que la aplicación se ha quedado pensando.
   */
  it('si el metronomo no arranca, empieza ya', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(4000);
    const { metronomo } = metronomoFalso({ arranca: false });
    const cuenta = contarAtras({ metronomo, bpm: 120, beatsPerBar: 4, alQuedar: () => {} });

    await expect(cuenta.terminada).resolves.toBe(4000);
    vi.restoreAllMocks();
  });
});
