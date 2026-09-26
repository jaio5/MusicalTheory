import { describe, expect, it, vi } from 'vitest';

import type { Metronome, MetronomeOptions } from '@audio/metronome';
import { msPerBeat, pulsosDeCuenta } from '@core/music';

import { contarAtras } from './cuenta-atras';

/**
 * La cuenta atrás antes de apuntar.
 *
 * Lo que hay que sujetar aquí son dos cosas, y ninguna es que suene: que **se
 * calle al acabar** —el clic sale por los altavoces y el micro lo oye— y que
 * diga **cuándo cae el compás uno**, que es un pulso después del último clic y no
 * el último clic ([adr/0053](../../docs/adr/0053-la-claqueta-cuenta-y-se-calla.md)).
 */

/** Un metrónomo de mentira al que se le dan los pulsos a mano. */
function metronomoFalso(opciones: { readonly arranca?: boolean } = {}): {
  readonly metronomo: Metronome;
  /** Da un pulso, como si hubiera sonado el clic. */
  readonly pulso: () => void;
  readonly paradas: () => number;
} {
  let onBeat: ((beat: number) => void) | undefined;
  let dados = 0;
  let paradas = 0;
  let corriendo = false;

  const metronomo: Metronome = {
    get running() {
      return corriendo;
    },
    start: async (options: MetronomeOptions) => {
      onBeat = options.onBeat;
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
  };
}

describe('la cuenta atrás', () => {
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
