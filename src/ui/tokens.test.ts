import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  colors,
  fluidSizes,
  fonts,
  paletaClara,
  paletaOscura,
  radii,
  tap,
  VARIABLES_CSS,
} from './tokens';

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
  /**
   * Este espejo estuvo **sin guardián**, y era el más fácil de romper: los
   * `clamp()` llevan tres números cada uno, se retocan a ojo mirando la portada
   * y nadie iba a acordarse de copiar el retoque a la otra mitad.
   */
  it('define cada tamaño que crece con el ancho con el mismo valor', () => {
    for (const [token, value] of Object.entries(fluidSizes)) {
      expect(CSS, `--text-fluid-${token} no coincide con fluidSizes.${token}`).toContain(
        `--text-fluid-${token}: ${value};`,
      );
    }
  });

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

  /**
   * Esto sobrevivió al cambio de estética, y no por nostalgia.
   *
   * Nació como «el verde es de válvula», del amplificador que ya no está, pero la
   * regla que hay debajo no dependía de aquello: un verde con el canal verde
   * disparado y los otros dos hundidos, puesto al lado de un acento cálido, es lo
   * que separa una paleta de un semáforo. El verde subió a menta al pasar a
   * grafito —el apagado de antes se hundía— y sigue por debajo del listón.
   */
  it('el verde no es ácido', () => {
    for (const green of [colors.tube, colors.tubeBright]) {
      const red = Number.parseInt(green.slice(1, 3), 16);
      const value = Number.parseInt(green.slice(3, 5), 16);
      expect(value - red).toBeLessThan(90);
    }
  });

  /**
   * Y este es el que se dio la vuelta.
   *
   * Decía «el fondo es negro cálido: más rojo que azul», que era la identidad del
   * amplificador escrita en un test. Ahora dice lo contrario, y **eso es lo que
   * tiene que hacer**: el fondo es grafito frío a propósito
   * ([adr/0027](../../../docs/adr/0027-grafito-y-ambar.md)), porque un pardo a
   * esta luminancia se lee como marrón viejo y le come el sitio al único color
   * cálido que queda, que es el acento. Si alguien vuelve a calentar el fondo,
   * que falle aquí y no dentro de tres semanas mirando una captura.
   */
  it('el fondo es grafito frío: más azul que rojo', () => {
    const red = Number.parseInt(colors.background.slice(1, 3), 16);
    const blue = Number.parseInt(colors.background.slice(5, 7), 16);
    expect(blue).toBeGreaterThan(red);
  });
});

/**
 * El guardián que le faltaba a [adr/0026](../../../docs/adr/0026-el-blanco-hielo.md).
 *
 * La regla es de una línea —**subir es acercarse a la luz en los dos temas**— y
 * hasta ahora solo vivía escrita. El tema claro la incumplía entero: con blanco
 * puro de fondo, lo único que podía hacer una caja para verse era oscurecerse, así
 * que `.superficie-alta` significaba «esto destaca» en oscuro y «esto se apaga» en
 * claro. Es el tipo de fallo que no se ve en una pantalla suelta, solo comparando
 * los dos temas, que es justo lo que un test sí puede hacer de un vistazo.
 */
describe('las superficies suben hacia la luz', () => {
  it.each([
    ['claro', paletaClara],
    ['oscuro', paletaOscura],
  ])('en el tema %s, cada escalón es más claro que el de debajo', (_nombre, paleta) => {
    const fondo = luminancia(paleta.background);
    const superficie = luminancia(paleta.surface);
    const alta = luminancia(paleta.surfaceRaised);

    expect(superficie, 'surface no es más clara que background').toBeGreaterThan(fondo);
    expect(alta, 'surfaceRaised no es más clara que surface').toBeGreaterThan(superficie);
  });
});

/**
 * El guardián que faltaba: que un color con el que se escribe se pueda leer.
 *
 * Esto no se me ocurrió antes de tiempo, se descubrió tarde. El tema claro se
 * hizo con la regla delante —el dorado bonito de las paletas se descartó por no
 * llegar a 4,5:1 sobre blanco, y está escrito en `tokens.ts`— y al tema oscuro,
 * que es el que sale por defecto, no se le pasó la misma vara: su rojo daba
 * **2,26:1** y era el color de veinticuatro mensajes de error.
 *
 * Un color se mira contra los tres fondos sobre los que puede caer, y no solo
 * contra el de la página: la superficie alta es más clara que el fondo en el
 * tema oscuro y más oscura en el claro, así que siempre hay uno de los tres que
 * es el peor caso, y ninguno se libra.
 *
 * La cuenta es la de WCAG 2.1: luminancia relativa de cada color y `(claro +
 * 0,05) / (oscuro + 0,05)`. Se escribe aquí y no se importa de ningún sitio
 * porque el código de la aplicación no necesita medir contrastes: esto es una
 * regla sobre la paleta, y su sitio es el test que vigila la paleta.
 */
function luminancia(hex: string): number {
  const canal = (entero: number) => {
    const c = entero / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const n = Number.parseInt(hex.slice(1), 16);
  // Los desplazamientos separan los tres canales del hexadecimal de un tirón.
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

function contraste(uno: string, otro: string): number {
  const [claro, oscuro] = [luminancia(uno), luminancia(otro)].sort((a, b) => b - a);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

/**
 * Los colores con los que se escribe, y que por tanto se leen.
 *
 * Los que faltan no es que se libren: es que **no se escribe con ellos**, y de
 * ahí sale la regla que el sistema ya seguía sin tenerla dicha. Los colores van
 * en pares, y dentro de cada par el papel está repartido: `oxblood` y `tube`
 * rellenan —el tapizado del botón de escuchar, la barra de lo que llevas
 * hecho— y `oxbloodBright` y `tubeBright` son los que se leen. Se ve en el
 * recuento: veinticinco `text-tube-bright` y ni un solo `text-tube`.
 *
 * `brassDim` no está por otra razón, y es adorno: bordes suaves y fondos
 * tenues.
 *
 * Que ninguno de los tres se cuele en un texto no lo puede comprobar este
 * fichero, que solo ve la paleta, y por eso lo vigila
 * `app/screens/coherencia.test.ts`, que lee los componentes. Los dos tests son
 * la misma regla por sus dos mitades: aquí que el color valga, allí que se use
 * donde vale.
 */
const TOKENS_DE_TEXTO = [
  'text',
  'textMuted',
  'brass',
  'brassBright',
  'oxbloodBright',
  'tubeBright',
] as const;

/** Los tres fondos sobre los que puede caer un texto. */
const FONDOS = ['background', 'surface', 'surfaceRaised'] as const;

describe('lo que se escribe se puede leer', () => {
  it.each([
    ['claro', paletaClara],
    ['oscuro', paletaOscura],
  ])(
    'en el tema %s, cada color de texto llega a 4,5:1 sobre los tres fondos',
    (_nombre, paleta) => {
      for (const token of TOKENS_DE_TEXTO) {
        for (const fondo of FONDOS) {
          const ratio = contraste(paleta[token], paleta[fondo]);
          expect(
            Number(ratio.toFixed(2)),
            `${token} sobre ${fondo} se queda en ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );

  /**
   * Los bordes y las marcas que dan información no se leen, se distinguen, y
   * eso lo cumplen con 3:1. Aquí sí entra `tube`, que es el relleno de lo que
   * ya está hecho, junto a los dos tonos vivos que dibujan el punto de
   * grabación y el borde del botón de escuchar.
   */
  it.each([
    ['claro', paletaClara],
    ['oscuro', paletaOscura],
  ])('en el tema %s, lo que se dibuja llega a 3:1 sobre el fondo', (_nombre, paleta) => {
    for (const token of ['brass', 'brassBright', 'oxbloodBright', 'tube', 'tubeBright'] as const) {
      const ratio = contraste(paleta[token], paleta.background);
      expect(Number(ratio.toFixed(2)), `${token} sobre el fondo`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('el código de tres estados no se apoya solo en el color', () => {
  /**
   * Verde contra rojo es la pareja que no distingue la deficiencia de color más
   * común, y le pasa a uno de cada doce hombres. Este proyecto usa ese par en dos
   * códigos —si un acorde entra en la tonalidad, y qué papel armónico tiene— así
   * que la marca lleva **forma además de color**: círculo, anillo y rombo.
   *
   * Las aplicaciones que se apoyan en el color para esto lo resuelven enviando
   * paletas alternativas —Hooktheory manda cinco, dos de ellas para daltonismo—.
   * Con forma sale más barato y no hay nada que configurar.
   *
   * Se lee el fichero porque lo que se defiende es que **nadie vuelva a dibujar
   * el punto a mano**: en cuanto alguien escriba su `rounded-full` con
   * `bg-tube-bright`, el código vuelve a ser solo color y ningún test unitario lo
   * vería.
   */
  it('nadie dibuja el punto de colores a mano', () => {
    const raiz = join(process.cwd(), 'src');
    const pendientes: string[] = [];

    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, entrada.name);
        if (entrada.isDirectory()) {
          recorrer(ruta);
          continue;
        }
        if (!entrada.name.endsWith('.tsx') || entrada.name.includes('.test.')) {
          continue;
        }
        if (ruta.endsWith('ui/Marca.tsx')) {
          continue;
        }
        const codigo = readFileSync(ruta, 'utf8');
        // Un punto redondo pintado con uno de los tres tonos del código.
        if (/rounded-full[^`"']*\b(bg|border)-(tube|oxblood)(-bright)?\b/.test(codigo)) {
          pendientes.push(ruta.replace(raiz, 'src'));
        }
      }
    };
    recorrer(raiz);

    expect(pendientes).toEqual([]);
  });
});
