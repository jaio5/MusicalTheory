import { describe, expect, it } from 'vitest';

import type { Block, Part } from '@core/music';

import { esPulsoFuerte, pasosDeLaParte, pasosDeLoGrabado } from './lo-que-se-manda';

function bloque(extra: Partial<Block> & Pick<Block, 'degree'>): Block {
  return {
    id: extra.degree,
    beats: 4,
    source: 'written',
    confidence: 1,
    alternatives: [],
    ...extra,
  };
}

function parte(blocks: readonly Block[], notes: Part['notes'] = []): Part {
  return { id: 'p', name: 'Lo que sea', blocks, notes, bars: 4 };
}

describe('los tiempos fuertes', () => {
  it('el primero de cada compas, y en un 4/4 tambien el tercero', () => {
    expect([0, 1, 2, 3, 4, 6].map((pulso) => esPulsoFuerte(pulso, 4))).toEqual([
      true,
      false,
      true,
      false,
      true,
      true,
    ]);
  });

  it('en un vals solo el primero, y en un 6/8 el primero y el cuarto', () => {
    expect([0, 1, 2, 3].map((pulso) => esPulsoFuerte(pulso, 3))).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect([0, 2, 3, 5].map((pulso) => esPulsoFuerte(pulso, 6))).toEqual([
      true,
      false,
      true,
      false,
    ]);
    // Un compás de dos no tiene mitad que valga.
    expect(esPulsoFuerte(1, 2)).toBe(false);
  });
});

describe('lo que se manda de una parte', () => {
  it('el grado y lo que dura, y nada mas cuando no hay nada mas que decir', () => {
    expect(pasosDeLaParte(parte([bloque({ degree: 'I' }), bloque({ degree: 'V' })]), 4)).toEqual([
      { degree: 'I', beats: 4 },
      { degree: 'V', beats: 4 },
    ]);
  });

  it('la especie viaja, y la duda solo de lo que el micro leyo sin confirmar', () => {
    const pasos = pasosDeLaParte(
      parte([
        bloque({ degree: 'V', especie: 'dominant7' }),
        bloque({ degree: 'I', source: 'heard', confidence: 0.01 }),
        // Oído y seguro: no hay nada que avisar.
        bloque({ degree: 'IV', source: 'heard', confidence: 0.5 }),
      ]),
      4,
    );

    expect(pasos).toEqual([
      { degree: 'V', beats: 4, especie: 'dominant7' },
      { degree: 'I', beats: 4, heard: true },
      { degree: 'IV', beats: 4 },
    ]);
  });

  /**
   * Las notas que **suenan** en cada compás, no las que empiezan: una ligada que
   * cruza la barra suena en los dos. Y es fuerte la que suena cuando cae un tiempo
   * fuerte, que es lo que más tiene que encajar con el acorde.
   */
  it('cada compas lleva las notas que suenan en el, con las de tiempo fuerte marcadas', () => {
    const pasos = pasosDeLaParte(
      parte(
        [bloque({ degree: 'I' }), bloque({ degree: 'IV' })],
        [
          // Mi en el uno: fuerte.
          { id: 'a', offset: 4, start: 0, length: 1 },
          // Re a contratiempo: débil.
          { id: 'b', offset: 2, start: 1.5, length: 0.5 },
          // Sol ligado del cuatro al uno del compás siguiente: suena en los dos, y
          // en el segundo cae en el tiempo fuerte.
          { id: 'c', offset: 7, start: 3, length: 2 },
          // Una octava por debajo es la misma altura: el La de -3.
          { id: 'd', offset: -3, start: 5, length: 1 },
        ],
      ),
      4,
    );

    expect(pasos[0]?.notas).toEqual([
      { nota: 4, fuerte: true },
      { nota: 2, fuerte: false },
      { nota: 7, fuerte: false },
    ]);
    expect(pasos[1]?.notas).toEqual([
      { nota: 7, fuerte: true },
      { nota: 9, fuerte: false },
    ]);
  });

  it('una altura que suena dos veces va una, fuerte si lo fue alguna', () => {
    const [paso] = pasosDeLaParte(
      parte(
        [bloque({ degree: 'I' })],
        [
          { id: 'a', offset: 0, start: 1, length: 1 },
          { id: 'b', offset: 12, start: 2, length: 1 },
          { id: 'c', offset: 0, start: 3, length: 1 },
        ],
      ),
      4,
    );

    expect(paso?.notas).toEqual([{ nota: 0, fuerte: true }]);
  });

  /** Lo que se sale por el final suena sobre el último acorde, como en `chordAt`. */
  it('el ultimo compas se queda con lo que se sale por el final', () => {
    const pasos = pasosDeLaParte(
      parte(
        [bloque({ degree: 'I', beats: 2 }), bloque({ degree: 'V', beats: 2 })],
        [{ id: 'a', offset: 11, start: 5, length: 1 }],
      ),
      4,
    );

    expect(pasos[0]).not.toHaveProperty('notas');
    expect(pasos[1]?.notas).toEqual([{ nota: 11, fuerte: false }]);
  });
});

describe('lo que se manda de lo grabado', () => {
  it('grado y pulsos, y la marca de oido solo en lo dudoso', () => {
    expect(
      pasosDeLoGrabado([
        { degree: 'I', beats: 2, confidence: 0.9, alternatives: ['vi'] },
        { degree: 'V', beats: 4, confidence: 0.01, alternatives: ['iii'] },
      ]),
    ).toEqual([
      { degree: 'I', beats: 2 },
      { degree: 'V', beats: 4, heard: true },
    ]);
  });
});
