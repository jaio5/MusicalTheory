import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from './notes';
import {
  PLAYBACK_BASE_MIDI,
  progressionDurationMs,
  scheduleProgression,
  voiceForPlayback,
  type PlaybackStep,
} from './playback';
import { triadNotes } from './chords';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');
const G = pitchClassFromName('G');

describe('voiceForPlayback', () => {
  it('apila las notas subiendo desde la fundamental', () => {
    // Do mayor en la octava base: C3 E3 G3.
    expect(voiceForPlayback(C, triadNotes(C, 'major'))).toEqual([48, 52, 55]);
  });

  it('la fundamental va abajo aunque llegue en otro orden', () => {
    // El croma devuelve las notas en el orden del vector, no en el de la
    // partitura: sin ordenar desde la raíz, un La menor sonaría como un Do con
    // una nota rara.
    const desordenado = [C, pitchClassFromName('E'), A];

    expect(voiceForPlayback(A, desordenado)).toEqual([57, 60, 64]);
  });

  it('sube las que se quedarían debajo, para que suene a acorde', () => {
    // Sol mayor: G B D. La D está por debajo de la G en clase de altura, así
    // que sube una octava.
    expect(voiceForPlayback(G, triadNotes(G, 'major'))).toEqual([55, 59, 62]);
  });

  it('no repite una nota que venga dos veces', () => {
    expect(voiceForPlayback(C, [C, C, pitchClassFromName('E')])).toEqual([48, 52]);
  });

  it('un acorde sin notas no suena, y no revienta', () => {
    expect(voiceForPlayback(C, [])).toEqual([]);
  });

  it('se puede bajar o subir de octava entera', () => {
    const grave = voiceForPlayback(C, triadNotes(C, 'major'), PLAYBACK_BASE_MIDI - 12);

    expect(grave).toEqual([36, 40, 43]);
  });
});

describe('scheduleProgression', () => {
  /** A 120 bpm un pulso son 500 ms. */
  const BPM = 120;

  function paso(root: number, beats: number): PlaybackStep {
    return {
      root: root as PlaybackStep['root'],
      notes: triadNotes(root as PlaybackStep['root'], 'major'),
      beats,
    };
  }

  it('cada acorde empieza cuando termina el anterior', () => {
    const pasos = scheduleProgression([paso(C, 4), paso(G, 2), paso(C, 4)], BPM);

    expect(pasos.map((p) => [p.startMs, p.durationMs])).toEqual([
      [0, 2000],
      [2000, 1000],
      [3000, 2000],
    ]);
  });

  it('un acorde de cero pulsos dura uno: si no, se saltaría un compás callando', () => {
    const pasos = scheduleProgression([paso(C, 0)], BPM);

    expect(pasos[0]?.durationMs).toBe(500);
  });

  it('trae las alturas ya colocadas', () => {
    const pasos = scheduleProgression([paso(C, 4)], BPM);

    expect(pasos[0]?.midis).toEqual([48, 52, 55]);
  });

  it('el tempo imposible se acerca al rango en vez de partir la cuenta', () => {
    const pasos = scheduleProgression([paso(C, 1)], 0);

    expect(pasos[0]?.durationMs).toBeGreaterThan(0);
    expect(Number.isFinite(pasos[0]?.durationMs)).toBe(true);
  });

  it('una progresión vacía no dura nada', () => {
    expect(progressionDurationMs(scheduleProgression([], BPM))).toBe(0);
  });

  it('la duración total es la suma de lo que dura cada acorde', () => {
    const pasos = scheduleProgression([paso(C, 4), paso(G, 4)], BPM);

    expect(progressionDurationMs(pasos)).toBe(4000);
  });
});
