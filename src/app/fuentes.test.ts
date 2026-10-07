import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

/*
  `next/font/local` no es una función de verdad fuera de Next: la sustituye el
  compilador al construir, y llamada a secas lanza un error vacío. Aquí se cambia
  por una que devuelve lo que le piden, que es lo que hace falta para mirar
  **qué** se pide.
*/
const llamadas: Array<Record<string, unknown>> = [];
vi.mock('next/font/local', () => ({
  default: (opciones: Record<string, unknown>) => {
    llamadas.push(opciones);
    return { variable: `variable-de-${String(opciones.variable)}`, className: 'x', style: {} };
  },
}));

const { CLASES_DE_FUENTES } = await import('./fuentes');

describe('las letras de la aplicación', () => {
  it('son tres, y cada una deja su variable en el html', () => {
    expect(llamadas.map((opciones) => opciones.variable)).toEqual([
      '--fuente-titulos',
      '--fuente-cuerpo',
      '--fuente-cifras',
    ]);
    expect(CLASES_DE_FUENTES).toBe(
      'variable-de---fuente-titulos variable-de---fuente-cuerpo variable-de---fuente-cifras',
    );
  });

  it('se sirven desde el repositorio, y el fichero existe', () => {
    for (const { src } of llamadas) {
      expect(String(src)).toMatch(/^\.\/_fuentes\/.+\.woff2$/);
      expect(existsSync(fileURLToPath(new URL(String(src), import.meta.url))), String(src)).toBe(
        true,
      );
    }
  });

  /**
   * La monoespaciada no sale en todas las pantallas, así que precargarla sería
   * pagar sus 18 kB en las que no la usan. Las otras dos salen en todas.
   */
  it('solo la monoespaciada llega sin precargar', () => {
    expect(llamadas.map((opciones) => opciones.preload ?? true)).toEqual([true, true, false]);
  });
});
