// @vitest-environment node
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

/**
 * La rama del servidor. La del navegador la recorren quienes lo usan en sus
 * tests de jsdom; esta la recorría la rueda cuando giraba con GSAP, y al quitarlo
 * (adr/0057) se quedó sin nadie que la pisara.
 */
describe('useIsomorphicLayoutEffect', () => {
  it('en el servidor es `useEffect`, que no avisa por no tener layout que medir', () => {
    expect(useIsomorphicLayoutEffect).toBe(useEffect);
  });
});
