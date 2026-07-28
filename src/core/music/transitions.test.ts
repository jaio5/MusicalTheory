import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from './notes';
import { chordNotesFor } from './suggestions';
import { sharedNoteCount, suggestTransitions } from './transitions';

const C = pitchClassFromName('C');
const G = pitchClassFromName('G');
const A = pitchClassFromName('A');

const gMajor = { root: G, notes: chordNotesFor(G, 'major') };
const cMajor = { root: C, notes: chordNotesFor(C, 'major') };

describe('notas compartidas', () => {
  it('cuenta las que tienen en común', () => {
    // C mayor y A menor comparten Do y Mi.
    expect(sharedNoteCount(chordNotesFor(C, 'major'), chordNotesFor(A, 'minor'))).toBe(2);
  });

  it('es cero cuando no comparten nada', () => {
    expect(
      sharedNoteCount(chordNotesFor(C, 'major'), chordNotesFor(pitchClassFromName('F#'), 'major')),
    ).toBe(0);
  });
});

describe('a dónde ir desde un acorde', () => {
  it('desde el V lo primero que propone es volver a casa', () => {
    const next = suggestTransitions({
      tonic: C,
      mode: 'major',
      styleId: 'pop',
      from: gMajor,
      limit: 3,
    });
    expect(next[0]!.symbol).toBe('C');
  });

  it('no propone quedarse donde estás', () => {
    const next = suggestTransitions({
      tonic: C,
      mode: 'major',
      styleId: 'rock',
      from: cMajor,
      limit: 10,
    });
    expect(next.map((item) => item.symbol)).not.toContain('C');
  });

  it('explica cómo se mueve el bajo', () => {
    const next = suggestTransitions({
      tonic: C,
      mode: 'major',
      styleId: 'pop',
      from: gMajor,
      limit: 5,
    });
    expect(next[0]!.motionWhy).toContain('quintas');
    for (const item of next) {
      expect(item.motionWhy.length).toBeGreaterThan(0);
    }
  });

  it('dice cuántas notas comparte con el acorde actual', () => {
    const next = suggestTransitions({
      tonic: C,
      mode: 'major',
      styleId: 'pop',
      from: cMajor,
      limit: 10,
    });
    const aMinor = next.find((item) => item.symbol === 'Am');
    expect(aMinor?.sharedNotes).toBe(2);
  });

  it('cambia según el estilo, no solo según el acorde', () => {
    const rock = suggestTransitions({
      tonic: C,
      mode: 'major',
      styleId: 'rock',
      from: cMajor,
      limit: 6,
    }).map((item) => item.symbol);
    const jazz = suggestTransitions({
      tonic: C,
      mode: 'major',
      styleId: 'jazz',
      from: cMajor,
      limit: 6,
    }).map((item) => item.symbol);

    expect(rock.join('|')).not.toBe(jazz.join('|'));
  });

  it('viene ordenado de más a menos natural', () => {
    const scores = suggestTransitions({
      tonic: A,
      mode: 'minor',
      styleId: 'rock',
      from: { root: A, notes: chordNotesFor(A, 'minor') },
      limit: 8,
    }).map((item) => item.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});
