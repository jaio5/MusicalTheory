import { describe, expect, it } from 'vitest';

import { roleOfDegree, roleOfDegreeSymbol, teachingRank } from './harmonic-function';

describe('roleOfDegreeSymbol', () => {
  // La tabla por nombre y la tabla por número tienen que decir lo mismo de los
  // siete diatónicos, o habría dos verdades sobre lo que hace un IV.
  it.each([
    ['major' as const, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']],
    ['minor' as const, ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']],
  ])('coincide con roleOfDegree en %s', (mode, simbolos) => {
    for (const [indice, simbolo] of simbolos.entries()) {
      expect(roleOfDegreeSymbol(simbolo), simbolo).toBe(roleOfDegree(mode, indice));
    }
  });

  it('los prestados tienen papel, que es de lo que sirven', () => {
    expect(roleOfDegreeSymbol('bVII')).toBe('dominant');
    expect(roleOfDegreeSymbol('bVI')).toBe('subdominant');
    expect(roleOfDegreeSymbol('bIII')).toBe('tonic');
  });

  it('lo que no está en la tabla es de paso, no revienta', () => {
    expect(roleOfDegreeSymbol('V7/vi')).toBe('approach');
  });
});

describe('un grado que no es de la tonalidad', () => {
  /**
   * Los grados prestados y las dominantes secundarias no están en la lista de
   * los siete: no tienen papel tonal propio, y lo honesto es decir que son de
   * paso en vez de colgarles el papel del grado que ocupa ese sitio.
   */
  it('no tiene papel propio y va el ultimo al enseñarse', () => {
    expect(roleOfDegree('major', 99)).toBe('approach');
    expect(roleOfDegree('minor', -1)).toBe('approach');
    expect(teachingRank('major', 99)).toBe(7);
    expect(teachingRank('minor', 99)).toBe(7);
    // Y la casa es siempre la primera que se enseña.
    expect(teachingRank('major', 0)).toBe(0);
  });
});
