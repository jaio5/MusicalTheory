import { describe, expect, it } from 'vitest';

import { describePitch, midiToFrequency } from '@core/music';

import {
  IN_TUNE_CENTS,
  meterOffset,
  nearestString,
  readingAnnouncement,
  semitonesFromString,
  STANDARD_TUNING,
  stringFrequency,
  tuningAdvice,
  tuningStatus,
} from './tuning';

describe('cuándo se da una nota por afinada', () => {
  it('acepta lo que esté dentro del margen, en los dos sentidos', () => {
    expect(tuningStatus(0)).toBe('afinada');
    expect(tuningStatus(IN_TUNE_CENTS)).toBe('afinada');
    expect(tuningStatus(-IN_TUNE_CENTS)).toBe('afinada');
  });

  it('distingue alta de baja', () => {
    expect(tuningStatus(12)).toBe('alta');
    expect(tuningStatus(-12)).toBe('baja');
  });

  it('dice qué hacer con un verbo', () => {
    expect(tuningAdvice(tuningStatus(20))).toContain('afloja');
    expect(tuningAdvice(tuningStatus(-20))).toContain('tensa');
  });
});

describe('aguja', () => {
  it('centra en cero y llega a los extremos a medio tono', () => {
    expect(meterOffset(0)).toBe(0);
    expect(meterOffset(50)).toBe(1);
    expect(meterOffset(-50)).toBe(-1);
  });

  it('no se sale de la escala', () => {
    expect(meterOffset(400)).toBe(1);
    expect(meterOffset(-400)).toBe(-1);
  });
});

describe('cuerdas al aire', () => {
  it('tiene las seis en afinación estándar', () => {
    expect(STANDARD_TUNING).toHaveLength(6);
    expect(stringFrequency(STANDARD_TUNING[0]!)).toBeCloseTo(82.41, 1);
    expect(stringFrequency(STANDARD_TUNING[5]!)).toBeCloseTo(329.63, 1);
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

describe('aviso para el lector de pantalla', () => {
  it('dice la nota y qué hacer', () => {
    const reading = describePitch(midiToFrequency(45));
    expect(readingAnnouncement(reading)).toBe('La2, está afinada.');
  });

  it('avisa cuando no se oye nada', () => {
    expect(readingAnnouncement(null)).toBe('No se oye nada.');
  });

  it('no cambia mientras la nota siga afinada, aunque se mueva algún cent', () => {
    const first = describePitch(midiToFrequency(45) * 1.001);
    const second = describePitch(midiToFrequency(45) * 1.002);

    expect(readingAnnouncement(first)).toBe(readingAnnouncement(second));
  });
});
