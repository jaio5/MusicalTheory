import { describe, expect, it } from 'vitest';

import { parseChordSymbol } from './chord-symbols';
import { noteName, pitchClassFromName } from './notes';

describe('leer un cifrado', () => {
  it('lee una tríada mayor', () => {
    const chord = parseChordSymbol('C');
    expect(chord?.root).toBe(pitchClassFromName('C'));
    expect(chord?.notes.map((note) => noteName(note))).toEqual(['C', 'E', 'G']);
  });

  it('lee sostenidos y bemoles en la fundamental', () => {
    expect(parseChordSymbol('F#m')?.root).toBe(pitchClassFromName('F#'));
    expect(parseChordSymbol('Bb')?.root).toBe(pitchClassFromName('A#'));
  });

  it('lee cuatríadas y colores', () => {
    expect(parseChordSymbol('Am7')?.shape.name).toBe('menor séptima');
    expect(parseChordSymbol('Cmaj7')?.shape.name).toBe('con séptima mayor');
    expect(parseChordSymbol('G7sus4')?.notes).toHaveLength(4);
    expect(parseChordSymbol('E7#9')?.notes).toHaveLength(5);
    expect(parseChordSymbol('A5')?.notes).toHaveLength(2);
  });

  it('acepta las otras formas de escribir lo mismo', () => {
    expect(parseChordSymbol('Amin')?.symbol).toBe('Am');
    expect(parseChordSymbol('A-')?.symbol).toBe('Am');
    expect(parseChordSymbol('CM7')?.symbol).toBe('Cmaj7');
    expect(parseChordSymbol('Bø')?.symbol).toBe('Bm7b5');
    expect(parseChordSymbol('C+')?.symbol).toBe('Caug');
    expect(parseChordSymbol('Dsus')?.symbol).toBe('Dsus4');
  });

  it('distingue M7 de m7, que es lo único donde importa la mayúscula', () => {
    expect(parseChordSymbol('CM7')?.shape.name).toBe('con séptima mayor');
    expect(parseChordSymbol('Cm7')?.shape.name).toBe('menor séptima');
  });

  it('perdona espacios y minúsculas en la fundamental', () => {
    expect(parseChordSymbol('  a m 7 ')?.symbol).toBe('Am7');
    expect(parseChordSymbol('bb')?.symbol).toBe('Bb');
  });

  it('normaliza el cifrado que devuelve', () => {
    expect(parseChordSymbol('CDIM7')?.symbol).toBe('Cdim7');
  });

  it('devuelve null cuando no lo reconoce, en vez de inventarse algo', () => {
    expect(parseChordSymbol('')).toBeNull();
    expect(parseChordSymbol('H')).toBeNull();
    expect(parseChordSymbol('Cmajor')).toBeNull();
    expect(parseChordSymbol('X7')).toBeNull();
    expect(parseChordSymbol('7')).toBeNull();
  });

  it('nunca repite una nota en el acorde', () => {
    for (const symbol of ['C', 'Am7', 'G7#9', 'Fmaj9', 'A5']) {
      const chord = parseChordSymbol(symbol)!;
      expect(new Set(chord.notes).size).toBe(chord.notes.length);
    }
  });
});
