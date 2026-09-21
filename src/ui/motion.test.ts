// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { motionSeconds, prefersReducedMotion } from './motion';

/**
 * Menos movimiento, cuando el sistema lo pide.
 *
 * La hoja de estilos ya anula transiciones y animaciones CSS, pero GSAP escribe
 * el `transform` directamente y se salta esa regla: quien anime con GSAP tiene
 * que preguntar aquí, y aquí tiene que contestarse bien.
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
  it('con menos movimiento pedido, las animaciones duran cero', () => {
    pidiendoMenos(true);

    expect(prefersReducedMotion()).toBe(true);
    expect(motionSeconds(400)).toBe(0);
  });

  it('sin pedirlo, la duracion es la que se pide, en segundos', () => {
    pidiendoMenos(false);

    expect(prefersReducedMotion()).toBe(false);
    expect(motionSeconds(400)).toBe(0.4);
  });

  /**
   * Y donde no hay `matchMedia` —el servidor, algún entorno de prueba— se
   * contesta que no: dar por hecho que existe rompía el render.
   */
  it('sin matchMedia, se anima como siempre', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
    expect(motionSeconds(1000)).toBe(1);
  });
});
