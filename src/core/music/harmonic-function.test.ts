import { describe, expect, it } from 'vitest';

import { roleOfDegree, roleOfDegreeSymbol } from './harmonic-function';

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
