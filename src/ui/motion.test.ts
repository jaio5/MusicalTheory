// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion } from './motion';

/**
 * Menos movimiento, cuando el sistema lo pide.
 *
 * La hoja de estilos ya anula transiciones y animaciones CSS; lo que decide
 * desde JavaScript si se mueve —la escena de la portada, la mascota— pregunta
 * aquí, y aquí tiene que contestarse bien.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

function pidiendoMenos(menos: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta: string) => ({
      matches: menos && consulta.includes('prefers-reduced-motion'),
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

describe('el ajuste de movimiento', () => {
  it('dice que si cuando el sistema lo pide', () => {
    pidiendoMenos(true);

    expect(prefersReducedMotion()).toBe(true);
  });

  it('y que no cuando no lo pide', () => {
    pidiendoMenos(false);

    expect(prefersReducedMotion()).toBe(false);
  });

  /**
   * Y donde no hay `matchMedia` —el servidor, algún entorno de prueba— se
   * contesta que no: dar por hecho que existe rompía el render.
   */
  it('sin matchMedia, se anima como siempre', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});
