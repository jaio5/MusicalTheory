import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { colors, fonts, radii } from './tokens';

/**
 * Los tokens viven dos veces: aquí en TypeScript, que es lo que lee el código,
 * y como variables CSS en globals.css, que es lo que lee Tailwind. Tailwind v4
 * quiere sus variables en CSS y no hay forma de que las saque de un módulo de
 * TypeScript, así que la duplicación se queda.
 *
 * Lo que no se queda es el riesgo: este test lee el CSS y comprueba que dice lo
 * mismo. Si alguien cambia un color en un sitio y no en el otro, falla aquí en
 * vez de aparecer como un color raro en pantalla dentro de tres semanas.
 */
const CSS = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');

/** Los tokens de TypeScript van en camelCase y los de CSS en kebab-case. */
function cssVariableName(token: string): string {
  return token.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function cssValue(name: string): string | null {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS);
  return match?.[1]?.trim() ?? null;
}

describe('los tokens de diseño no se separan del CSS', () => {
  it('define cada color con el mismo valor en los dos sitios', () => {
    for (const [token, value] of Object.entries(colors)) {
      const name = `color-${cssVariableName(token)}`;
      expect(cssValue(name), `falta o no coincide --${name}`).toBe(value.toLowerCase());
    }
  });

  it('define cada tipografía con el mismo valor', () => {
    for (const [token, value] of Object.entries(fonts)) {
      const name = `font-${cssVariableName(token)}`;
      expect(cssValue(name), `falta o no coincide --${name}`).toBe(value);
    }
  });

  it('define cada radio con el mismo valor', () => {
    for (const [token, value] of Object.entries(radii)) {
      const name = `radius-${cssVariableName(token)}`;
      expect(cssValue(name), `falta o no coincide --${name}`).toBe(value);
    }
  });
});

describe('la paleta cumple lo que dice el proyecto', () => {
  it('no tiene gradientes declarados como color', () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('el verde es de válvula, no ácido', () => {
    // El verde ácido tiene el canal verde disparado y los otros dos hundidos.
    for (const green of [colors.tube, colors.tubeBright]) {
      const red = Number.parseInt(green.slice(1, 3), 16);
      const value = Number.parseInt(green.slice(3, 5), 16);
      expect(value - red).toBeLessThan(90);
    }
  });

  it('el fondo es negro cálido: más rojo que azul', () => {
    const red = Number.parseInt(colors.background.slice(1, 3), 16);
    const blue = Number.parseInt(colors.background.slice(5, 7), 16);
    expect(red).toBeGreaterThan(blue);
  });
});
