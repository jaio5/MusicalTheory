import { describe, expect, it } from 'vitest';

import { suggestChordSymbols } from './chord-symbols';

function symbols(text: string, limit?: number): string[] {
  return suggestChordSymbols(text, limit).map((chord) => chord.symbol);
}

describe('Proponer acordes según se escribe', () => {
  it('con solo la fundamental ofrece lo más usado primero', () => {
    expect(symbols('A', 4)).toEqual(['A', 'Am', 'A7', 'Am7']);
  });

  it('respeta la alteración escrita', () => {
    expect(symbols('Bb', 3)).toEqual(['Bb', 'Bbm', 'Bb7']);
    expect(symbols('f#', 2)).toEqual(['F#', 'F#m']);
  });

  it('filtra por lo que ya se ha escrito', () => {
    expect(symbols('Csus')).toEqual(['Csus4', 'Csus2']);
  });

  it('lo que ya está escrito entero va primero', () => {
    expect(symbols('Am7')[0]).toBe('Am7');
  });

  it('entiende las otras formas de escribir lo mismo', () => {
    expect(symbols('CM7')[0]).toBe('Cmaj7');
    expect(symbols('Dmin')[0]).toBe('Dm');
  });

  it('no propone nada sin una fundamental reconocible', () => {
    expect(symbols('H')).toEqual([]);
    expect(symbols('')).toEqual([]);
    expect(symbols('7')).toEqual([]);
  });

  it('cada propuesta trae sus notas', () => {
    const [first] = suggestChordSymbols('C', 1);

    expect(first?.notes).toEqual([0, 4, 7]);
  });
});
