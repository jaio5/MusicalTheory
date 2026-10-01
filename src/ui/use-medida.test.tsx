// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMedida, type Medida } from './use-medida';

/** Un observador de mentira que se deja disparar a mano. */
let avisar: ((entradas: unknown[]) => void) | null = null;

class ObservadorDeMentira {
  constructor(callback: (entradas: unknown[]) => void) {
    avisar = callback;
  }
  observe(): void {}
  disconnect(): void {}
}

function entrada(width: number, height: number) {
  return { contentRect: { width, height } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  avisar = null;
});

describe('Lo que mide una caja', () => {
  it('se queda con la medida que llega', () => {
    vi.stubGlobal('ResizeObserver', ObservadorDeMentira);
    const vistas: Medida[] = [];
    function Caja() {
      const { ref, medida } = useMedida<HTMLDivElement>();
      vistas.push(medida);
      return <div ref={ref} />;
    }
    render(<Caja />);

    act(() => avisar?.([entrada(300, 120)]));

    expect(vistas.at(-1)).toEqual({ ancho: 300, alto: 120 });
  });

  /**
   * Arrastrando un divisor el observador avisa en cada fotograma, muchas veces
   * con los mismos números: repetir la medida devuelve la de antes.
   */
  it('la misma medida otra vez no es una medida nueva', () => {
    vi.stubGlobal('ResizeObserver', ObservadorDeMentira);
    const vistas: Medida[] = [];
    function Caja() {
      const { ref, medida } = useMedida<HTMLDivElement>();
      vistas.push(medida);
      return <div ref={ref} />;
    }
    render(<Caja />);
    act(() => avisar?.([entrada(300, 120)]));
    const antes = vistas.at(-1);

    act(() => avisar?.([entrada(300, 120)]));

    // El mismo objeto: quien dependa de él en un `useMemo` o un `memo` no se
    // entera, y React descarta el pintado sin tocar a los hijos.
    expect(vistas.at(-1)).toBe(antes);
  });

  it('sin entrada se queda en cero', () => {
    vi.stubGlobal('ResizeObserver', ObservadorDeMentira);
    const vistas: Medida[] = [];
    function Caja() {
      const { ref, medida } = useMedida<HTMLDivElement>();
      vistas.push(medida);
      return <div ref={ref} />;
    }
    render(<Caja />);

    act(() => avisar?.([entrada(10, 10)]));
    act(() => avisar?.([]));

    expect(vistas.at(-1)).toEqual({ ancho: 0, alto: 0 });
  });
});
