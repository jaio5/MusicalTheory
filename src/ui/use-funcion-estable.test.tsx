// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFuncionEstable } from './use-funcion-estable';

/**
 * Lo que necesitan las filas con `memo`: la misma función de un pintado a otro,
 * que llame siempre a la última versión de lo que se le dio.
 */
describe('useFuncionEstable', () => {
  it('no cambia de identidad y llama a la última versión', () => {
    const { result, rerender } = renderHook(
      ({ suma }: { suma: number }) => useFuncionEstable((n: number) => n + suma),
      { initialProps: { suma: 1 } },
    );
    const primera = result.current;
    expect(primera(1)).toBe(2);

    rerender({ suma: 10 });

    expect(result.current).toBe(primera);
    expect(primera(1)).toBe(11);
  });
});
