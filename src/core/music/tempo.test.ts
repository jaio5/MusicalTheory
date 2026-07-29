import { describe, expect, it } from 'vitest';

import { bpmFromTaps, clampBpm, DEFAULT_BPM, MAX_BPM, MIN_BPM, msPerBeat } from './tempo';

describe('Tempo', () => {
  it('un pulso a 120 dura medio segundo', () => {
    expect(msPerBeat(120)).toBe(500);
    expect(msPerBeat(60)).toBe(1000);
  });

  it('no deja salirse de lo que se puede seguir', () => {
    expect(clampBpm(5)).toBe(MIN_BPM);
    expect(clampBpm(9000)).toBe(MAX_BPM);
    expect(clampBpm(120.4)).toBe(120);
  });

  it('con basura se queda en el tempo de fábrica', () => {
    expect(clampBpm(Number.NaN)).toBe(DEFAULT_BPM);
    expect(clampBpm(Number.POSITIVE_INFINITY)).toBe(DEFAULT_BPM);
  });
});

describe('Marcar el tempo con el dedo', () => {
  it('saca el tempo de los huecos entre golpes', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
  });

  it('promedia, así que un golpe torcido no lo tira todo', () => {
    expect(bpmFromTaps([0, 500, 1040, 1500])).toBe(120);
  });

  it('con menos de tres golpes no se moja', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([0])).toBeNull();
    expect(bpmFromTaps([0, 500])).toBeNull();
  });

  it('un silencio largo empieza la cuenta de nuevo', () => {
    // Los tres primeros iban a 60; después de parar, la racha nueva va a 120.
    expect(bpmFromTaps([0, 1000, 2000, 9000, 9500, 10_000, 10_500])).toBe(120);
  });

  it('no devuelve un tempo imposible por marcar a lo loco', () => {
    expect(bpmFromTaps([0, 10, 20, 30])).toBe(MAX_BPM);
  });
});
