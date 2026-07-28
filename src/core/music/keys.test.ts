import { describe, expect, it } from 'vitest';

import {
  addPitchClass,
  bestKey,
  createPitchHistogram,
  decayPitchHistogram,
  detectKey,
  keyName,
} from './keys';
import { pitchClassFromName, type NoteName } from './notes';

/** Toca una secuencia de notas, una cada 300 ms, sobre un histograma vacío. */
function play(sequence: readonly NoteName[], startAt = 0, stepMs = 300) {
  return sequence.reduce(
    (histogram, note, index) =>
      addPitchClass(histogram, pitchClassFromName(note), startAt + index * stepMs),
    createPitchHistogram(startAt),
  );
}

describe('detección de tonalidad', () => {
  it('reconoce A menor en una secuencia clara', () => {
    // Melodía sobre A menor: insiste en la tónica y en la quinta, y usa el
    // Sol natural que la separa de C mayor como centro.
    const histogram = play(['A', 'C', 'E', 'A', 'G', 'E', 'D', 'C', 'A', 'E', 'A', 'B', 'C', 'A']);

    const candidate = bestKey(histogram);
    expect(candidate).not.toBeNull();
    expect(candidate?.mode).toBe('minor');
    expect(candidate?.tonic).toBe(pitchClassFromName('A'));
    expect(candidate?.name).toBe('A menor');
  });

  it('reconoce C mayor cuando el centro es Do', () => {
    const histogram = play(['C', 'E', 'G', 'C', 'D', 'E', 'F', 'E', 'G', 'C', 'B', 'C']);
    expect(bestKey(histogram)?.name).toBe('C mayor');
  });

  it('devuelve tres candidatas ordenadas de mejor a peor', () => {
    const candidates = detectKey(play(['A', 'C', 'E', 'A', 'G', 'E', 'A']));

    expect(candidates).toHaveLength(3);
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(candidates[1]!.score);
    expect(candidates[1]!.score).toBeGreaterThanOrEqual(candidates[2]!.score);
  });

  it('no se inventa un tono cuando no ha sonado nada', () => {
    expect(detectKey(createPitchHistogram())).toEqual([]);
    expect(bestKey(createPitchHistogram())).toBeNull();
  });

  it('rechaza histogramas que no tienen doce pesos', () => {
    expect(() => detectKey([1, 2, 3])).toThrow(RangeError);
  });
});

describe('decaimiento del histograma', () => {
  it('reduce a la mitad cada vida media', () => {
    const start = addPitchClass(createPitchHistogram(0), pitchClassFromName('A'), 0);
    const later = decayPitchHistogram(start, 20_000, 20_000);

    expect(later.weights[pitchClassFromName('A')]).toBeCloseTo(0.5, 10);
    expect(later.updatedAt).toBe(20_000);
  });

  it('no cambia nada si el tiempo no ha avanzado', () => {
    const start = addPitchClass(createPitchHistogram(0), pitchClassFromName('A'), 0);
    expect(decayPitchHistogram(start, 0)).toBe(start);
  });

  it('sigue al músico cuando se va de tono a mitad de sesión', () => {
    // Primero un rato en C mayor.
    let histogram = createPitchHistogram(0);
    const opening: readonly NoteName[] = ['C', 'E', 'G', 'C', 'D', 'F', 'E', 'C', 'G', 'C'];
    opening.forEach((note, index) => {
      histogram = addPitchClass(histogram, pitchClassFromName(note), index * 500);
    });
    expect(bestKey(histogram)?.name).toBe('C mayor');

    // Dos minutos después se pasa a E menor y no vuelve.
    const shift: readonly NoteName[] = [
      'E',
      'G',
      'B',
      'E',
      'D',
      'B',
      'A',
      'G',
      'E',
      'B',
      'E',
      'F#',
      'G',
      'E',
    ];
    shift.forEach((note, index) => {
      histogram = addPitchClass(histogram, pitchClassFromName(note), 120_000 + index * 500);
    });

    expect(bestKey(histogram)?.name).toBe('E menor');
  });
});

describe('nombres de tonalidad', () => {
  it('escribe la nota en cifrado anglosajón y el modo en español', () => {
    expect(keyName(pitchClassFromName('A'), 'minor')).toBe('A menor');
    expect(keyName(pitchClassFromName('F#'), 'major')).toBe('F# mayor');
  });
});
