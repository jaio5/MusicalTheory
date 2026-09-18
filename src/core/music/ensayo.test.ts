import { describe, expect, it } from 'vitest';

import { blockChord, setRepeats, writtenBlock, type Arrangement } from './arrangement';
import { resolveDegree } from './progressions';
import {
  comoSalio,
  ensayoTerminado,
  guionDeEnsayo,
  largoDelEnsayo,
  puntuar,
  suenaComo,
  type Acierto,
} from './ensayo';

/**
 * Ensayar lo que has escrito.
 *
 * Todo esto se prueba sin micrófono, sin reloj y sin React, que es la razón de
 * que viva en `core/`: una canción entera se puntúa en un milisegundo y las
 * reglas —qué corta una racha, qué es el compás peor— se pueden discutir mirando
 * un test en vez de tocando la guitarra delante de la pantalla.
 */

function montaje(): Arrangement {
  return {
    parts: [
      {
        id: 'estrofa',
        name: 'Estrofa',
        blocks: [
          writtenBlock('a', 'I', 4),
          writtenBlock('b', 'vi', 4),
          writtenBlock('c', 'IV', 4),
          writtenBlock('d', 'V', 4),
        ],
        notes: [],
        bars: 4,
      },
    ],
  };
}

const TODO_BIEN: readonly Acierto[] = ['acertado', 'acertado', 'acertado', 'acertado'];

describe('el guion del ensayo', () => {
  it('dice que acorde toca y en que compas entra', () => {
    const guion = guionDeEnsayo(montaje(), 4);

    expect(guion.map((paso) => paso.degree)).toEqual(['I', 'vi', 'IV', 'V']);
    expect(guion.map((paso) => paso.bar)).toEqual([1, 2, 3, 4]);
  });

  // Un bloque de dos compases ocupa dos, así que el siguiente no entra en el
  // segundo: se cuentan pulsos, no bloques.
  it('un acorde que dura dos compases mueve al siguiente', () => {
    const largo: Arrangement = {
      parts: [
        {
          ...montaje().parts[0]!,
          blocks: [writtenBlock('a', 'I', 8), writtenBlock('b', 'V', 4)],
        },
      ],
    };

    expect(guionDeEnsayo(largo, 4).map((paso) => paso.bar)).toEqual([1, 3]);
  });

  it('con vueltas, el guion pasa otra vez por los mismos acordes', () => {
    const guion = guionDeEnsayo(setRepeats(montaje(), 'estrofa', 2), 4);

    expect(guion).toHaveLength(8);
    expect(guion.map((paso) => paso.blockId)).toEqual(['a', 'b', 'c', 'd', 'a', 'b', 'c', 'd']);
    // Y los compases siguen contando hacia adelante: la segunda vuelta no
    // vuelve al compás uno.
    expect(guion.map((paso) => paso.bar)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(largoDelEnsayo(setRepeats(montaje(), 'estrofa', 2))).toBe(8);
  });
});

describe('la puntuacion', () => {
  it('cuenta los tres resultados por separado', () => {
    const guion = guionDeEnsayo(montaje(), 4);

    const r = puntuar(guion, ['acertado', 'tarde', 'fallado', 'acertado']);

    expect(r.total).toBe(4);
    expect(r.acertados).toBe(2);
    expect(r.tarde).toBe(1);
    expect(r.fallados).toBe(1);
  });

  /**
   * Un `tarde` corta la racha aunque el acorde fuera el bueno. Una racha es de
   * tocar en su sitio: si no midiera eso, sería otra vez el número de aciertos.
   */
  it('llegar tarde corta la racha, aunque el acorde sea el bueno', () => {
    const guion = guionDeEnsayo(montaje(), 4);

    expect(puntuar(guion, TODO_BIEN).rachaMasLarga).toBe(4);
    expect(puntuar(guion, ['acertado', 'acertado', 'tarde', 'acertado']).rachaMasLarga).toBe(2);
  });

  it('sin fallar nada, no hay compas peor', () => {
    expect(puntuar(guionDeEnsayo(montaje(), 4), TODO_BIEN).peor).toBeNull();
  });

  /**
   * El peor se cuenta **por bloque y no por compás**: con vueltas, el mismo
   * acorde pasa por sitios distintos y lo que hace falta saber es qué acorde se
   * atraganta, no en cuál de las vueltas.
   */
  it('el peor es el acorde que mas se fallo, y se dice donde esta la primera vez', () => {
    const conVueltas = setRepeats(montaje(), 'estrofa', 2);
    const guion = guionDeEnsayo(conVueltas, 4);

    // El IV —bloque «c»— se falla las dos vueltas; el vi solo una.
    const r = puntuar(guion, [
      'acertado',
      'fallado',
      'fallado',
      'acertado',
      'acertado',
      'acertado',
      'fallado',
      'acertado',
    ]);

    expect(r.peor).toEqual({ blockId: 'c', degree: 'IV', bar: 3, veces: 2, fallos: 2 });
  });

  it('a igualdad de fallos gana el que llega antes', () => {
    const guion = guionDeEnsayo(montaje(), 4);

    const r = puntuar(guion, ['acertado', 'fallado', 'fallado', 'acertado']);

    expect(r.peor?.bar).toBe(2);
  });

  // Parar a la mitad no es un ensayo fallado: se puntúa lo que se tocó.
  it('un ensayo a medias puntua lo tocado y nada mas', () => {
    const guion = guionDeEnsayo(montaje(), 4);

    const r = puntuar(guion, ['acertado', 'acertado']);

    expect(r.total).toBe(2);
    expect(r.acertados).toBe(2);
    expect(ensayoTerminado(guion, ['acertado', 'acertado'])).toBe(false);
  });

  it('terminado es haber llegado al final, no haberlo hecho bien', () => {
    const guion = guionDeEnsayo(montaje(), 4);

    expect(ensayoTerminado(guion, ['fallado', 'fallado', 'fallado', 'fallado'])).toBe(true);
    expect(ensayoTerminado([], [])).toBe(false);
  });
});

/**
 * Comparar lo que sonó con lo que tocaba.
 *
 * Se compara la **clase de acorde** y no la digitación: el croma olvida la
 * octava a propósito, así que pedir que coincida el bajo sería prometer una
 * precisión que este motor no tiene.
 */
describe('si lo que se oyo era lo que tocaba', () => {
  const doMayor = resolveDegree(0, 'major', 'I');

  it('las mismas notas valen, venga el bajo que venga', () => {
    expect(suenaComo(doMayor, { root: 0, notes: [0, 4, 7] })).toBe(true);
    // La misma clase con las notas en otro orden es el mismo acorde.
    expect(suenaComo(doMayor, { root: 0, notes: [7, 0, 4] })).toBe(true);
  });

  it('otro acorde no vale, ni aunque se parezca', () => {
    expect(suenaComo(doMayor, { root: 9, notes: [9, 0, 4] })).toBe(false);
    // Un Cmaj7 no es un C: quien ensaya comprueba que toca lo que escribió.
    expect(suenaComo(doMayor, { root: 0, notes: [0, 4, 7, 11] })).toBe(false);
  });

  it('y sin oir nada, no', () => {
    expect(suenaComo(doMayor, null)).toBe(false);
  });
});

describe('a tiempo o tarde', () => {
  // A tiempo es en la primera mitad del compás: un acorde que aparece cuando el
  // compás se acaba no se tocó con el metrónomo, se tocó detrás de él.
  it('en la primera mitad es acertado, despues es tarde', () => {
    expect(comoSalio(4, 0)).toBe('acertado');
    expect(comoSalio(4, 2)).toBe('acertado');
    expect(comoSalio(4, 3)).toBe('tarde');
  });

  it('y no sonar nunca es fallado', () => {
    expect(comoSalio(4, null)).toBe('fallado');
  });
});

/**
 * Un riff de quintas se ensaya como un riff de quintas.
 *
 * El croma oyendo un `C5` entrega dos notas; comparándolo contra la tríada del
 * `I`, un riff bien tocado contaría como fallo
 * ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
 */
describe('el ensayo de lo que no lleva tercera', () => {
  it('el guion se lleva la especie, no solo el grado', () => {
    const riff: Arrangement = {
      parts: [
        {
          id: 'e',
          name: 'Riff',
          blocks: [writtenBlock('a', 'I', 4, 'quinta'), writtenBlock('b', 'IV', 4)],
          notes: [],
          bars: 2,
        },
      ],
    };

    expect(guionDeEnsayo(riff, 4).map((paso) => paso.especie)).toEqual(['quinta', undefined]);
  });

  it('y una quinta oida cuenta como acertada', () => {
    const quinta = blockChord(0, 'major', writtenBlock('a', 'I', 4, 'quinta'));

    expect(suenaComo(quinta, { root: 0, notes: [0, 7] })).toBe(true);
    // Y la tríada entera no es esa quinta: son acordes distintos.
    expect(suenaComo(quinta, { root: 0, notes: [0, 4, 7] })).toBe(false);
  });
});
