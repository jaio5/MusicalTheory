import { describe, expect, it } from 'vitest';

import { describePitch, midiToFrequency } from '@core/music';

import {
  IN_TUNE_CENTS,
  meterOffset,
  readingAnnouncement,
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

describe('aviso para el lector de pantalla', () => {
  it('dice la nota y qué hacer', () => {
    const reading = describePitch(midiToFrequency(45));
    expect(readingAnnouncement(reading)).toBe('A2, está afinada.');
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
