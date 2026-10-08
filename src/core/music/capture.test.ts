import { describe, expect, it } from 'vitest';

import {
  captureProgression,
  comoBloque,
  RETARDO_DEL_ACORDE_MS,
  capturedDegrees,
  gradoOido,
  mismoAcordeOido,
  triadInside,
  triadQuality,
  type CapturedChord,
} from './capture';
import { blockChord, DUDOSO, writtenBlock } from './arrangement';
import { CHORD_SHAPES } from './chord-symbols';
import { esSeventhQuality } from './chords';
import { PARECIDO_MINIMO } from './chord-matching';
import { normalizePitchClass, pitchClassFromName, type PitchClass } from './notes';

const C = pitchClassFromName('C');
const Db = pitchClassFromName('Db');
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
    // Se separan con un acorde de otro tipo para que `mismoAcordeOido` no los junte.
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

  /**
   * **El fallo que se notaba tocando, y que ningún test sujetaba.**
   *
   * Una cuerda que roza o una nota que no llegó a sonar dejan un croma que solo
   * una plantilla explica: gana de calle —margen enorme— y aun así no se parece a
   * nada. Mirando solo el margen, eso se apuntaba como una certeza.
   */
  it('un acorde que gana de calle sin parecerse a nada es dudoso', () => {
    const capture = captureProgression([{ ...conDuda(C, 0, 0.9), score: PARECIDO_MINIMO + 0.01 }], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.01);
    expect(capture.steps[0]!.confidence).toBeLessThan(DUDOSO);
  });

  it('parecerse mucho no salva a un empate', () => {
    const capture = captureProgression([{ ...conDuda(C, 0, 0.01), score: 0.99 }], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.01);
  });

  it('ganar de calle y parecerse mucho no es dudoso', () => {
    const capture = captureProgression([{ ...conDuda(C, 0, 0.5), score: 0.95 }], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.steps[0]!.confidence).toBeGreaterThanOrEqual(DUDOSO);
  });

  // Al fundir repetidos manda el peor **de las dos medidas**, no solo del margen:
  // el segundo gana de calle pero se parece poco, y es el que tiene que mandar.
  it('al fundir dos iguales el mal parecido tambien manda', () => {
    const capture = captureProgression(
      [
        { ...conDuda(C, 0, 0.5), score: 0.95 },
        { ...conDuda(C, 1000, 0.9), score: PARECIDO_MINIMO + 0.01 },
      ],
      { ...EN_DO, endedAt: 2000 },
    );
    expect(capture.steps).toHaveLength(1);
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.01);
  });

  // Por debajo del suelo de parecido el motor ya no entrega nada, pero una
  // captura de otra procedencia podría traerlo: no se resta por debajo de cero.
  it('un parecido por debajo del suelo no baja de cero', () => {
    const capture = captureProgression([{ ...conDuda(C, 0, 0.9), score: 0.1 }], {
      ...EN_DO,
      endedAt: 2000,
    });
    expect(capture.steps[0]?.confidence).toBe(0);
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

  /**
   * **Lo que no se localiza por su calidad entra por su fundamental.**
   *
   * Una suspendida cambia la tercera por la segunda o la cuarta, así que no hay
   * tríada con la que buscar el grado; una disminuida o una menor sobre el I
   * tienen tríada, pero el catálogo no guarda esa calidad ahí. En los tres casos
   * la tonalidad sí sabe qué grado hay sobre esa nota, y la especie dice lo que
   * es. Es el trato que ya tenía la quinta.
   */
  it('lo que no cae por calidad cae por su fundamental', () => {
    expect(comoBloque(0, 'major', 0, [0, 2, 7])).toEqual({ degree: 'I', especie: 'sus2' });
    expect(comoBloque(0, 'major', 0, [0, 5, 7])).toEqual({ degree: 'I', especie: 'sus4' });
    expect(comoBloque(0, 'major', 0, [0, 3, 6])).toEqual({ degree: 'I', especie: 'dim' });
    expect(comoBloque(0, 'major', 0, [0, 4, 8])).toEqual({ degree: 'I', especie: 'aug' });
    // Un Do menor en Do mayor: la tríada es menor y el catálogo no tiene un
    // menor sobre el I, pero el I está ahí.
    expect(comoBloque(0, 'major', 0, [0, 3, 7])).toEqual({ degree: 'I', especie: 'menor' });
    // Y con séptima igual: un Cdim7 en Do mayor.
    expect(comoBloque(0, 'major', 0, [0, 3, 6, 9])).toEqual({
      degree: 'I',
      especie: 'diminished7',
    });
  });

  /**
   * Y un menor que **sí** tiene grado sigue entrando a secas.
   *
   * Preguntando antes por la especie, todos los menores entrarían como «el grado
   * de su fundamental con especie menor»: verdad, e inútil.
   */
  it('un menor que es grado entra sin especie', () => {
    expect(comoBloque(0, 'major', 9, [9, 0, 4])).toEqual({ degree: 'vi' });
  });

  /**
   * Lo que sigue sin entrar es la fundamental que no es ningún grado: un `F#` en
   * Do mayor. Eso no lo arregla una especie, pide un grado que no existe.
   */
  it('una fundamental que no es ningun grado sigue sin caber', () => {
    expect(comoBloque(0, 'major', 6, [6, 10, 1])).toBeNull();
  });
});

/**
 * Lo que no es una cuatríada que el bloque sepa guardar no se hace pasar por otra.
 *
 * `seventhNotes` caía a la tríada mayor en las especies que el catálogo del
 * buscador no tiene, y `seventhInside` acababa diciendo `minorMajor7` de
 * cualquier cuatro notas con la tríada mayor dentro: un `C6` o un `Cadd9` se
 * escribían **CmMaj7**, y sonaban como un `C`. Ahora un `C6` entra como su grado
 * a secas —el bloque no sabe guardar la sexta, y el buscador enseña `C` antes de
 * pulsar—, y cada cuatríada de verdad, con su especie.
 */
describe('un acorde como bloque, con su nombre o su especie', () => {
  const casos: ReadonlyArray<[string, number[], ReturnType<typeof comoBloque>, string]> = [
    ['C6', [0, 4, 7, 9], { degree: 'I' }, 'C'],
    ['Cadd9', [0, 2, 4, 7], { degree: 'I' }, 'C'],
    ['Csus2', [0, 2, 7], { degree: 'I', especie: 'sus2' }, 'Csus2'],
    ['Csus4', [0, 5, 7], { degree: 'I', especie: 'sus4' }, 'Csus4'],
    ['C5', [0, 7], { degree: 'I', especie: 'quinta' }, 'C5'],
    ['C7', [0, 4, 7, 10], { degree: 'I', especie: 'dominant7' }, 'C7'],
    ['Cmaj7', [0, 4, 7, 11], { degree: 'I', especie: 'major7' }, 'Cmaj7'],
    ['Cm7', [0, 3, 7, 10], { degree: 'I', especie: 'minor7' }, 'Cm7'],
    ['Cm7b5', [0, 3, 6, 10], { degree: 'I', especie: 'halfDiminished7' }, 'Cm7b5'],
    ['Cdim7', [0, 3, 6, 9], { degree: 'I', especie: 'diminished7' }, 'Cdim7'],
    ['CmMaj7', [0, 3, 7, 11], { degree: 'I', especie: 'minorMajor7' }, 'CmMaj7'],
  ];

  it.each(casos)('%s en Do mayor', (_escrito, notas, esperado, cifrado) => {
    const puesto = comoBloque(C, 'major', C, notas as PitchClass[]);

    expect(puesto).toEqual(esperado);
    expect(
      blockChord(C, 'major', writtenBlock('x', puesto!.degree, 4, puesto!.especie)).symbol,
    ).toBe(cifrado);
  });

  /**
   * Y lo que el fallo rompía, en todo el catálogo. **Un bloque no inventa
   * notas**: puede quedarse corto —un `C6` pierde la sexta, un `C7b9` la
   * novena—, pero lo que suena es parte de lo que se escribió. Y **una séptima
   * guardada suena entera**: el `C6` que se guardaba como `CmMaj7` sonaba un `C`,
   * así que el cifrado decía una cosa y el altavoz otra.
   */
  it('en las 24 tonalidades, el bloque suena lo que se escribio o una parte', () => {
    let puestos = 0;
    for (const modo of ['major', 'minor'] as const) {
      for (let tonica = 0; tonica < 12; tonica += 1) {
        for (let fundamental = 0; fundamental < 12; fundamental += 1) {
          for (const forma of Object.values(CHORD_SHAPES)) {
            const notas = forma.intervals.map((paso) => normalizePitchClass(fundamental + paso));
            const puesto = comoBloque(tonica as PitchClass, modo, fundamental as PitchClass, notas);
            if (puesto === null) {
              continue;
            }
            const suena = blockChord(
              tonica as PitchClass,
              modo,
              writtenBlock('x', puesto.degree, 4, puesto.especie),
            ).notes;
            const donde = `${fundamental}${forma.suffix} en ${tonica} ${modo}`;
            for (const nota of suena) {
              expect(notas, donde).toContain(nota);
            }
            if (puesto.especie !== undefined && esSeventhQuality(puesto.especie)) {
              expect(new Set(suena), donde).toEqual(new Set(notas));
            }
            puestos += 1;
          }
        }
      }
    }
    // Que haya mirado de verdad: entra mucho más de la mitad del catálogo.
    expect(puestos).toBeGreaterThan(24 * 12 * 10);
  });
});

describe('las alternativas que trae el motor', () => {
  /**
   * El croma manda alternativas con las notas que oyó, y no todas son tríadas:
   * un montón de notas sin tercera ni quinta no se puede nombrar por grado, así
   * que no se ofrece como corrección en vez de colar una invención.
   */
  it('las que no son un acorde nombrable se caen', () => {
    const conRaras: CapturedChord[] = [
      {
        ...mayor(C, 0),
        alternatives: [
          // Una tríada de verdad, que sí tiene grado en Do mayor.
          { root: A, notes: [A, C, E] },
          // Dos notas sueltas que no forman ni tríada ni cuatríada.
          { root: D, notes: [D, normalizePitchClass(D + 1)] },
        ],
      },
      mayor(G, 4 * PULSO),
    ];

    const capture = captureProgression(conRaras, { ...EN_DO, endedAt: 8 * PULSO });

    expect(capture.steps[0]?.alternatives).toEqual(['vi']);
  });

  /**
   * Y el mismo grado dos veces seguidas es un cambio de postura, no un acorde
   * nuevo: se suman los pulsos. La duda se queda con la peor de las dos, que
   * promediarla escondería justo lo que hay que preguntar.
   */
  it('el mismo grado dos veces seguidas se funde, y se queda la peor duda', () => {
    const dosVeces: CapturedChord[] = [
      { ...mayor(C, 0), margin: 0.9 },
      // Las mismas tres clases de altura, pero con una repetida: para el primer
      // colapso son dos lecturas distintas —compara cuántas notas trae—, y aun
      // así es el mismo Do. Es lo que llega cuando cambias de postura sin
      // cambiar de acorde.
      { root: C, notes: [C, E, G, E], at: 2 * PULSO, margin: 0.1 },
      mayor(G, 6 * PULSO),
    ];

    const capture = captureProgression(dosVeces, { ...EN_DO, endedAt: 10 * PULSO });

    expect(capture.steps.map((paso) => paso.degree)).toEqual(['I', 'V']);
    // Seis pulsos de Do: los dos trozos sumados, no dos pasos.
    expect(capture.steps[0]?.beats).toBe(6);
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.1);
  });
});

describe('el mismo grado a los dos lados de algo que no se leyó', () => {
  /**
   * El primer colapso solo mira el acorde oído justo antes, y aquí es un ruido
   * que no se pudo leer. El segundo mira el último paso escrito: Do, ruido, Do
   * es un Do que duró más, con un hueco apuntado para preguntar, no dos Do.
   */
  it('se funde con el paso de antes y apunta el hueco', () => {
    const conRuido: CapturedChord[] = [
      { ...mayor(C, 0), margin: 0.9 },
      { root: Db, notes: [Db, D, Eb], at: 2 * PULSO },
      { ...mayor(C, 4 * PULSO), margin: 0.2 },
      mayor(G, 8 * PULSO),
    ];

    const capture = captureProgression(conRuido, { ...EN_DO, endedAt: 12 * PULSO });

    expect(capture.steps.map((paso) => paso.degree)).toEqual(['I', 'V']);
    expect(capture.steps[0]?.confidence).toBeCloseTo(0.2);
    expect(capture.unread).toEqual([{ at: 2 * PULSO, beats: 2, symbol: null, reason: 'ilegible' }]);
  });
});

describe('una quinta sobre una fundamental de fuera', () => {
  /**
   * Una quinta se nombra por su fundamental, y el catálogo de mayor nombra once
   * de las doce: la que queda —el tritono, Fa sostenido en Do— no es ningún
   * grado, ni de la escala ni prestado. Sin grado no hay bloque: meterlo con uno
   * inventado lo enseñaría, lo ensayaría y lo dibujaría mal.
   */
  it('la del tritono no se convierte en bloque, y las once que si', () => {
    const conGrado: number[] = [];
    for (let root = 0; root < 12; root += 1) {
      const quinta = comoBloque(C, 'major', root as PitchClass, [
        root as PitchClass,
        normalizePitchClass(root + 7),
      ]);
      if (quinta !== null) {
        expect(quinta.especie, `la quinta sobre ${root}`).toBe('quinta');
        conGrado.push(root);
      }
    }

    expect(conGrado).toHaveLength(11);
    expect(conGrado).not.toContain(Fs);
  });
});

/**
 * **Contra la rejilla de la toma.** Con el compás uno de la cuenta, cada cambio
 * se cuadra en su pulso, descontado lo que tarda el motor en decirlo.
 */
describe('la progresion en la rejilla de la toma', () => {
  // Sin retardo, para leer las cuentas; el de verdad tiene su test.
  const REJILLA = {
    tonic: C,
    mode: 'major' as const,
    bpm: BPM,
    beatsPerBar: 4,
    startedAt: 10_000,
    retardoMs: 0,
  };
  const en = (pulso: number) => 10_000 + pulso * PULSO;
  const resumen = (steps: readonly { degree: string; beats: number }[]) =>
    steps.map((step) => `${step.degree}/${step.beats}`);

  it('cada cambio cae en su pulso aunque se oiga un poco tarde o pronto', () => {
    const { steps } = captureProgression(
      [mayor(C, en(0.3)), mayor(F, en(4.2)), mayor(G, en(5.9)), mayor(C, en(8.1))],
      { ...REJILLA, endedAt: en(14), sonoHasta: en(11.8) },
    );
    // El cambio a mitad de compás —el Sol en el pulso 6— se queda donde estaba.
    expect(resumen(steps)).toEqual(['I/4', 'IV/2', 'V/2', 'I/4']);
  });

  it('el retardo del motor se descuenta, y por defecto es el medido', () => {
    expect(RETARDO_DEL_ACORDE_MS).toBe(520);
    const tarde = (pulso: number) => en(pulso) + RETARDO_DEL_ACORDE_MS;
    const { steps } = captureProgression([mayor(C, tarde(0)), mayor(G, tarde(2))], {
      ...REJILLA,
      retardoMs: undefined,
      // Parar es pulsar un botón: eso no lleva el retardo del motor.
      endedAt: en(4),
    });
    expect(resumen(steps)).toEqual(['I/2', 'V/2']);
  });

  it('lo que suena antes del primero se lo queda el, hasta su compas', () => {
    // Entra en el segundo pulso del compás dos: el primer compás vacío no se
    // escribe, y el bloque empieza en el uno del suyo.
    const { steps } = captureProgression([mayor(C, en(5)), mayor(G, en(8))], {
      ...REJILLA,
      endedAt: en(12),
    });
    expect(resumen(steps)).toEqual(['I/4', 'V/4']);
  });

  it('lo que no se lee no se lleva su tiempo: se lo queda el de antes', () => {
    const { steps, dropped } = captureProgression(
      [mayor(C, en(0)), mayor(Fs, en(4)), mayor(G, en(8))],
      { ...REJILLA, endedAt: en(12) },
    );
    expect(dropped).toBe(1);
    expect(resumen(steps)).toEqual(['I/8', 'V/4']);
  });

  it('y si era el primero, el de despues', () => {
    const { steps } = captureProgression([mayor(Fs, en(0)), mayor(G, en(4))], {
      ...REJILLA,
      endedAt: en(8),
    });
    expect(resumen(steps)).toEqual(['V/8']);
  });

  it('un acorde de paso que dura menos de medio pulso se salta', () => {
    const { steps, skipped } = captureProgression(
      [mayor(C, en(0)), mayor(E, en(3.9)), mayor(F, en(4.1))],
      { ...REJILLA, endedAt: en(8) },
    );
    expect(skipped).toBe(1);
    expect(resumen(steps)).toEqual(['I/4', 'IV/4']);
  });

  it('dos cambios en el mismo pulso: vale el segundo', () => {
    const { steps, skipped } = captureProgression(
      [mayor(C, en(0)), mayor(F, en(3.6)), mayor(G, en(4.2))],
      { ...REJILLA, minBeats: 0.1, endedAt: en(8) },
    );
    expect(skipped).toBe(1);
    expect(resumen(steps)).toEqual(['I/4', 'V/4']);
  });

  it('el ultimo acaba cuando dejo de sonar, redondeado hacia arriba', () => {
    const { steps } = captureProgression([mayor(C, en(0))], {
      ...REJILLA,
      endedAt: en(7),
      sonoHasta: en(3.4),
    });
    expect(resumen(steps)).toEqual(['I/4']);
  });

  it('un acorde de toda la toma sale en bloques de cuatro compases', () => {
    const { steps } = captureProgression([mayor(C, en(0))], { ...REJILLA, endedAt: en(40) });
    expect(resumen(steps)).toEqual(['I/16', 'I/16', 'I/8']);
  });

  it('sin tope, devuelve todos los pasos', () => {
    const muchos = Array.from({ length: 40 }, (_, i) => mayor(i % 2 === 0 ? C : G, en(i * 2)));
    expect(
      captureProgression(muchos, { ...REJILLA, endedAt: en(80), tope: Infinity }).steps,
    ).toHaveLength(40);
    expect(captureProgression(muchos, { ...REJILLA, endedAt: en(80) }).steps).toHaveLength(32);
  });

  it('sin acordes, nada', () => {
    expect(captureProgression([], { ...REJILLA, endedAt: en(4) }).steps).toEqual([]);
  });

  it('sin compas dicho, el de cuatro', () => {
    const { steps } = captureProgression([mayor(C, en(5)), mayor(G, en(8))], {
      ...REJILLA,
      beatsPerBar: undefined,
      endedAt: en(12),
    });
    expect(resumen(steps)).toEqual(['I/4', 'V/4']);
  });

  /**
   * **Los bordes de la rejilla, con la cuenta hecha a mano.** Cada fila cambia un
   * solo número respecto a la de al lado, y es el número en que un redondeo o una
   * comparación mal puestos cambian lo que se escribe: los tests de arriba cuentan
   * la idea, y estos la clavan.
   */
  it.each([
    // Se entra a destiempo: el primero cae en el uno de su compás.
    [
      'entra en el pulso 2,6 y se escribe desde el uno',
      [
        [C, 2.6],
        [G, 8],
      ],
      {},
      ['I/8', 'V/4'],
    ],
    // Se entra antes de darle a grabar: el pulso -0,7 no resta, cuenta desde cero.
    [
      'entra antes de grabar y no se come un compás',
      [
        [C, -0.7],
        [G, 4],
      ],
      {},
      ['I/4', 'V/8'],
    ],
    // Un compás de cero pulsos se lee como de uno, sin dividir entre cero.
    [
      'con un compás de cero, uno',
      [
        [C, 5],
        [G, 8],
      ],
      { beatsPerBar: 0 },
      ['I/3', 'V/4'],
    ],
    // Medio pulso justo es lo mínimo que cuenta: entra, y no se salta.
    [
      'un acorde de paso de medio pulso justo cuenta',
      [
        [C, 0],
        [F, 4],
        [G, 4.5],
      ],
      {},
      ['I/4', 'IV/1', 'V/7'],
    ],
    // Y uno de 0,4 se salta: su tiempo es del de antes.
    [
      'uno de 0,4 pulsos se salta',
      [
        [C, 0],
        [F, 4],
        [G, 4.4],
      ],
      {},
      ['I/4', 'V/8'],
    ],
  ] as const)('%s', (_, tocado, opciones, esperado) => {
    const { steps } = captureProgression(
      tocado.map(([raiz, pulso]) => mayor(raiz, en(pulso))),
      { ...REJILLA, endedAt: en(12), sonoHasta: en(12), ...opciones },
    );
    expect(resumen(steps)).toEqual(esperado);
  });

  /**
   * El final se redondea hacia arriba con un cuarto de pulso de holgura: lo que
   * deja de sonar en el 3,2 es un tercer pulso que se apagaba, y en el 3,3, un
   * cuarto.
   */
  it.each([
    [3.2, 'I/3'],
    [3.25, 'I/3'],
    [3.3, 'I/4'],
    [3.8, 'I/4'],
  ])('lo que deja de sonar en el pulso %s se escribe %s', (hasta, esperado) => {
    const { steps } = captureProgression([mayor(C, en(0))], {
      ...REJILLA,
      endedAt: en(8),
      sonoHasta: en(hasta),
    });
    expect(resumen(steps)).toEqual([esperado]);
  });

  it('el último dura al menos un pulso aunque deje de sonar antes de su frontera', () => {
    // El Sol entra en el 4,6 —su frontera es el 5— y deja de sonar en el 5,1.
    const { steps } = captureProgression([mayor(C, en(0)), mayor(G, en(4.6))], {
      ...REJILLA,
      endedAt: en(8),
      sonoHasta: en(5.1),
    });
    expect(resumen(steps)).toEqual(['I/5', 'V/1']);
  });
});

/**
 * **Una séptima oída se escribe como su tríada.** Con una guitarra el croma ve
 * cuatro notas casi siempre: el quinto armónico de la quinta es la séptima mayor.
 */
describe('las cuatriadas que pone la guitarra', () => {
  it('un Cmaj7 oido es el I, y un C7 seguido de un Cmaj7 es el mismo acorde', () => {
    const { steps } = captureProgression(
      [
        { root: C, notes: [C, E, G, B], at: 0 },
        { root: C, notes: [C, E, G, Bb], at: 2 * PULSO },
        { root: A, notes: [A, C, E, G], at: 4 * PULSO },
      ],
      { tonic: C, mode: 'major', bpm: BPM, endedAt: 8 * PULSO },
    );
    expect(steps.map((step) => `${step.degree}/${step.beats}`)).toEqual(['I/4', 'vi/4']);
  });

  it('sin tercera no hay tríada: se comparan las notas', () => {
    const quinta = { root: C, notes: [C, G], at: 0 };
    const { steps, dropped } = captureProgression(
      [quinta, { ...quinta, at: PULSO }, { root: C, notes: [C, D, G], at: 2 * PULSO }],
      { tonic: C, mode: 'major', bpm: BPM, endedAt: 4 * PULSO },
    );
    expect(steps).toEqual([]);
    expect(dropped).toBe(2);
  });
});

/**
 * Lo que se enseña en directo tiene que ser lo que se escribirá: la misma
 * lectura que `captureProgression`, y no la de `comoBloque`, que conserva la
 * séptima que el croma ve en casi cualquier rasgueo.
 */
describe('el grado oído', () => {
  const C = 0 as PitchClass;
  const notas = (...pcs: number[]) => pcs as PitchClass[];

  it('una séptima oída es el grado de su tríada, como al escribirla', () => {
    // G7 y Cmaj7: lo que el croma lee de un G y un C rasgueados.
    expect(gradoOido(C, 'major', 7 as PitchClass, notas(7, 11, 2, 5))).toBe('V');
    expect(gradoOido(C, 'major', C, notas(0, 4, 7, 11))).toBe('I');
    expect(gradoOido(C, 'major', 9 as PitchClass, notas(9, 0, 4))).toBe('vi');
  });

  it('coincide con lo que escribe la toma', () => {
    const oido = { root: 7 as PitchClass, notes: notas(7, 11, 2, 5), at: 0 };
    const escrito = captureProgression([oido], {
      tonic: C,
      mode: 'major',
      bpm: 100,
      endedAt: 2400,
    });
    expect(capturedDegrees(escrito)).toEqual([gradoOido(C, 'major', oido.root, oido.notes)]);
  });

  it('lo que no tiene tríada, o no cabe en la tonalidad, no se escribe', () => {
    expect(gradoOido(C, 'major', C, notas(0, 7))).toBeNull();
    // Un Fa sostenido mayor no es de Do mayor.
    expect(gradoOido(C, 'major', 6 as PitchClass, notas(6, 10, 1))).toBeNull();
  });
});

describe('el mismo acorde oído', () => {
  const oido = (root: number, ...notes: number[]): CapturedChord => ({
    root: root as PitchClass,
    notes: notes as PitchClass[],
    at: 0,
  });

  it('C y Cmaj7 son el mismo; C y Am no', () => {
    expect(mismoAcordeOido(oido(0, 0, 4, 7), oido(0, 0, 4, 7, 11))).toBe(true);
    expect(mismoAcordeOido(oido(0, 0, 4, 7), oido(9, 9, 0, 4))).toBe(false);
  });
});
