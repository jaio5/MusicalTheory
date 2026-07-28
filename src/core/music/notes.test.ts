import { describe, expect, it } from 'vitest';

import {
  A4_FREQUENCY,
  A4_MIDI,
  centsBetween,
  describePitch,
  frequencyToMidi,
  midiToFrequency,
  midiToOctave,
  noteName,
  normalizePitchClass,
  pitchClassFromName,
} from './notes';

describe('conversión entre frecuencia y MIDI', () => {
  it('ancla La4 en 440 Hz de ida y vuelta', () => {
    expect(midiToFrequency(A4_MIDI)).toBe(A4_FREQUENCY);
    expect(frequencyToMidi(A4_FREQUENCY)).toBe(A4_MIDI);
  });

  it('duplicar la frecuencia sube una octava', () => {
    expect(frequencyToMidi(880)).toBeCloseTo(A4_MIDI + 12, 10);
    expect(midiToFrequency(A4_MIDI - 12)).toBeCloseTo(220, 10);
  });

  it('devuelve las frecuencias de las seis cuerdas al aire', () => {
    // Mi2, La2, Re3, Sol3, Si3, Mi4 en afinación estándar.
    const strings: ReadonlyArray<readonly [number, number]> = [
      [40, 82.41],
      [45, 110.0],
      [50, 146.83],
      [55, 196.0],
      [59, 246.94],
      [64, 329.63],
    ];

    for (const [midi, frequency] of strings) {
      expect(midiToFrequency(midi)).toBeCloseTo(frequency, 1);
    }
  });

  it('rechaza frecuencias que no son positivas', () => {
    expect(() => frequencyToMidi(0)).toThrow(RangeError);
    expect(() => frequencyToMidi(-100)).toThrow(RangeError);
  });
});

describe('cents', () => {
  it('cuenta 1200 cents por octava', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 10);
    expect(centsBetween(220, 440)).toBeCloseTo(-1200, 10);
  });

  it('da positivo cuando la nota suena alta y negativo cuando suena baja', () => {
    expect(describePitch(444).cents).toBeGreaterThan(0);
    expect(describePitch(436).cents).toBeLessThan(0);
    expect(describePitch(A4_FREQUENCY).cents).toBeCloseTo(0, 10);
  });

  it('mantiene la desviación dentro de medio semitono', () => {
    for (const frequency of [82.41, 110, 123.4, 261.63, 440, 444, 1318.5]) {
      const cents = describePitch(frequency).cents;
      expect(cents).toBeGreaterThanOrEqual(-50);
      expect(cents).toBeLessThan(50);
    }
  });
});

describe('describePitch', () => {
  it('identifica La4 exacto', () => {
    expect(describePitch(A4_FREQUENCY)).toMatchObject({
      midi: 69,
      name: 'A',
      octave: 4,
      pitchClass: 9,
    });
  });

  it('sigue llamando La a una nota 15 cents alta', () => {
    const reading = describePitch(midiToFrequency(69 + 0.15));
    expect(reading.name).toBe('A');
    expect(reading.cents).toBeCloseTo(15, 6);
  });

  it('identifica Do central', () => {
    expect(describePitch(261.63)).toMatchObject({ midi: 60, name: 'C', octave: 4 });
  });
});

describe('nombres y clases de altura', () => {
  it('recorre las doce notas y vuelve al principio', () => {
    expect(normalizePitchClass(12)).toBe(0);
    expect(normalizePitchClass(-1)).toBe(11);
    expect(normalizePitchClass(25)).toBe(1);
  });

  it('convierte nombre y clase en las dos direcciones', () => {
    expect(pitchClassFromName('A')).toBe(9);
    expect(noteName(9)).toBe('A');
    expect(noteName(pitchClassFromName('F#'))).toBe('F#');
  });

  it('cuenta octavas en notación científica', () => {
    expect(midiToOctave(60)).toBe(4);
    expect(midiToOctave(69)).toBe(4);
    expect(midiToOctave(71)).toBe(4);
    expect(midiToOctave(72)).toBe(5);
  });
});
