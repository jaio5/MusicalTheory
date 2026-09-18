import { describe, expect, it } from 'vitest';

import {
  captureProgression,
  comoBloque,
  capturedDegrees,
  triadInside,
  triadQuality,
  type CapturedChord,
} from './capture';
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
      { degree: 'I', beats: 4, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 4, confidence: 1, alternatives: [] },
      { degree: 'vi', beats: 4, confidence: 1, alternatives: [] },
      { degree: 'IV', beats: 4, confidence: 1, alternatives: [] },
    ]);
    expect(capturedDegrees(capture)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(capture.bars).toBe(4);
  });

  it('el motor repitiendo el mismo acorde no lo repite en la progresión', () => {
    const heard = [mayor(C, 0), mayor(C, 100), mayor(C, 200), mayor(G, 2 * PULSO)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 4 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 2, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 2, confidence: 1, alternatives: [] },
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
      { degree: 'I', beats: 4, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 2, confidence: 1, alternatives: [] },
    ]);
  });

  it('el acorde que se roza al cambiar no entra, y se cuenta', () => {
    // 100 ms a 120 bpm es la quinta parte de un pulso: es la mano pasando.
    const heard = [mayor(C, 0), mayor(D, 4 * PULSO), mayor(G, 4 * PULSO + 100)];

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 8 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 4, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 4, confidence: 1, alternatives: [] },
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
      { degree: 'I', beats: 1, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 1, confidence: 1, alternatives: [] },
    ]);
  });

  it('el último acorde se mide contra el final de la grabación', () => {
    const heard = [mayor(C, 0), mayor(G, 2 * PULSO)];

    expect(captureProgression(heard, { ...EN_DO, endedAt: 10 * PULSO }).steps).toEqual([
      { degree: 'I', beats: 2, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 8, confidence: 1, alternatives: [] },
    ]);
  });

  it('sin nada tocado devuelve una progresión vacía y no un error', () => {
    expect(captureProgression([], { ...EN_DO, endedAt: 1000 })).toEqual({
      steps: [],
      unread: [],
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

  it('el mismo grado dos veces seguidas suma pulsos en vez de repetirse', () => {
    // Do y Do con la cejilla en otro sitio son el mismo grado: es un cambio de
    // postura, no un acorde nuevo. Repetirlo daría «I I V» donde hay «I V», y
    // esa progresión no es la que se tocó.
    //
    // El primer colapso no lo pilla, porque entre los dos Do hay un acorde con
    // otra inversión que el motor lee distinto pero cae en el mismo grado.
    const heard = [mayor(C, 0), mayor(C, 4 * PULSO), mayor(G, 8 * PULSO)];
    // Se separan con un acorde de otro tipo para que `esElMismo` no los junte.
    heard.splice(1, 0, { ...mayor(C, 2 * PULSO), notes: [E, G, C] });

    const capture = captureProgression(heard, { ...EN_DO, endedAt: 12 * PULSO });

    expect(capture.steps).toEqual([
      { degree: 'I', beats: 8, confidence: 1, alternatives: [] },
      { degree: 'V', beats: 4, confidence: 1, alternatives: [] },
    ]);
  });
});

describe('triadInside', () => {
  // `triadQuality` exige tres notas exactas porque eso es lo que oye el croma.
  // Al escribir un cifrado es al revés: las que sobran son tensiones.
  it('encuentra la tríada dentro de una cuatríada', () => {
    expect(triadInside(9, [9, 0, 4, 7])).toBe('minor');
    expect(triadInside(0, [0, 4, 7, 11])).toBe('major');
    expect(triadInside(0, [0, 3, 6, 9])).toBe('diminished');
  });

  // No vale mirar las tres primeras notas: van ordenadas por semitono, así que
  // las tres primeras de un add9 son la fundamental, la novena y la tercera.
  it('no se deja engañar por el orden de las notas', () => {
    expect(triadInside(0, [0, 2, 4, 7])).toBe('major');
  });

  // Un 7#9 lleva dentro la tercera mayor y la menor. Es un acorde mayor con una
  // tensión, no un acorde menor, y de eso se encarga el orden del catálogo.
  it('con las dos terceras dentro, manda la mayor', () => {
    expect(triadInside(0, [0, 3, 4, 7, 10])).toBe('major');
  });

  it('lo que no tiene tercera no tiene especie', () => {
    expect(triadInside(0, [0, 7])).toBeNull();
    expect(triadInside(0, [0, 5, 7])).toBeNull();
  });
});

describe('lo que se apunta lleva su duda', () => {
  /** Un acorde oído con margen y candidatos, tal y como lo entrega el motor. */
  function conDuda(root: PitchClass, at: number, margin: number, otras: PitchClass[] = []) {
    return {
      root,
      notes: [0, 4, 7].map((i) => normalizePitchClass(root + i)),
      at,
      margin,
      alternatives: otras.map((otra) => ({
        root: otra,
        notes: [0, 3, 7].map((i) => normalizePitchClass(otra + i)),
      })),
    };
  }

  it('el margen del motor llega hasta el paso', () => {
    const capture = captureProgression([conDuda(C, 0, 0.03)], { ...EN_DO, endedAt: 2000 });
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.03);
  });

  // Los candidatos se traducen a grados de la tonalidad y se cae el elegido: al
  // corregir hay que ofrecer lo que cambia algo.
  it('las alternativas llegan como grados, sin el que ganó', () => {
    const capture = captureProgression([conDuda(C, 0, 0.02, [A])], { ...EN_DO, endedAt: 2000 });
    expect(capture.steps[0]?.alternatives).toEqual(['vi']);
  });

  /**
   * Si de los que se funden uno era dudoso, el paso entero lo es. Promediar
   * escondería la duda justo donde hay que preguntar.
   */
  it('al fundir dos iguales manda el más dudoso', () => {
    const capture = captureProgression([conDuda(C, 0, 0.5), conDuda(C, 1000, 0.02)], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.steps).toHaveLength(1);
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.02);
  });

  // Sin margen —una captura escrita a mano o de un test viejo— se da por cierta:
  // lo contrario sería marcar como dudoso todo lo que no venga del micro.
  it('lo que no trae margen se da por cierto', () => {
    const capture = captureProgression([{ root: C, notes: [0, 4, 7], at: 0 }], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.steps[0]?.confidence).toBe(1);
  });
});

describe('lo que no se pudo leer', () => {
  /**
   * Antes esto era un contador, y con un número no se puede hacer nada: ni saber
   * dónde estaba, ni preguntar qué era. Un F#m en una canción en Do es casi
   * siempre que la tonalidad detectada está mal, y eso solo se ve si se enseña.
   */
  it('un acorde de fuera de la tonalidad se apunta con su sitio y su cifrado', () => {
    const Fs = pitchClassFromName('F#');
    const capture = captureProgression(
      [
        { root: C, notes: [0, 4, 7], at: 0 },
        { root: Fs, notes: [6, 9, 1], at: 2000 },
      ],
      { ...EN_DO, endedAt: 4000 },
    );

    expect(capture.dropped).toBe(1);
    expect(capture.unread).toHaveLength(1);
    expect(capture.unread[0]).toMatchObject({ symbol: 'F#m', reason: 'fuera' });
    expect(capture.unread[0]?.at).toBeGreaterThan(0);
  });

  it('lo que no se parece a nada se apunta como ilegible', () => {
    const capture = captureProgression([{ root: C, notes: [0, 1, 2], at: 0 }], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.unread[0]).toMatchObject({ symbol: null, reason: 'ilegible' });
  });
});

/**
 * Un acorde cualquiera convertido en lo que un bloque sabe guardar.
 *
 * Es la traducción que hacían a mano tres sitios —la lista de «a dónde ir», su
 * buscador y lo que oye el micro—, y tiene **dos caminos**: con tercera el grado
 * sale de la tríada, y sin ella —un `C5`— de la fundamental
 * ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
 */
describe('un acorde, como bloque', () => {
  it('una triada es su grado, sin especie', () => {
    expect(comoBloque(0, 'major', 5, [5, 9, 0])).toEqual({ degree: 'IV' });
  });

  it('una septima trae su especie', () => {
    expect(comoBloque(0, 'major', 5, [5, 9, 0, 4])).toEqual({
      degree: 'IV',
      especie: 'major7',
    });
  });

  /**
   * Y una quinta también, que es lo que no se podía antes: sin tercera no hay
   * tríada que mirar, pero la fundamental sigue cayendo en un grado.
   */
  it('una quinta es el grado de su fundamental', () => {
    expect(comoBloque(0, 'major', 0, [0, 7])).toEqual({ degree: 'I', especie: 'quinta' });
    // Y sobre un grado menor, el grado menor: tocarlo sin tercera no lo mueve.
    expect(comoBloque(0, 'major', 2, [2, 9])).toEqual({ degree: 'ii', especie: 'quinta' });
  });

  /**
   * Y cuando dos grados se pelean la misma fundamental, gana el de la escala.
   *
   * En Do mayor, Fa es el `IV` y también el `iv` prestado; en La menor, Mi es el
   * `v` de la escala y el `V` prestado del armónico. Un `F5` no lleva tercera, así
   * que no dice cuál de los dos es: lo que no puede pasar es que salga el
   * préstamo, porque entonces la canción cuenta un color que nadie ha tocado
   * —y al cambiar de modo, un préstamo se traduce a otro sitio que el grado de la
   * escala—.
   *
   * Salía bien por el orden en que están escritas las claves de la tabla de
   * grados. Ahora está escrito.
   */
  it('una quinta sobre una fundamental repartida se lee como el grado de la escala', () => {
    expect(comoBloque(0, 'major', 5, [5, 0])).toEqual({ degree: 'IV', especie: 'quinta' });
    expect(comoBloque(9, 'minor', 4, [4, 11])).toEqual({ degree: 'v', especie: 'quinta' });
    // Y el I mayor del blues no le quita el sitio a la tónica.
    expect(comoBloque(9, 'minor', 9, [9, 4])).toEqual({ degree: 'i', especie: 'quinta' });
  });

  /**
   * Y el catálogo es más ancho de lo que parece: un `Db` en Do mayor **sí** es
   * un grado —el napolitano, `bII`— y por eso entra. Lo que no cabe es lo que no
   * tiene grado en ninguna lectura.
   */
  it('lo prestado que el catalogo conoce si cabe', () => {
    expect(comoBloque(0, 'major', 1, [1, 5, 8])).toEqual({ degree: 'bII' });
  });

  // Lo que no es ni tríada ni quinta tampoco: un sus2 cambia la tercera por la
  // segunda, y eso el montaje no sabe guardarlo.
  it('un suspendido no es un bloque, y se dice diciendo que no', () => {
    expect(comoBloque(0, 'major', 0, [0, 2, 7])).toBeNull();
  });
});
