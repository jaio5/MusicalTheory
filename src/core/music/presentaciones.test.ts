import { describe, expect, it } from 'vitest';

import { UNIT_ORDER } from './curriculum';
import { CONTENIDOS_DE_UNIDAD, presentacionDe } from './presentaciones';
import { RESUMENES_DE_UNIDAD, resumenDe } from './resumenes';

function repetidos(valores: readonly string[]): readonly string[] {
  return valores.filter((valor, indice) => valores.indexOf(valor) !== indice);
}

/**
 * Las presentaciones viven fuera del temario, por id de unidad, y lo que las une
 * es solo esa llave: un id mal escrito en un lado dejaría una unidad entrando sin
 * decir a qué, y una presentación huérfana que nadie ve. Nada más lo vigila.
 */
describe('cada unidad tiene su presentación, y solo ellas', () => {
  it('los resúmenes van por las mismas unidades que el temario, y en su orden', () => {
    expect(Object.keys(RESUMENES_DE_UNIDAD)).toEqual(UNIT_ORDER);
  });

  it('los contenidos también', () => {
    expect(Object.keys(CONTENIDOS_DE_UNIDAD)).toEqual(UNIT_ORDER);
  });

  it('pedir la de una unidad que no existe es un fallo, no una unidad muda', () => {
    expect(() => presentacionDe('no-existe')).toThrow(/no-existe/);
    expect(() => resumenDe('no-existe')).toThrow(/no-existe/);
  });

  it('la presentación entera lleva el mismo resumen que el camino', () => {
    for (const id of UNIT_ORDER) {
      expect(presentacionDe(id).resumen, id).toBe(resumenDe(id));
    }
  });
});

/**
 * La presentación promete lo que luego se pregunta, así que una vacía es una
 * unidad que entra sin decir a qué.
 */
describe('la presentación de cada unidad', () => {
  it('tiene un resumen y al menos un contenido, y ninguno vacío', () => {
    for (const id of UNIT_ORDER) {
      const { resumen, contenidos } = presentacionDe(id);
      expect(resumen.trim(), id).not.toBe('');
      expect(contenidos.length, id).toBeGreaterThan(0);
      for (const contenido of contenidos) {
        expect(contenido.trim(), id).not.toBe('');
      }
    }
  });

  it('no repite un contenido dentro de la misma unidad', () => {
    for (const id of UNIT_ORDER) {
      expect(repetidos(presentacionDe(id).contenidos), id).toEqual([]);
    }
  });
});

/**
 * La presentación es un contrato con lo que se pregunta (`Presentacion`), y tres
 * unidades de oído prometían otra cosa: reconocer las especies de séptima, una
 * melodía modal, y que el V mayor es un préstamo en menor. Ninguna lo hacía.
 */
describe('lo que promete la presentación es lo que se hace', () => {
  const presentacion = (id: string) => {
    const { resumen, contenidos } = presentacionDe(id);
    return [resumen, ...contenidos].join(' ');
  };

  it('la unidad de oído de las séptimas no promete reconocer cada especie', () => {
    expect(presentacion('p2-oido')).not.toMatch(/especies/);
    expect(presentacion('p2-oido')).toContain('pide resolver');
  });

  it('la de los modos habla de la sensible, que es lo que suena, y no de una melodía', () => {
    expect(presentacion('p5-oido')).not.toMatch(/melodía/);
    expect(presentacion('p5-oido')).toContain('sensible');
  });

  it('en menor lo prestado es la tónica mayor, no la dominante', () => {
    expect(presentacion('p3-prestados')).toContain('tercera de picardía');
    expect(presentacion('p3-prestados')).not.toMatch(/dominante mayor/);
  });

  it('el oído de las cadencias dice que también pregunta la plagal y la rota', () => {
    expect(presentacion('p6-oido')).toContain('la plagal y la rota');
  });
});
