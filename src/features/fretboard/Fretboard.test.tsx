// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';

import { Fretboard, PROPORCION } from './Fretboard';

/**
 * El mástil se estira a lo ancho del hueco que tenga
 * ([adr/0039](../../../docs/adr/0039-el-mastil-se-estira-a-lo-ancho.md)).
 *
 * jsdom no trae `ResizeObserver`, así que se pone uno de mentira que guarda la
 * llamada y la deja disparar a mano, igual que en el pentagrama.
 */
describe('El mástil se estira a su caja', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Monta el mástil con un observador de mentira y devuelve cómo dispararlo. */
  function conObservador() {
    const avisos: Array<(entradas: unknown) => void> = [];
    const desconectar = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: (entradas: unknown) => void) {
          avisos.push(cb);
        }
        observe() {}
        disconnect = desconectar;
      },
    );

    const pintado = render(
      <Fretboard tonic={pitchClassFromName('C')} scaleId="major" soundingMidi={null} />,
    );

    const medir = (ancho: number, alto: number) =>
      act(() => {
        for (const aviso of avisos) aviso([{ contentRect: { width: ancho, height: alto } }]);
      });

    const anchoDelDibujo = () =>
      Number(pintado.container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2]);

    const medirSinEntradas = () =>
      act(() => {
        for (const aviso of avisos) aviso([]);
      });

    return { ...pintado, medir, medirSinEntradas, anchoDelDibujo, desconectar };
  }

  it('llena una caja mas ancha que su proporcion, estirando los trastes', () => {
    const { medir, anchoDelDibujo } = conObservador();
    const natural = anchoDelDibujo();

    // Una ventana baja: mucho ancho y poco alto, que es el caso que lo dejaba
    // dibujado como un cuadrado en medio de la pantalla.
    medir(1290, 166);

    // El dibujo pasa a tener la proporción de la caja, así que la llena entera.
    expect(anchoDelDibujo()).toBeGreaterThan(natural);
    expect(anchoDelDibujo() / 230).toBeCloseTo(1290 / 166, 1);
  });

  /**
   * **Y no se encoge.** Apretando los trastes las notas dejarían de caber
   * dentro, así que por debajo de su proporción natural se queda como está y se
   * centra en su caja, que es lo que hacía siempre.
   */
  it('no se encoge en una caja mas estrecha que su proporcion', () => {
    const { medir, anchoDelDibujo } = conObservador();
    const natural = anchoDelDibujo();

    medir(400, 600);

    expect(anchoDelDibujo()).toBe(natural);
    expect(natural / 230).toBeCloseTo(PROPORCION, 5);
  });

  /**
   * Un aviso sin entradas tampoco cambia nada. Pasa cuando el observador se
   * dispara con la caja aún sin medir, y sin esto se leería `undefined`.
   */
  it('un aviso sin medidas no rompe el dibujo', () => {
    const { medirSinEntradas, anchoDelDibujo } = conObservador();
    const natural = anchoDelDibujo();

    medirSinEntradas();

    expect(anchoDelDibujo()).toBe(natural);
  });

  /** Una caja sin alto todavía —el primer pintado— no cambia nada. */
  it('sin alto medido se queda en su tamano natural', () => {
    const { medir, anchoDelDibujo } = conObservador();
    const natural = anchoDelDibujo();

    medir(0, 0);

    expect(anchoDelDibujo()).toBe(natural);
  });

  it('suelta el observador al irse', () => {
    const { unmount, desconectar } = conObservador();
    unmount();
    expect(desconectar).toHaveBeenCalled();
  });
});
