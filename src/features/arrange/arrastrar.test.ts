// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { arrastrar, colocar, useArrastre } from './arrastrar';

function mover(x: number, y: number): void {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
}

describe('El bucle de un arrastre', () => {
  it('avisa de cada movimiento y de soltar, y después deja de escuchar', () => {
    const alMover = vi.fn();
    const alSoltar = vi.fn();
    arrastrar({ mover: alMover, soltar: alSoltar });

    mover(10, 20);
    window.dispatchEvent(new PointerEvent('pointerup'));
    mover(30, 40);

    expect(alMover).toHaveBeenCalledTimes(1);
    expect(alMover).toHaveBeenCalledWith(10, 20);
    expect(alSoltar).toHaveBeenCalledTimes(1);
  });

  /**
   * Lo que devuelve quita los oyentes **sin soltar**: es lo que llama quien se
   * desmonta a mitad del gesto, y soltar escribiría en la canción un gesto que
   * no terminó.
   */
  it('cancelar deja de escuchar sin soltar', () => {
    const alMover = vi.fn();
    const alSoltar = vi.fn();
    const cancelar = arrastrar({ mover: alMover, soltar: alSoltar });

    cancelar();
    mover(10, 20);
    window.dispatchEvent(new PointerEvent('pointerup'));

    expect(alMover).not.toHaveBeenCalled();
    expect(alSoltar).not.toHaveBeenCalled();
  });

  it('colocar mueve el nodo por transform, y sin nodo no hace nada', () => {
    const nodo = document.createElement('div');

    colocar(nodo, 5, 6);
    colocar(null, 7, 8);

    expect(nodo.style.transform).toBe('translate3d(5px, 6px, 0)');
  });
});

describe('useArrastre', () => {
  it('quien se desmonta a mitad del gesto deja de escucharlo, y no suelta', () => {
    // Soltar escribe en la canción: lo desmontado no ha terminado su gesto, lo
    // ha perdido, y el siguiente movimiento del ratón no puede mover nada.
    const alMover = vi.fn();
    const alSoltar = vi.fn();
    const { result, unmount } = renderHook(() => useArrastre());

    result.current({ mover: alMover, soltar: alSoltar });
    mover(1, 2);
    unmount();
    mover(3, 4);
    window.dispatchEvent(new PointerEvent('pointerup'));

    expect(alMover).toHaveBeenCalledTimes(1);
    expect(alSoltar).not.toHaveBeenCalled();
  });

  it('desmontarse sin haber arrastrado no hace nada', () => {
    const { unmount } = renderHook(() => useArrastre());

    expect(() => unmount()).not.toThrow();
  });

  it('devuelve siempre la misma función, para no romper el memo de quien la usa', () => {
    const { result, rerender } = renderHook(() => useArrastre());
    const primera = result.current;

    rerender();

    expect(result.current).toBe(primera);
  });
});
