import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from '../music/notes';
import {
  DEFAULT_FRET_COUNT,
  fretboardPositions,
  fretMidi,
  nearestString,
  semitonesFromString,
  STANDARD_TUNING,
  stringFrequency,
} from './guitar';

describe('cuerdas al aire', () => {
  it('tiene las seis en afinación estándar', () => {
    expect(STANDARD_TUNING).toHaveLength(6);
    expect(stringFrequency(STANDARD_TUNING[0]!)).toBeCloseTo(82.41, 1);
    expect(stringFrequency(STANDARD_TUNING[5]!)).toBeCloseTo(329.63, 1);
  });

  it('va de la sexta a la primera', () => {
    expect(STANDARD_TUNING.map((string) => string.number)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('encuentra la cuerda más cercana a lo que suena', () => {
    expect(nearestString(45).label).toBe('La');
    expect(nearestString(46).label).toBe('La');
    expect(nearestString(64).number).toBe(1);
  });

  it('en un empate se queda con la más grave', () => {
    // Justo en medio de la quinta (45) y la cuarta (50).
    expect(nearestString(47.5).midi).toBe(45);
  });

  it('cuenta a cuántos semitonos está de esa cuerda', () => {
    const fifth = STANDARD_TUNING[1]!;
    expect(semitonesFromString(45, fifth)).toBe(0);
    expect(semitonesFromString(47, fifth)).toBe(2);
    expect(semitonesFromString(43, fifth)).toBe(-2);
  });
});

describe('trastes', () => {
  it('el traste cero es la cuerda al aire', () => {
    expect(fretMidi(STANDARD_TUNING[5]!, 0)).toBe(64);
  });

  it('cada traste sube un semitono', () => {
    expect(fretMidi(STANDARD_TUNING[5]!, 5)).toBe(69);
  });

  it('el traste doce de cada cuerda es su octava', () => {
    for (const string of STANDARD_TUNING) {
      expect(fretMidi(string, 12)).toBe(string.midi + 12);
    }
  });

  it('el traste cinco de una cuerda da la siguiente al aire, salvo entre la tercera y la segunda', () => {
    expect(fretMidi(STANDARD_TUNING[0]!, 5)).toBe(STANDARD_TUNING[1]!.midi);
    expect(fretMidi(STANDARD_TUNING[1]!, 5)).toBe(STANDARD_TUNING[2]!.midi);
    expect(fretMidi(STANDARD_TUNING[2]!, 5)).toBe(STANDARD_TUNING[3]!.midi);
    // La segunda se afina en el traste cuatro de la tercera.
    expect(fretMidi(STANDARD_TUNING[3]!, 4)).toBe(STANDARD_TUNING[4]!.midi);
    expect(fretMidi(STANDARD_TUNING[4]!, 5)).toBe(STANDARD_TUNING[5]!.midi);
  });
});

describe('posiciones del mástil', () => {
  const positions = fretboardPositions();

  it('cubre las seis cuerdas con sus trastes y el aire', () => {
    expect(positions).toHaveLength(6 * (DEFAULT_FRET_COUNT + 1));
  });

  it('coloca cada nota donde toca', () => {
    const la = positions.find((position) => position.string.number === 5 && position.fret === 0);
    expect(la?.pitchClass).toBe(pitchClassFromName('A'));

    const doTraste = positions.find(
      (position) => position.string.number === 5 && position.fret === 3,
    );
    expect(doTraste?.pitchClass).toBe(pitchClassFromName('C'));
  });
});
