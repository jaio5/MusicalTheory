import { beforeEach, describe, expect, it } from 'vitest';

import {
  EMPTY_ARRANGEMENT,
  MAX_PARTS,
  partBeats,
  partLength,
  pitchClassFromName,
  type FotogramaDeTono,
  type Capture,
  type MelodyCapture,
} from '@core/music';

import { apuntarLoTocado, avisoDeLaCaptura } from './apuntar-lo-tocado';
import { useArrangementStore } from './arrangement-store';
import { useSessionStore } from './session-store';

/**
 * Lo que se cuenta al traer una grabación.
 *
 * **Lo que no se pudo leer importa más que lo que sí.** Un compás que se cayó es
 * un agujero que nadie nota mirando el lienzo, porque lo que falta no se ve; y
 * cuando se caen varios acordes con la misma pinta casi siempre significa lo
 * mismo: la tonalidad detectada no era la que se estaba tocando.
 *
 * Se prueba la frase y no el camino entero porque la frase **es** lo que hace
 * falta: cada caso tiene su singular y su plural, y un «1 acordes» delata que
 * nadie la ha leído.
 */

const SIN_NADA: Capture = { steps: [], unread: [], dropped: 0, skipped: 0, bars: 0 };
const SIN_PUNTEO: MelodyCapture = { notes: [], skipped: 0, outOfRange: 0 };

function paso(confidence: number) {
  return { degree: 'I' as const, beats: 4, confidence, alternatives: [] };
}

function nota(offset: number) {
  return { id: `p${offset}`, offset, start: 0, length: 1 };
}

describe('el aviso de una grabación traída', () => {
  it('sin nada que contar, no dice nada', () => {
    expect(avisoDeLaCaptura(SIN_NADA, SIN_PUNTEO, 'Do mayor')).toBeNull();
  });

  it('cuenta las notas de punteo, en singular y en plural', () => {
    expect(avisoDeLaCaptura(SIN_NADA, { ...SIN_PUNTEO, notes: [nota(0)] }, 'Do mayor')).toBe(
      'He apuntado 1 nota de punteo.',
    );
    expect(
      avisoDeLaCaptura(SIN_NADA, { ...SIN_PUNTEO, notes: [nota(0), nota(2)] }, 'Do mayor'),
    ).toBe('He apuntado 2 notas de punteo.');
  });

  /**
   * Los que se oyeron bien y no son de la tonalidad se dicen **con su cifrado**:
   * ver «Fa sostenido menor» en una canción en Do es lo que hace caer en que la
   * tonalidad estaba mal detectada.
   */
  it('los que no caben en la tonalidad salen con su cifrado', () => {
    const uno = avisoDeLaCaptura(
      { ...SIN_NADA, unread: [{ at: 0, beats: 4, symbol: 'F#m', reason: 'fuera' }] },
      SIN_PUNTEO,
      'Do mayor',
    );
    expect(uno).toContain('Un acorde no cabe en Do mayor: F#m.');
    expect(uno).toContain('lo tocaste');

    const dos = avisoDeLaCaptura(
      {
        ...SIN_NADA,
        unread: [
          { at: 0, beats: 4, symbol: 'F#m', reason: 'fuera' },
          { at: 4, beats: 4, symbol: 'C#', reason: 'fuera' },
        ],
      },
      SIN_PUNTEO,
      'Do mayor',
    );
    expect(dos).toContain('2 acordes no caben en Do mayor: F#m, C#.');
    expect(dos).toContain('los tocaste');
  });

  // Y lo que no se pareció a nada se cuenta aparte: no hay cifrado que enseñar.
  it('lo ilegible se cuenta sin cifrado', () => {
    const uno = avisoDeLaCaptura(
      { ...SIN_NADA, unread: [{ at: 0, beats: 2, symbol: null, reason: 'ilegible' }] },
      SIN_PUNTEO,
      'Do mayor',
    );
    expect(uno).toBe('Hubo un momento que no se parecía a ningún acorde y se ha quedado fuera.');

    const dos = avisoDeLaCaptura(
      {
        ...SIN_NADA,
        unread: [
          { at: 0, beats: 2, symbol: null, reason: 'ilegible' },
          { at: 2, beats: 2, symbol: null, reason: 'ilegible' },
        ],
      },
      SIN_PUNTEO,
      'Do mayor',
    );
    expect(dos).toContain('Hubo 2 momentos');
  });

  // Un tramo «fuera» pero sin cifrado que enseñar no se anuncia como acorde.
  it('lo de fuera sin cifrado no se dice con cifrado', () => {
    const aviso = avisoDeLaCaptura(
      { ...SIN_NADA, unread: [{ at: 0, beats: 4, symbol: null, reason: 'fuera' }] },
      SIN_PUNTEO,
      'Do mayor',
    );

    expect(aviso).toBeNull();
  });

  it('las notas que no caben en el pentagrama se dicen', () => {
    expect(avisoDeLaCaptura(SIN_NADA, { ...SIN_PUNTEO, outOfRange: 1 }, 'Do mayor')).toContain(
      'Una nota se salía',
    );
    expect(avisoDeLaCaptura(SIN_NADA, { ...SIN_PUNTEO, outOfRange: 3 }, 'Do mayor')).toContain(
      '3 notas se salían',
    );
  });

  /**
   * Y lo dudoso, aparte y sin alarmar: esos sí están en el lienzo, marcados con
   * «?» y con su corrección a un toque.
   */
  it('los dudosos se cuentan aparte', () => {
    expect(
      avisoDeLaCaptura({ ...SIN_NADA, steps: [paso(0.05)] }, SIN_PUNTEO, 'Do mayor'),
    ).toContain('Hay 1 acorde de los que no estoy seguro');
    expect(
      avisoDeLaCaptura({ ...SIN_NADA, steps: [paso(0.05), paso(0.02)] }, SIN_PUNTEO, 'Do mayor'),
    ).toContain('Hay 2 acordes');
    // Y uno bien leído no se cuenta.
    expect(avisoDeLaCaptura({ ...SIN_NADA, steps: [paso(1)] }, SIN_PUNTEO, 'Do mayor')).toBeNull();
  });
});

/**
 * **Una toma escribe solo lo suyo.**
 *
 * Los dos motores corren a la vez sobre la misma entrada, así que una toma daba
 * acordes y notas siempre, y nadie le decía nunca a la aplicación cuál de las
 * dos era: un punteo salía escrito como acordes. No es que el croma falle, es
 * que se le estaba preguntando por algo que no era — después del descuento de
 * armónicos, un Do rasgueado y un Do pulsado a solas tienen casi la misma forma.
 */
describe('el papel de la toma', () => {
  /** La misma grabación: acordes en el croma y notas en el motor de tono. */
  function conLasDosCosas(): void {
    useSessionStore.setState({
      captured: [
        { root: pitchClassFromName('C'), notes: [0, 4, 7], at: 0 },
        { root: pitchClassFromName('G'), notes: [7, 11, 2], at: 2000 },
      ],
      noteHistory: [
        { pitchClass: pitchClassFromName('C'), midi: 60, at: 0, clarity: 0.99 },
        { pitchClass: pitchClassFromName('E'), midi: 64, at: 500, clarity: 0.99 },
      ],
      captureStartedAt: 0,
      captureEndedAt: 4000,
    });
  }

  const EN_DO = {
    tonic: pitchClassFromName('C'),
    mode: 'major' as const,
    bpm: 120,
    beatsPerBar: 4,
  };

  function laParte(partId: string | null) {
    return useArrangementStore.getState().arrangement.parts.find((parte) => parte.id === partId);
  }

  beforeEach(() => {
    useSessionStore.getState().actions.reset();
    useArrangementStore.getState().actions.replace(EMPTY_ARRANGEMENT);
  });

  it('la ritmica escribe acordes y ni una nota', () => {
    conLasDosCosas();

    const { partId } = apuntarLoTocado({ ...EN_DO, papel: 'ritmica' });

    expect(laParte(partId)?.blocks.length).toBeGreaterThan(0);
    expect(laParte(partId)?.notes).toEqual([]);
  });

  it('el punteo escribe notas y ni un acorde', () => {
    conLasDosCosas();

    const { partId } = apuntarLoTocado({ ...EN_DO, papel: 'punteo' });

    expect(laParte(partId)?.notes.length).toBeGreaterThan(0);
    expect(laParte(partId)?.blocks).toEqual([]);
  });

  // Y lo que se dice al no leer nada va en los términos del papel: «ni un acorde
  // ni una nota» después de grabar un punteo suena a que se esperaban acordes.
  it('si no se lee nada, lo dice en los terminos de lo que se tocaba', () => {
    expect(apuntarLoTocado({ ...EN_DO, papel: 'punteo' }).aviso).toBe(
      'No he podido leer ni una nota de lo que has tocado.',
    );
    expect(apuntarLoTocado({ ...EN_DO, papel: 'ritmica' }).aviso).toBe(
      'No he podido leer ni un acorde de lo que has tocado.',
    );
  });
});

/**
 * **Con la toma delante.** «Tocando» trae lo que oyó —cada análisis y su compás
 * uno— y con eso se transcribe la toma entera, contra su rejilla, y repartida en
 * las partes que hagan falta: una toma no tiene tope y una parte sí.
 */
describe('lo que trae la toma', () => {
  const EN_DO = {
    tonic: pitchClassFromName('C'),
    mode: 'major' as const,
    // A 60, un pulso es un segundo.
    bpm: 60,
    beatsPerBar: 4,
  };
  const partes = () => useArrangementStore.getState().arrangement.parts;

  /** Notas de una negra cada una, alternando Do y Re, a partir del compás uno. */
  function negras(cuantas: number): FotogramaDeTono[] {
    const fotogramas: FotogramaDeTono[] = [];
    for (let nota = 0; nota < cuantas; nota += 1) {
      for (let k = 0; k < 4; k += 1) {
        fotogramas.push({
          at: 1000 + 40 + nota * 1000 + k * 200,
          midi: nota % 2 === 0 ? 60 : 62,
          clarity: 0.98,
          rms: 0.1 - k * 0.02,
        });
      }
    }
    return fotogramas;
  }

  beforeEach(() => {
    useSessionStore.getState().actions.reset();
    useArrangementStore.getState().actions.replace(EMPTY_ARRANGEMENT);
  });

  it('el punteo sale de cada analisis, y no del historial', () => {
    const { partId } = apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: negras(30), empiezaEn: 1000, acabaEn: 40_000 },
    });

    const parte = partes().find((una) => una.id === partId)!;
    expect(parte.notes).toHaveLength(30);
    expect(parte.notes.at(-1)!.start).toBe(29);
  });

  it('una toma larga entra en varias partes, cada una desde su compas', () => {
    const { partId, aviso } = apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: negras(150), empiezaEn: 1000, acabaEn: 200_000 },
    });

    expect(partes().map((parte) => parte.notes.length)).toEqual([64, 64, 22]);
    expect(partes().map((parte) => parte.name)).toEqual([
      'Lo que has tocado (1)',
      'Lo que has tocado (2)',
      'Lo que has tocado (3)',
    ]);
    // La segunda empieza en la barra del compás diecisiete: su primera nota, en el uno.
    expect(partes()[1]!.notes[0]!.start).toBe(0);
    expect(partId).toBe(partes()[0]!.id);
    expect(aviso).toContain('ha entrado en 3 partes seguidas');
  });

  /**
   * **Las partes encajan una detrás de otra**, que es como se tocan: la siguiente
   * empieza donde acaba la anterior. Reproducida, cada nota suena en el pulso en
   * que se tocó.
   */
  function donde(): number[] {
    let desde = 0;
    const pulsos: number[] = [];
    for (const parte of partes()) {
      pulsos.push(...parte.notes.map((nota) => desde + nota.start));
      desde += partLength(parte);
    }
    return pulsos;
  }

  it('setenta notas reproducidas caen cada una en su pulso, y se corta en barra', () => {
    apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: negras(70), empiezaEn: 1000, acabaEn: 80_000 },
    });

    expect(donde()).toEqual(Array.from({ length: 70 }, (_, i) => i));
    // La primera acaba justo en la barra del compás diecisiete.
    expect(partes().map((parte) => parte.notes.length)).toEqual([64, 6]);
    expect(partLength(partes()[0]!)).toBe(64);
  });

  it('sin barra donde acabe justo, se corta donde acaba la ultima, y suena igual', () => {
    // Notas picadas: dos análisis y un silencio de tres cuartos detrás de cada una.
    const picadas = negras(70).filter((_, i) => i % 4 < 2);
    apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: picadas, empiezaEn: 1000, acabaEn: 80_000 },
    });

    expect(donde()).toEqual(Array.from({ length: 70 }, (_, i) => i));
    expect(partes()[0]!.notes.at(-1)!.length).toBeLessThan(1);
  });

  it('una ritmica larga se corta en barra, aunque quepan mas bloques', () => {
    const C = pitchClassFromName('C');
    const G = pitchClassFromName('G');
    // Uno de dos pulsos y luego de tres en tres: con 32 bloques la parte acabaría a
    // mitad de compás, así que entran 31.
    const inicios = [0, ...Array.from({ length: 39 }, (_, i) => 2 + i * 3)];
    useSessionStore.setState({
      captured: inicios.map((pulso, i) => ({
        root: i % 2 === 0 ? C : G,
        notes: i % 2 === 0 ? [0, 4, 7] : [7, 11, 2],
        at: 1000 + 520 + pulso * 1000,
      })),
      captureStartedAt: 1000,
      captureEndedAt: 1000 + 119_000,
    });
    apuntarLoTocado({
      ...EN_DO,
      papel: 'ritmica',
      lectura: { fotogramas: [], empiezaEn: 1000, acabaEn: 1000 + 119_000 },
    });
    expect(partes().map((parte) => parte.blocks.length)).toEqual([31, 9]);
    expect(partBeats(partes()[0]!) % 4).toBe(0);
  });

  it('lo que no cabe en la cancion se dice, y lo que cabe entra', () => {
    for (let i = 0; i < MAX_PARTS - 1; i += 1) {
      useArrangementStore.getState().actions.addRecorded([], `ya ${i}`);
    }
    const { aviso } = apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: negras(100), empiezaEn: 1000, acabaEn: 200_000 },
    });
    expect(partes()).toHaveLength(MAX_PARTS);
    expect(aviso).toContain(`ya tiene ${MAX_PARTS} partes`);

    const lleno = apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: negras(4), empiezaEn: 1000, acabaEn: 10_000 },
    });
    expect(lleno.partId).toBeNull();
    expect(lleno.aviso).toMatch(/todas las partes que caben/);
  });

  it('un motor sin analisis deja el historial de siempre', () => {
    useSessionStore.setState({
      noteHistory: [{ pitchClass: pitchClassFromName('C'), midi: 60, at: 0, clarity: 0.99 }],
      captureStartedAt: 0,
      captureEndedAt: 2000,
    });
    const { partId } = apuntarLoTocado({
      ...EN_DO,
      papel: 'punteo',
      lectura: { fotogramas: [], empiezaEn: 0, acabaEn: 2000 },
    });
    expect(partes().find((parte) => parte.id === partId)!.notes).toHaveLength(1);
  });

  it('la ritmica se cuadra en la rejilla, y el ultimo acaba cuando dejo de sonar', () => {
    const C = pitchClassFromName('C');
    const G = pitchClassFromName('G');
    useSessionStore.setState({
      captured: [
        { root: C, notes: [0, 4, 7], at: 1000 + 520 },
        { root: G, notes: [7, 11, 2], at: 3000 + 520 },
      ],
      captureStartedAt: 1000,
      captureEndedAt: 9000,
    });
    // Suena hasta el pulso cuatro y luego nada: parar a los ocho no lo alarga.
    const fotogramas = [
      { at: 4900, midi: null, clarity: 0, rms: 0.05 },
      { at: 5040, midi: null, clarity: 0, rms: 0.0005 },
    ];
    const { partId } = apuntarLoTocado({
      ...EN_DO,
      papel: 'ritmica',
      lectura: { fotogramas, empiezaEn: 1000, acabaEn: 9000 },
    });
    expect(
      partes()
        .find((parte) => parte.id === partId)!
        .blocks.map((b) => b.beats),
    ).toEqual([2, 2]);

    // Y sin nada que sonara, hasta que se paró.
    useArrangementStore.getState().actions.replace(EMPTY_ARRANGEMENT);
    const otra = apuntarLoTocado({
      ...EN_DO,
      papel: 'ritmica',
      lectura: { fotogramas: [], empiezaEn: 1000, acabaEn: 9000 },
    });
    expect(
      partes()
        .find((parte) => parte.id === otra.partId)!
        .blocks.map((b) => b.beats),
    ).toEqual([2, 6]);
  });

  it('una ritmica larga tambien se reparte', () => {
    const C = pitchClassFromName('C');
    const G = pitchClassFromName('G');
    useSessionStore.setState({
      captured: Array.from({ length: 40 }, (_, i) => ({
        root: i % 2 === 0 ? C : G,
        notes: i % 2 === 0 ? [0, 4, 7] : [7, 11, 2],
        at: 1000 + 520 + i * 2000,
      })),
      captureStartedAt: 1000,
      captureEndedAt: 81_000,
    });
    apuntarLoTocado({
      ...EN_DO,
      papel: 'ritmica',
      lectura: { fotogramas: [], empiezaEn: 1000, acabaEn: 81_000 },
    });
    expect(partes().map((parte) => parte.blocks.length)).toEqual([32, 8]);
  });
});
