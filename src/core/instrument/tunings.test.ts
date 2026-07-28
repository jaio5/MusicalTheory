import { describe, expect, it } from 'vitest';

import { midiToPitchClass, noteName } from '../music/notes';

import { nearestString, semitonesFromString } from './guitar';
import { TUNING_IDS, TUNINGS, type TuningId } from './tunings';

/** Las notas con su octava, de la sexta cuerda a la primera. */
function pitches(id: TuningId): string[] {
  const tuning = TUNINGS[id];
  return tuning.strings.map(
    (string) =>
      `${noteName(midiToPitchClass(string.midi), tuning.accidental)}${Math.floor(string.midi / 12) - 1}`,
  );
}

/**
 * Comprobado contra fuentes, no de memoria: una afinación mal escrita aquí es
 * una guitarra mal afinada allí, y el afinador diría que está bien.
 *
 * - Drop D: https://en.wikipedia.org/wiki/Drop_D_tuning
 * - Open G: https://en.wikipedia.org/wiki/Open_G_tuning
 * - Drop C: https://www.fender.com/articles/setup/drop-c-tuning
 * - DADGAD y open D: https://acousticguitar.com/getting-started-with-alternate-tunings/
 * - Medio tono abajo: https://guitargearfinder.com/guides/eb-tuning/
 */
const EXPECTED: Readonly<Record<TuningId, readonly string[]>> = {
  standard: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  dropD: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  halfStepDown: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'],
  fullStepDown: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'],
  dropC: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'],
  dadgad: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
  openG: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
  openD: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
};

describe('Afinaciones', () => {
  it.each(TUNING_IDS)('%s suena donde tiene que sonar', (id) => {
    expect(pitches(id)).toEqual(EXPECTED[id]);
  });

  it('la bajada de medio tono se escribe con bemoles, como en todas partes', () => {
    expect(TUNINGS.halfStepDown.strings.map((string) => string.label)).toEqual([
      'Eb grave',
      'Ab',
      'Db',
      'Gb',
      'Bb',
      'Eb agudo',
    ]);
  });

  it('open D lleva su tercera con sostenido', () => {
    expect(TUNINGS.openD.strings[3]?.label).toBe('F#');
  });

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

  it('el resumen de cada una empieza por sus seis notas', () => {
    for (const id of TUNING_IDS) {
      if (id === 'standard') {
        continue;
      }
      const notes = pitches(id)
        .map((pitch) => pitch.replace(/\d/, ''))
        .join(' ');
      expect(TUNINGS[id].summary.startsWith(notes)).toBe(true);
    }
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
