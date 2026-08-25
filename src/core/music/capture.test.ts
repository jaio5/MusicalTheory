import { describe, expect, it } from 'vitest';

import { captureProgression, capturedDegrees, triadQuality, type CapturedChord } from './capture';
import { normalizePitchClass, pitchClassFromName, type PitchClass } from './notes';

const C = pitchClassFromName('C');
const D = pitchClassFromName('D');
const Eb = pitchClassFromName('Eb');
const E = pitchClassFromName('E');
const F = pitchClassFromName('F');
const Fs = pitchClassFromName('F#');
const G = pitchClassFromName('G');
const Gs = pitchClassFromName('G#');
const A = pitchClassFromName('A');
const Bb = pitchClassFromName('Bb');
const B = pitchClassFromName('B');

/** A 120 bpm un pulso son 500 ms, que es la cuenta fácil de leer aquí. */
const BPM = 120;
const PULSO = 500;

/** La tríada de esa especie sobre esa fundamental, como la devuelve el croma. */
function triada(root: PitchClass, terceraMenor: boolean, at: number): CapturedChord {
  return {
    root,
    notes: [0, terceraMenor ? 3 : 4, 7].map((interval) => normalizePitchClass(root + interval)),
    at,
  };
}

const mayor = (root: PitchClass, at: number) => triada(root, false, at);
const menor = (root: PitchClass, at: number) => triada(root, true, at);

const EN_DO = { tonic: C, mode: 'major' as const, bpm: BPM };

describe('triadQuality', () => {
  it('reconoce las cuatro especies sin que importe el orden', () => {
    expect(triadQuality(C, [E, G, C])).toBe('major');
    expect(triadQuality(C, [C, Eb, G])).toBe('minor');
    expect(triadQuality(C, [C, Eb, Fs])).toBe('diminished');
    expect(triadQuality(C, [C, E, Gs])).toBe('augmented');
  });

  it('una cuatríada devuelve nulo en vez de fingir una tríada', () => {
    // Adivinar la tríada de dentro sería tirar la séptima, que es la nota que
    // más define el acorde.
    expect(triadQuality(C, [C, E, G, Bb])).toBeNull();
  });

  it('dos notas no son un acorde', () => {
    expect(triadQuality(C, [C, G])).toBeNull();
  });
});

describe('captureProgression', () => {
  it('convierte lo tocado en grados con sus pulsos', () => {
    const heard = [mayor(C, 0), mayor(G, 4 * PULSO), menor(A, 8 * PULSO), mayor(F, 12 * PULSO)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 16 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 4 },
      { degree: 'V', beats: 4 },
      { degree: 'vi', beats: 4 },
      { degree: 'IV', beats: 4 },
    ]);
    expect(capturedDegrees(capture)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(capture.bars).toBe(4);
  });

  it('el motor repitiendo el mismo acorde no lo repite en la progresión', () => {
    const heard = [mayor(C, 0), mayor(C, 100), mayor(C, 200), mayor(G, 2 * PULSO)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 4 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 2 },
      { degree: 'V', beats: 2 },
    ]);
  });

  it('cambiar de postura sin cambiar de acorde suma pulsos en vez de repetir', () => {
    // C al aire y C en cejilla llevan las mismas notas en otro orden: el croma
    // los lee como dos acordes y el catálogo dice que son el mismo grado.
    const heard: CapturedChord[] = [
      { root: C, notes: [C, E, G], at: 0 },
      { root: C, notes: [G, C, E], at: 2 * PULSO },
      { root: G, notes: [G, B, D], at: 4 * PULSO },
    ];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 6 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 4 },
      { degree: 'V', beats: 2 },
    ]);
  });

  it('el acorde que se roza al cambiar no entra, y se cuenta', () => {
    // 100 ms a 120 bpm es la quinta parte de un pulso: es la mano pasando.
    const heard = [mayor(C, 0), mayor(D, 4 * PULSO), mayor(G, 4 * PULSO + 100)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 8 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 4 },
      { degree: 'V', beats: 4 },
    ]);
    expect(capture.skipped).toBe(1);
  });

  it('lo que no cabe en la tonalidad se cuenta en vez de colarse', () => {
    // F# mayor no es ningún grado de Do mayor ni de sus prestados.
    const heard = [mayor(C, 0), mayor(Fs, 4 * PULSO), mayor(G, 8 * PULSO)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 12 * PULSO });

    expect(capturedDegrees(capture)).toEqual(['I', 'V']);
    expect(capture.dropped).toBe(1);
  });

  it('un acorde que dura menos de un pulso pero pasa el filtro cuenta como uno', () => {
    // Redondear a cero dejaría un grado sin duración, que no se puede tocar.
    const heard = [mayor(C, 0), mayor(G, 300)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 600 });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 1 },
      { degree: 'V', beats: 1 },
    ]);
  });

  it('el último acorde se mide contra el final de la grabación', () => {
    const heard = [mayor(C, 0), mayor(G, 2 * PULSO)];

    expect(captureProgression(heard, { ...EN_DO, endedAt: 10 * PULSO }).steps).toEqual([
      { degree: 'I', beats: 2 },
      { degree: 'V', beats: 8 },
    ]);
  });

  it('sin nada tocado devuelve una progresión vacía y no un error', () => {
    expect(captureProgression([], { ...EN_DO, endedAt: 1000 })).toEqual({
      steps: [],
      dropped: 0,
      skipped: 0,
      bars: 0,
    });
  });

  it('los compases salen del compás elegido, no de cuatro por cuatro siempre', () => {
    const heard = [mayor(C, 0), mayor(G, 3 * PULSO)];
    const capture = captureProgression(heard, {
      ...EN_DO,
      endedAt: 6 * PULSO,
      beatsPerBar: 3,
    });

    expect(capture.bars).toBe(2);
  });

  it('en menor, los mismos acordes dan otros grados', () => {
    const heard = [menor(A, 0), mayor(F, 4 * PULSO), mayor(C, 8 * PULSO)];

    const capture = captureProgression(heard, {
      tonic: A,
      mode: 'minor',
      bpm: BPM,
      endedAt: 12 * PULSO,
    });

    expect(capturedDegrees(capture)).toEqual(['i', 'VI', 'III']);
  });
});
