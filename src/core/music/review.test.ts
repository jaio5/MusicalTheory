import { describe, expect, it } from 'vitest';

import {
  crackedUnits,
  dueReview,
  EMPTY_REVIEW,
  isDue,
  isUnitCracked,
  MASTERED_HITS,
  mergeReview,
  recordHit,
  recordMiss,
  REVIEW_LIMIT,
  type ReviewQueue,
} from './review';

const HOY = '2026-07-30';
const MANANA = '2026-07-31';
const PASADO = '2026-08-01';

describe('recordMiss', () => {
  it('apunta la pregunta con sus aciertos a cero', () => {
    const queue = recordMiss(EMPTY_REVIEW, 'e1-grados', 2, HOY);
    expect(queue).toEqual([{ unitId: 'e1-grados', index: 2, seenOn: HOY, hits: 0 }]);
  });

  // Lo que importa es que sigue sin saberse, no cuántas veces se ha fallado.
  it('volver a fallar no duplica: reinicia', () => {
    const primera = recordMiss(EMPTY_REVIEW, 'e1-grados', 2, HOY);
    const acertada = recordHit(primera, 'e1-grados', 2, HOY);
    const otra = recordMiss(acertada, 'e1-grados', 2, MANANA);

    expect(otra).toHaveLength(1);
    expect(otra[0]).toEqual({ unitId: 'e1-grados', index: 2, seenOn: MANANA, hits: 0 });
  });

  it('distingue dos preguntas de la misma unidad', () => {
    const queue = recordMiss(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 1, HOY);
    expect(queue).toHaveLength(2);
  });

  it('al llegar al tope suelta lo más viejo', () => {
    let queue: ReviewQueue = EMPTY_REVIEW;
    for (let i = 0; i < REVIEW_LIMIT + 5; i += 1) {
      queue = recordMiss(queue, 'e1-grados', i, HOY);
    }
    expect(queue).toHaveLength(REVIEW_LIMIT);
    expect(queue[0]?.index).toBe(5);
  });
});

describe('recordHit', () => {
  it('sube los aciertos y aplaza la pregunta', () => {
    const queue = recordHit(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 0, HOY);
    expect(queue[0]?.hits).toBe(1);
    expect(isDue(queue[0]!, HOY)).toBe(false);
    expect(isDue(queue[0]!, MANANA)).toBe(true);
  });

  it('con los aciertos suficientes, la pregunta se va de la cola', () => {
    let queue = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY);
    for (let i = 0; i < MASTERED_HITS; i += 1) {
      queue = recordHit(queue, 'e1-grados', 0, HOY);
    }
    expect(queue).toHaveLength(0);
  });

  it('acertar algo que no estaba apuntado no hace nada', () => {
    const queue = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY);
    expect(recordHit(queue, 'e2-calidades', 3, HOY)).toBe(queue);
  });
});

describe('dueReview', () => {
  it('lo recién fallado toca hoy mismo', () => {
    const queue = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY);
    expect(dueReview(queue, HOY)).toHaveLength(1);
  });

  it('lo acertado una vez no toca hasta el día siguiente', () => {
    const queue = recordHit(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 0, HOY);
    expect(dueReview(queue, HOY)).toHaveLength(0);
    expect(dueReview(queue, MANANA)).toHaveLength(1);
  });

  // Lo que llevas más tiempo sin ver es lo que está más cerca de olvidarse.
  it('pone lo más viejo primero', () => {
    const viejo = recordMiss(EMPTY_REVIEW, 'e1-grados', 5, HOY);
    const nuevo = recordMiss(viejo, 'e2-calidades', 1, MANANA);
    expect(dueReview(nuevo, PASADO).map((item) => item.unitId)).toEqual([
      'e1-grados',
      'e2-calidades',
    ]);
  });

  it('una fecha imposible no deja la pregunta atrapada para siempre', () => {
    const queue: ReviewQueue = [{ unitId: 'e1-grados', index: 0, seenOn: 'ayer', hits: 1 }];
    expect(dueReview(queue, HOY)).toHaveLength(1);
  });
});

describe('isUnitCracked', () => {
  it('una unidad con preguntas pendientes está agrietada', () => {
    const queue = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY);
    expect(isUnitCracked(queue, 'e1-grados', HOY)).toBe(true);
    expect(isUnitCracked(queue, 'e2-calidades', HOY)).toBe(false);
  });

  it('deja de estar agrietada mientras la pregunta espera su turno', () => {
    const queue = recordHit(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 0, HOY);
    expect(isUnitCracked(queue, 'e1-grados', HOY)).toBe(false);
    expect(isUnitCracked(queue, 'e1-grados', MANANA)).toBe(true);
  });

  it('crackedUnits no repite unidades', () => {
    const queue = recordMiss(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 1, HOY);
    expect(crackedUnits(queue, HOY)).toEqual(['e1-grados']);
  });
});

describe('mergeReview', () => {
  it('junta preguntas de las dos colas', () => {
    const a = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY);
    const b = recordMiss(EMPTY_REVIEW, 'e2-calidades', 1, HOY);
    expect(mergeReview(a, b)).toHaveLength(2);
  });

  // Dar por sabido lo que no se sabe es el único error que no puede permitirse.
  it('ante la duda se queda con el peor de los dos', () => {
    const sabida = recordHit(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 0, HOY);
    const fallada = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, MANANA);

    const merged = mergeReview(sabida, fallada);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.hits).toBe(0);
    expect(merged[0]?.seenOn).toBe(MANANA);
  });

  it('es simétrica en lo que decide', () => {
    const sabida = recordHit(recordMiss(EMPTY_REVIEW, 'e1-grados', 0, HOY), 'e1-grados', 0, HOY);
    const fallada = recordMiss(EMPTY_REVIEW, 'e1-grados', 0, MANANA);
    expect(mergeReview(sabida, fallada)).toEqual(mergeReview(fallada, sabida));
  });

  it('respeta el tope de la cola', () => {
    let a: ReviewQueue = EMPTY_REVIEW;
    let b: ReviewQueue = EMPTY_REVIEW;
    for (let i = 0; i < REVIEW_LIMIT; i += 1) {
      a = recordMiss(a, 'e1-grados', i, HOY);
      b = recordMiss(b, 'e2-calidades', i, HOY);
    }
    expect(mergeReview(a, b)).toHaveLength(REVIEW_LIMIT);
  });
});
