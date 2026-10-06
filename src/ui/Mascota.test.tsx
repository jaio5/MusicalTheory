// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Mascota } from './Mascota';
import { CAPAS_MASCOTA, COLORES_MASCOTA } from './mascota-pixeles';

afterEach(cleanup);

function leer(ruta: string): string {
  return readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8');
}

/** Los colores con los que se ha pintado cada trazo, en el orden del dibujo. */
function colores(svg: Element): string[] {
  return [...svg.querySelectorAll('path')].map((trazo) => trazo.style.fill);
}

describe('El profesor', () => {
  it('es una imagen con nombre, nítida y a 64 px de fábrica', () => {
    render(<Mascota />);
    const svg = screen.getByRole('img', { name: 'El profesor' });

    expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
    // 64 y no 56: dos píxeles de pantalla por cada uno del dibujo. Con un
    // múltiplo que no es entero, unas filas salen dobles y otras sencillas.
    expect(svg).toHaveClass('size-16');
    // La sombra es de la sala: `drop-shadow-lg` era un negro de fuera de la paleta.
    expect(svg).toHaveClass('sombra-pixel');
    expect(svg).not.toHaveClass('drop-shadow-lg');
  });

  it('respeta el tamaño que le pidan', () => {
    render(<Mascota className="size-32" />);

    expect(screen.getByRole('img')).toHaveClass('size-32');
    expect(screen.getByRole('img')).not.toHaveClass('size-16');
  });

  /** Al lado de la marca, el nombre ya lo dice el enlace: el muñeco se calla. */
  it('decorativa no se anuncia', () => {
    const { container } = render(<Mascota decorativa className="size-8" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * Los tres estados. Callado: media sonrisa, filamento apagado, ojos que
   * parpadean. Es lo que se ve casi siempre, así que no lleva nada encendido.
   */
  it('callado sonríe con el filamento apagado', () => {
    render(<Mascota />);
    const svg = screen.getByRole('img');

    expect(colores(svg)).toContain('var(--mascota-filamento)');
    expect(colores(svg)).toContain('var(--mascota-cristal)');
    expect(colores(svg)).not.toContain('var(--mascota-cristal-encendido)');
    expect(svg.querySelector('.mascota-brasa')).toBeNull();
    expect(svg.querySelector('.mascota-boca-abierta')).toBeNull();
    expect(svg.querySelector('.mascota-ojos-abiertos')).not.toBeNull();
    expect(svg.querySelector('.mascota-ojos-cerrados')).not.toBeNull();
  });

  /**
   * Hablando, la boca son dos capas que se turnan, y las cejas suben una fila.
   * Las cejas se comprueban por el trazo: son las mismas en otra altura.
   */
  it('hablando abre la boca en dos fotogramas y levanta las cejas', () => {
    render(<Mascota hablando />);
    const svg = screen.getByRole('img');
    const trazos = [...svg.querySelectorAll('path')].map((trazo) => trazo.getAttribute('d'));

    expect(svg.querySelector('.mascota-boca-abierta')).not.toBeNull();
    expect(svg.querySelector('.mascota-boca-entornada')).not.toBeNull();
    expect(trazos).toContain(CAPAS_MASCOTA.cejasArriba[0].d);
    expect(trazos).not.toContain(CAPAS_MASCOTA.cejas[0].d);
    expect(trazos).not.toContain(CAPAS_MASCOTA.bocaCallada[0].d);
  });

  /**
   * Atento —el micrófono abierto—: el vidrio entero cambia de color, el
   * filamento se enciende y aparece el cerco que late. Es lo que tiene que verse
   * de reojo, así que no basta con que cambie un detalle.
   */
  it('atento enciende el filamento y calienta el cristal', () => {
    render(<Mascota atento />);
    const svg = screen.getByRole('img');

    expect(colores(svg)).toContain('var(--mascota-cristal-encendido)');
    expect(colores(svg)).not.toContain('var(--mascota-cristal)');
    expect(colores(svg)).not.toContain('var(--mascota-filamento)');
    expect(colores(svg)).toContain('var(--mascota-verde)');
    expect(svg.querySelector('.mascota-brasa')).not.toBeNull();
  });
});

/**
 * Los colores del dibujo existen en la hoja, y valen lo mismo que en el script
 * que pinta la muestra.
 *
 * Un nombre que no está en globals.css no falla en ningún sitio: el trazo sale
 * sin relleno, o sea negro, y el muñeco pierde una pieza sin que nada se queje.
 */
describe('la paleta del profesor', () => {
  const CSS = leer('../app/globals.css');
  const SCRIPT = leer('../../arte/mascota/build.py');

  /** Lo que vale cada `--mascota-*` en un tema: el oscuro de base y el claro encima. */
  function enLaHoja(tema: 'claro' | 'oscuro'): Map<string, string> {
    const valores = new Map<string, string>();
    const bloques = [...CSS.matchAll(/(:root[^{]*)\{([^}]*)\}/g)];
    const base = bloques.filter(([, selector]) => selector!.includes(":root[data-tema='oscuro']"));
    const claro = bloques.filter(([, selector]) => selector!.trim() === ":root[data-tema='claro']");
    for (const [, , cuerpo] of tema === 'claro' ? [...base, ...claro] : base) {
      for (const [, nombre, valor] of cuerpo!.matchAll(/--mascota-([a-z-]+):\s*([^;]+);/g)) {
        valores.set(nombre!, valor!.trim().toLowerCase());
      }
    }
    return valores;
  }

  /** La `PALETA` de build.py, leída como texto: es un diccionario por tema. */
  function enElScript(tema: 'claro' | 'oscuro'): Map<string, string> {
    const bloque = new RegExp(`'${tema}': \\{([^}]*)\\}`).exec(SCRIPT)?.[1] ?? '';
    return new Map(
      [...bloque.matchAll(/'([a-z-]+)': '(#[0-9A-Fa-f]{6})'/g)].map(([, nombre, valor]) => [
        nombre!,
        valor!.toLowerCase(),
      ]),
    );
  }

  it.each(['claro', 'oscuro'] as const)('en el tema %s, todos están y coinciden', (tema) => {
    const hoja = enLaHoja(tema);
    const script = enElScript(tema);

    for (const color of COLORES_MASCOTA) {
      expect(hoja.get(color), `--mascota-${color} en globals.css`).toMatch(/^#[0-9a-f]{6}$/);
      expect(script.get(color), `'${color}' en build.py`).toBe(hoja.get(color));
    }
  });
});
