import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BADGES } from '@core/music';

/**
 * Que la documentación no mienta sobre lo que se puede contar.
 *
 * Este repositorio tiene una regla escrita —«una documentación que miente es
 * peor que no tenerla»— y un número escrito a mano es la manera más fácil de
 * romperla sin darse cuenta: `CLAUDE.md` decía «van treinta y cuatro» ADR
 * cuando ya había treinta y seis, y nadie lo nota hasta que alguien va a
 * buscar el que falta.
 *
 * Aquí se vigila lo que tiene un número de verdad al lado con el que comparar.
 * Lo que no se puede contar —si un párrafo sigue siendo cierto— no se vigila
 * desde aquí, se vigila leyéndolo.
 */

const RAIZ = resolve(import.meta.dirname, '../..');

function leer(ruta: string): string {
  return readFileSync(resolve(RAIZ, ruta), 'utf8');
}

/** Los números hasta cuarenta, como los escribe esta casa: con letra. */
const EN_LETRA: Readonly<Record<number, string>> = {
  13: 'trece',
  14: 'catorce',
  15: 'quince',
  16: 'dieciséis',
  17: 'diecisiete',
  18: 'dieciocho',
  30: 'treinta',
  31: 'treinta y uno',
  32: 'treinta y dos',
  33: 'treinta y tres',
  34: 'treinta y cuatro',
  35: 'treinta y cinco',
  36: 'treinta y seis',
  37: 'treinta y siete',
  38: 'treinta y ocho',
  39: 'treinta y nueve',
  40: 'cuarenta',
};

describe('lo que la documentación cuenta', () => {
  it('el mapa dice cuántos ADR hay, y son esos', () => {
    const cuantos = readdirSync(resolve(RAIZ, 'docs/adr')).filter((f) => f.endsWith('.md')).length;
    const enLetra = EN_LETRA[cuantos];

    expect(enLetra, `añade ${cuantos} a EN_LETRA`).toBeDefined();
    expect(leer('CLAUDE.md')).toContain(`Van ${enLetra}`);
  });

  /**
   * Y los ADR van numerados sin saltos ni repetidos: un hueco en la serie se
   * lee como un documento borrado, y dos con el mismo número hacen que citar
   * «el ADR 0032» deje de señalar a uno solo.
   */
  it('los ADR van numerados del cero al último, sin huecos', () => {
    const numeros = readdirSync(resolve(RAIZ, 'docs/adr'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => Number(f.slice(0, 4)))
      .sort((a, b) => a - b);

    expect(numeros).toEqual(numeros.map((_, indice) => indice + 1));
  });

  // La pantalla de medallas dice «de quince», y quince son las que hay.
  it('el catálogo de medallas y lo que dicen los documentos coinciden', () => {
    expect(leer('docs/adr/0028-componer-tambien-cuenta.md')).toContain(
      `${EN_LETRA[BADGES.length] ?? BADGES.length} en total`,
    );
  });
});
