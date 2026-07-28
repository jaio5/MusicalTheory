import { describe, expect, it } from 'vitest';

import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';

import { levelToPercent } from './LevelMeter';

describe('escala del medidor de nivel', () => {
  it('el silencio absoluto es cero', () => {
    expect(levelToPercent(0)).toBe(0);
    expect(levelToPercent(-1)).toBe(0);
  });

  it('la señal a fondo de escala llega al cien', () => {
    expect(levelToPercent(1)).toBe(100);
  });

  it('no se sale por arriba aunque la señal recorte', () => {
    expect(levelToPercent(4)).toBe(100);
  });

  it('crece en decibelios, no en lineal', () => {
    // Al doble de nivel le corresponden 6 dB, que en una escala de 60 dB son
    // diez puntos. En lineal, doblar 0,01 no se vería.
    const quiet = levelToPercent(0.01);
    const louder = levelToPercent(0.02);
    expect(louder - quiet).toBeCloseTo(10, 0);
  });

  it('deja los dos umbrales dentro de la escala y en orden', () => {
    const attack = levelToPercent(DEFAULT_PITCH_ENGINE_OPTIONS.rmsThreshold);
    const release = levelToPercent(DEFAULT_PITCH_ENGINE_OPTIONS.releaseRmsThreshold);

    expect(release).toBeGreaterThan(0);
    expect(release).toBeLessThan(attack);
    expect(attack).toBeLessThan(100);
  });
});
