import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { colors, fonts, paletaClara, paletaOscura, radii, tap, VARIABLES_CSS } from './tokens';

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
  /**
   * Ahora son dos paletas, así que se comprueban las dos: la del bloque de
   * siempre —claro— y la del bloque `[data-tema='oscuro']`. El CSS las escribe en
   * español y los tokens en inglés; la correspondencia vive en `VARIABLES_CSS`.
   */
  it.each([
    ['claro', paletaClara, /:root\[data-tema='claro'\]\s*\{([^}]*)\}/],
    ['oscuro', paletaOscura, /:root,\s*:root\[data-tema='oscuro'\]\s*\{([^}]*)\}/],
  ])(
    'define cada color del tema %s con el mismo valor en los dos sitios',
    (_nombre, paleta, bloque) => {
      const css = bloque.exec(CSS)?.[1];
      expect(css, 'no se ha encontrado el bloque del tema en globals.css').toBeTruthy();

      for (const [token, variable] of Object.entries(VARIABLES_CSS)) {
        const escrito = new RegExp(`--${variable}:\\s*([^;]+);`).exec(css!)?.[1]?.trim();
        expect(escrito?.toLowerCase(), `--${variable}`).toBe(
          paleta[token as keyof typeof paleta].toLowerCase(),
        );
      }
    },
  );

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

  // El alto mínimo de lo que se pulsa vive en los dos sitios como todo lo demás:
  // en `tap` para el código y en `--spacing-tap` para las utilidades.
  it('define el alto mínimo de lo que se pulsa con el mismo valor', () => {
    expect(cssValue('spacing-tap')).toBe(tap);
  });
});

describe('el tema oscuro cumple lo que dice el proyecto', () => {
  it('no tiene gradientes declarados como color', () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  // Del tema oscuro: es el que tiene la identidad del amplificador.
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
