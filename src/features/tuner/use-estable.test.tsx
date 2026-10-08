// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMANENCIA_MS, useEstable } from './use-estable';

/**
 * El estado que no parpadea: entra con un umbral, sale con otro y no cambia dos
 * veces en menos de `PERMANENCIA_MS`.
 */
describe('useEstable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function montar(inicial: { entra: boolean; sale: boolean }) {
    return renderHook(
      (props: { entra: boolean; sale: boolean }) => useEstable(props.entra, props.sale),
      {
        initialProps: inicial,
      },
    );
  }

  it('empieza apagado y el primer cambio es inmediato', () => {
    const { result } = montar({ entra: false, sale: false });
    expect(result.current).toBe(false);

    const { result: otro } = montar({ entra: true, sale: false });
    act(() => vi.advanceTimersByTime(0));
    expect(otro.current).toBe(true);
  });

  it('una vez cambiado, aguanta el tiempo mínimo antes de volver', () => {
    const { result, rerender } = montar({ entra: true, sale: false });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe(true);

    rerender({ entra: false, sale: true });
    act(() => vi.advanceTimersByTime(PERMANENCIA_MS - 10));
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(20));
    expect(result.current).toBe(false);
  });

  // Entre los dos umbrales no entra ni sale nada: es la franja que se come el ruido.
  it('si la razón se va antes de que acabe la espera, no cambia', () => {
    const { result, rerender } = montar({ entra: true, sale: false });
    act(() => vi.advanceTimersByTime(0));

    rerender({ entra: false, sale: true });
    act(() => vi.advanceTimersByTime(PERMANENCIA_MS / 2));
    rerender({ entra: false, sale: false });
    act(() => vi.advanceTimersByTime(PERMANENCIA_MS * 2));

    expect(result.current).toBe(true);
  });

  /**
   * Con espera para entrar, lo que dura un instante no entra: el ataque de una
   * nota limpia ensucia la claridad un momento, y el aviso de señal sucia salía.
   */
  it('con espera para entrar, un instante no basta y lo que dura sí', () => {
    const { result, rerender } = renderHook(
      (props: { entra: boolean }) => useEstable(props.entra, !props.entra, PERMANENCIA_MS, 600),
      { initialProps: { entra: true } },
    );
    act(() => vi.advanceTimersByTime(300));
    rerender({ entra: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);

    rerender({ entra: true });
    act(() => vi.advanceTimersByTime(599));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
