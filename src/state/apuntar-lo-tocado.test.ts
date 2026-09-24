import { beforeEach, describe, expect, it } from 'vitest';

import {
  EMPTY_ARRANGEMENT,
  pitchClassFromName,
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
