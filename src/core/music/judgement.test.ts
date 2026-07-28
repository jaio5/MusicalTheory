import { describe, expect, it } from 'vitest';

import { parseChordSymbol } from './chord-symbols';
import { judgeChord } from './judgement';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const context = { tonic: C, mode: 'major' as const, styleId: 'rock' as const };

function judge(symbol: string, extra: Partial<typeof context> & { playedNotes?: number[] } = {}) {
  return judgeChord(parseChordSymbol(symbol)!, { ...context, ...extra } as never);
}

describe('juzgar un acorde contra la tonalidad', () => {
  it('lo diatónico entra sin discusión', () => {
    const verdict = judge('F');
    expect(verdict.verdict).toBe('diatonic');
    expect(verdict.outOfKey).toEqual([]);
    expect(verdict.label).toBe('IV');
  });

  it('un prestado conocido es color, no error', () => {
    // Bb mayor en Do: el bVII, prestado del menor.
    const verdict = judge('Bb');
    expect(verdict.verdict).toBe('colour');
    expect(verdict.label).toBe('bVII');
    expect(verdict.why).toMatch(/tiene su sitio/);
  });

  it('dice qué notas se salen', () => {
    const verdict = judge('Bb');
    expect(verdict.outOfKey.map((note) => note)).toEqual([pitchClassFromName('A#')]);
  });

  it('lo que no tiene uso conocido se marca como fuera', () => {
    const verdict = judge('C#m7');
    expect(verdict.verdict).toBe('outside');
    expect(verdict.label).toBeNull();
    expect(verdict.why).toMatch(/fuera de la tonalidad/);
  });

  it('distingue una nota de fuera de varias', () => {
    // C menor en C mayor: solo el Mib se sale, y no es un préstamo del
    // catálogo, así que es de paso. D7 no vale de ejemplo porque sí está: es
    // la dominante secundaria del quinto grado.
    expect(judge('Cm').why).toMatch(/de paso/);
    expect(judge('C#m7').why).toMatch(/cambio de tono/);
  });

  it('reconoce la dominante secundaria aunque se salga', () => {
    const verdict = judge('D7');
    expect(verdict.verdict).toBe('colour');
    expect(verdict.label).toBe('V7/V');
  });

  it('el estilo cambia el veredicto de un acorde raro', () => {
    // La dominante secundaria del vi pesa en pop pero no en rock básico.
    const enJazz = judge('E7', { styleId: 'jazz' as never });
    expect(enJazz.verdict).toBe('colour');
    expect(enJazz.label).toBe('V7/vi');
  });

  it('mide cuánto encaja con lo que se está tocando', () => {
    const played = [C, pitchClassFromName('E'), pitchClassFromName('G')];
    expect(judge('C', { playedNotes: played }).fit).toBe(1);
    expect(judge('F#m7', { playedNotes: played }).fit).toBeLessThan(0.4);
  });

  it('sin nada tocado el encaje es cero, no una invención', () => {
    expect(judge('C').fit).toBe(0);
  });
});
