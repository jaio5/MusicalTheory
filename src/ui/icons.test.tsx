// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import * as iconos from './icons';

/**
 * Los iconos, y por qué no son emoji.
 *
 * Un emoji lo pinta el sistema con su propia paleta: no se tiñe con el color del
 * texto, no cambia con el tema y sale de un color distinto en cada aparato. Estos
 * son trazos que heredan `currentColor`, y eso es justo lo que se comprueba aquí
 * —además de que ninguno lleva texto dentro, que es lo que un lector de pantalla
 * leería en voz alta sin venir a cuento—.
 *
 * Se recorren todos con un bucle a propósito: un icono nuevo entra en el test
 * solo con existir, que es la única forma de que esto no se quede atrás.
 */

const TODOS = Object.entries(iconos).filter(([nombre]) => nombre.startsWith('Icono')) as [
  string,
  () => React.ReactElement,
][];

describe('los iconos', () => {
  it('son doce, y todos se pintan', () => {
    expect(TODOS.length).toBeGreaterThanOrEqual(12);
  });

  it('cada uno es un svg que hereda el color del texto', () => {
    for (const [nombre, Icono] of TODOS) {
      const { container, unmount } = render(<Icono />);
      const svg = container.querySelector('svg');

      expect(svg, nombre).not.toBeNull();
      expect(svg?.getAttribute('stroke') ?? svg?.getAttribute('fill'), nombre).toBe('currentColor');
      unmount();
    }
  });

  it('ninguno lleva texto que un lector de pantalla vaya a leer', () => {
    for (const [nombre, Icono] of TODOS) {
      const { container, unmount } = render(<Icono />);

      expect(container.textContent, nombre).toBe('');
      unmount();
    }
  });

  it('y ninguno es un emoji', () => {
    // La regla escrita: emoji no, que no se tiñen.
    for (const [nombre, Icono] of TODOS) {
      const { container, unmount } = render(<Icono />);

      expect(container.innerHTML, nombre).not.toMatch(/\p{Extended_Pictographic}/u);
      unmount();
    }
  });
});
