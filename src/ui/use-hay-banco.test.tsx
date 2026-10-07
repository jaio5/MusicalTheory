// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useHayBanco } from './use-hay-banco';

/**
 * Si hay sitio para el banco de trabajo, o toca una columna con pestañas.
 *
 * Por debajo de 64rem la pantalla no es el mismo árbol con otro reparto, es otra
 * cosa: por eso esto no se resuelve solo con clases. **En el servidor se
 * contesta que sí**: el árbol del banco es el que lleva lo de escritorio, y lo
 * que un teléfono no enseña ya lo esconden las clases hasta hidratar (lo prueba
 * `ComposeScreen.test.tsx`, con el HTML del servidor).
 */
function Mirilla() {
  return <span>{useHayBanco() ? 'banco' : 'pestañas'}</span>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('si hay sitio para el banco', () => {
  it('en el servidor se contesta que si', () => {
    expect(renderToString(<Mirilla />)).toContain('banco');
  });

  it('en pantalla ancha, si', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })),
    );

    expect(renderHook(() => useHayBanco()).result.current).toBe(true);
  });

  it('y en estrecha, no', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );

    expect(renderHook(() => useHayBanco()).result.current).toBe(false);
  });

  // Y donde no hay `matchMedia` se contesta que sí, como en el servidor.
  it('sin matchMedia, tambien que si', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(renderHook(() => useHayBanco()).result.current).toBe(true);
  });
});
