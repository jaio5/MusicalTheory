import { describe, expect, it } from 'vitest';

import { nearestString, semitonesFromString } from './guitar';
import { TUNING_IDS, TUNINGS } from './tunings';

describe('Afinaciones', () => {
  it('todas tienen seis cuerdas numeradas de la sexta a la primera', () => {
    for (const id of TUNING_IDS) {
      expect(TUNINGS[id].strings.map((string) => string.number)).toEqual([6, 5, 4, 3, 2, 1]);
    }
  });

  it('nombra cada cuerda por la nota que da al aire', () => {
    expect(TUNINGS.dropD.strings.map((string) => string.label)).toEqual([
      'D grave',
      'A',
      'D agudo',
      'G',
      'B',
      'E',
    ]);
  });

  it('distingue las dos mi de la estándar', () => {
    const labels = TUNINGS.standard.strings.map((string) => string.label);

    expect(labels[0]).toBe('E grave');
    expect(labels[5]).toBe('E agudo');
  });

  it('drop D solo cambia la sexta', () => {
    const standard = TUNINGS.standard.strings.map((string) => string.midi);
    const dropped = TUNINGS.dropD.strings.map((string) => string.midi);

    expect(dropped[0]).toBe(standard[0]! - 2);
    expect(dropped.slice(1)).toEqual(standard.slice(1));
  });

  it('open G al aire da un acorde de G', () => {
    const notes = new Set(TUNINGS.openG.strings.map((string) => string.midi % 12));

    // G, B y D, y nada más.
    expect(notes).toEqual(new Set([7, 11, 2]));
  });

  it('afinar en drop C compara con las cuerdas de drop C, no con las de siempre', () => {
    // Un C1 grave: en drop C es la sexta al aire; en estándar sería la sexta
    // cuatro semitonos por debajo.
    const string = nearestString(36, TUNINGS.dropC.strings);

    expect(string.number).toBe(6);
    expect(semitonesFromString(36, string)).toBe(0);
  });
});
